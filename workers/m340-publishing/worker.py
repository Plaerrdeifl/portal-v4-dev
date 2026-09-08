#!/usr/bin/env python3
"""M340 DEV outbound Fanbus publishing worker for acer01."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import logging
import os
import re
import subprocess
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

EXPECTED_ENVIRONMENT = "DEV"
EXPECTED_EDGE_HOST = "tpieykhhawszlzsoflnl.supabase.co"
EXPECTED_EDGE_PATH = "/functions/v1/m340-publishing-worker"
EXPECTED_PUBLIC_HOST = "staging.plaerrdeifl.de"
EXPECTED_NEXTCLOUD_HOST = "cloud.plaerrdeifl.de"
EXPECTED_NEXTCLOUD_ROOT = "/Fanbus/_DEV"
NEXTCLOUD_SHARE_API = "https://cloud.plaerrdeifl.de/ocs/v2.php/apps/files_sharing/api/v1/shares"
EXPECTED_RENDERER = (
    "lscr.io/linuxserver/inkscape:1.4.2-r8-ls94@"
    "sha256:4d651665d4e3471a8d59d970e9841d50369baf1c4daa6df206f31caf163c4b22"
)
EXPECTED_FONT_SHA256 = "d2c790c5ce96e4453ab7ea2d17f8c71db06cec3d3ab4f7f98db02955e63ab353"
WORKER_HEADER = "X-M340-Worker-Token"
BERLIN = ZoneInfo("Europe/Berlin")
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ERROR_RE = re.compile(r"^[A-Z0-9_:-]{1,80}$")
GERMAN_WEEKDAYS = (
    "MONTAG",
    "DIENSTAG",
    "MITTWOCH",
    "DONNERSTAG",
    "FREITAG",
    "SAMSTAG",
    "SONNTAG",
)
ARTIFACTS = ("qr", "post", "story", "led")
EXPECTED_PNG_DIMENSIONS = {
    "qr": (512, 512),
    "post": (1080, 1350),
    "story": (1080, 1920),
    "led": (1920, 1080),
}
EXPECTED_TEMPLATE_DIMENSIONS = {key.upper(): value for key, value in EXPECTED_PNG_DIMENSIONS.items() if key != "qr"}
REQUIRED_TEMPLATE_IDS = (
    "m340-destination",
    "m340-trip-label-brush",
    "plaerrdeifl-brush-horizontal-proof",
    "m340-trip-label-text",
    "text34",
    "m340-date",
    "m340-game-start",
    "m340-price",
    "m340-registration-deadline-date",
    "m340-registration-deadline-time",
    "m340-boarding-1-time",
    "m340-boarding-1-place",
    "m340-boarding-1-detail",
    "m340-boarding-2-time",
    "m340-boarding-2-place",
    "m340-boarding-2-detail",
    "m340-contact-pascal-name",
    "m340-contact-pascal-phone",
    "m340-contact-luca-name",
    "m340-contact-luca-phone",
    "m340-qr-slot",
    "m340-qr-quiet-zone",
    "m340-qr-vector",
)
MAX_TEMPLATE_BYTES = 5 * 1024 * 1024
TRIP_LABEL_DEFAULT = "FANBUSFAHRT"
TRIP_LABEL_MAX_CHARS = 32
TRIP_LABEL_BRUSH_PADDING = 36.0
SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK_NS)
ET.register_namespace("inkscape", INKSCAPE_NS)


class WorkerError(RuntimeError):
    def __init__(self, code: str):
        if not ERROR_RE.fullmatch(code):
            code = "WORKER_INTERNAL"
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class Config:
    environment: str
    edge_url: str
    public_base_url: str
    worker_token_file: Path
    nextcloud_webdav_base: str
    nextcloud_root: str
    nextcloud_username: str
    nextcloud_password_file: Path
    templates_dir: Path
    work_dir: Path
    font_file: Path
    font_sha256: str
    renderer_image: str
    poll_seconds: int


def _https_url(value: str, host: str, exact_path: str | None = None) -> str:
    try:
        parsed = urllib.parse.urlsplit(value)
    except ValueError as exc:
        raise WorkerError("CONFIG_INVALID") from exc
    if (
        parsed.scheme != "https"
        or parsed.hostname != host
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or (exact_path is not None and parsed.path.rstrip("/") != exact_path)
    ):
        raise WorkerError("CONFIG_INVALID")
    return urllib.parse.urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", "")
    )


def load_config(path: Path) -> Config:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise WorkerError("CONFIG_INVALID") from exc
    if not isinstance(raw, dict):
        raise WorkerError("CONFIG_INVALID")
    expected = {
        "environment",
        "edgeUrl",
        "publicBaseUrl",
        "workerTokenFile",
        "nextcloudWebdavBase",
        "nextcloudRoot",
        "nextcloudUsername",
        "nextcloudPasswordFile",
        "templatesDir",
        "workDir",
        "fontFile",
        "fontSha256",
        "rendererImage",
        "pollSeconds",
    }
    if set(raw) != expected:
        raise WorkerError("CONFIG_INVALID")
    if raw["environment"] != EXPECTED_ENVIRONMENT:
        raise WorkerError("CONFIG_INVALID")
    edge = _https_url(str(raw["edgeUrl"]), EXPECTED_EDGE_HOST, EXPECTED_EDGE_PATH)
    public_base = _https_url(str(raw["publicBaseUrl"]), EXPECTED_PUBLIC_HOST, "")
    webdav = _https_url(
        str(raw["nextcloudWebdavBase"]),
        EXPECTED_NEXTCLOUD_HOST,
        "/remote.php/dav/files/m340-dev",
    )
    if raw["nextcloudRoot"] != EXPECTED_NEXTCLOUD_ROOT:
        raise WorkerError("CONFIG_INVALID")
    if raw["rendererImage"] != EXPECTED_RENDERER:
        raise WorkerError("CONFIG_INVALID")
    if raw["fontSha256"] != EXPECTED_FONT_SHA256:
        raise WorkerError("CONFIG_INVALID")
    poll = raw["pollSeconds"]
    if isinstance(poll, bool) or not isinstance(poll, int) or poll != 30:
        raise WorkerError("CONFIG_INVALID")
    username = raw["nextcloudUsername"]
    if username != "m340-dev":
        raise WorkerError("CONFIG_INVALID")
    return Config(
        environment=EXPECTED_ENVIRONMENT,
        edge_url=edge,
        public_base_url=public_base,
        worker_token_file=Path(str(raw["workerTokenFile"])),
        nextcloud_webdav_base=webdav,
        nextcloud_root=EXPECTED_NEXTCLOUD_ROOT,
        nextcloud_username=username,
        nextcloud_password_file=Path(str(raw["nextcloudPasswordFile"])),
        templates_dir=Path(str(raw["templatesDir"])),
        work_dir=Path(str(raw["workDir"])),
        font_file=Path(str(raw["fontFile"])),
        font_sha256=EXPECTED_FONT_SHA256,
        renderer_image=EXPECTED_RENDERER,
        poll_seconds=30,
    )


def read_secret(path: Path, minimum_bytes: int) -> str:
    try:
        raw = path.read_bytes()
    except OSError as exc:
        raise WorkerError("SECRET_UNAVAILABLE") from exc
    value = raw.strip()
    if len(value) < minimum_bytes or len(value) > 2048 or b"\x00" in value:
        raise WorkerError("SECRET_INVALID")
    try:
        return value.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise WorkerError("SECRET_INVALID") from exc


def _json_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def call_edge(config: Config, payload: dict[str, Any]) -> dict[str, Any]:
    token = read_secret(config.worker_token_file, 32)
    request = urllib.request.Request(
        config.edge_url,
        data=_json_bytes(payload),
        method="POST",
        headers={
            "Content-Type": "application/json",
            WORKER_HEADER: token,
            "User-Agent": "Plaerrdeifl-M340-Worker/1",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read(1_048_577)
            if response.status != 200 or len(body) > 1_048_576:
                raise WorkerError("EDGE_RESPONSE_INVALID")
    except urllib.error.HTTPError as exc:
        raise WorkerError("EDGE_HTTP_FAILED") from exc
    except urllib.error.URLError as exc:
        raise WorkerError("EDGE_NETWORK_FAILED") from exc
    try:
        decoded = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise WorkerError("EDGE_RESPONSE_INVALID") from exc
    if not isinstance(decoded, dict) or decoded.get("ok") is not True:
        raise WorkerError("EDGE_RESPONSE_INVALID")
    data = decoded.get("data")
    if not isinstance(data, dict):
        raise WorkerError("EDGE_RESPONSE_INVALID")
    return data


def claim(config: Config) -> dict[str, Any] | None:
    result = call_edge(config, {"action": "claim"})
    if result.get("claimed") is False:
        return None
    if result.get("claimed") is not True or not isinstance(result.get("job"), dict):
        raise WorkerError("CLAIM_INVALID")
    job = result["job"]
    required = {"jobId", "claimToken", "environment", "attemptCount", "claimExpiresAt", "request"}
    if set(job) != required:
        raise WorkerError("CLAIM_INVALID")
    if not isinstance(job["jobId"], str) or not UUID_RE.fullmatch(job["jobId"]):
        raise WorkerError("CLAIM_INVALID")
    if not isinstance(job["claimToken"], str) or not UUID_RE.fullmatch(job["claimToken"]):
        raise WorkerError("CLAIM_INVALID")
    if job["environment"] != config.environment:
        raise WorkerError("ENVIRONMENT_MISMATCH")
    if isinstance(job["attemptCount"], bool) or not isinstance(job["attemptCount"], int):
        raise WorkerError("CLAIM_INVALID")
    if not 1 <= job["attemptCount"] <= 5 or not isinstance(job["request"], dict):
        raise WorkerError("CLAIM_INVALID")
    return job


def complete(
    config: Config,
    job: dict[str, Any],
    success: bool,
    error_code: str | None,
    result: dict[str, Any] | None,
) -> None:
    payload = {
        "action": "complete",
        "jobId": job["jobId"],
        "claimToken": job["claimToken"],
        "success": success,
        "errorCode": error_code,
        "result": result,
    }
    response = call_edge(config, payload)
    if response.get("completed") is not True:
        raise WorkerError("COMPLETE_REJECTED")


def _uuid(value: Any) -> str:
    if not isinstance(value, str) or not UUID_RE.fullmatch(value):
        raise WorkerError("SNAPSHOT_INVALID")
    return value.lower()


def _bounded_text(value: Any, maximum: int, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise WorkerError("SNAPSHOT_INVALID")
    text = " ".join(value.split())
    if (not allow_empty and not text) or len(text) > maximum:
        raise WorkerError("SNAPSHOT_TEXT_TOO_LONG" if len(text) > maximum else "SNAPSHOT_INVALID")
    return text


def _date_only(value: Any) -> date:
    if not isinstance(value, str) or len(value) > 16:
        raise WorkerError("SNAPSHOT_INVALID")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise WorkerError("SNAPSHOT_INVALID") from exc


def _datetime(value: Any) -> datetime:
    return _parse_aware_datetime(value)


def _integer(value: Any, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise WorkerError("SNAPSHOT_INVALID")
    return value


def _parse_aware_datetime(value: Any) -> datetime:
    if not isinstance(value, str) or len(value) > 64:
        raise WorkerError("SNAPSHOT_INVALID")
    candidate = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as exc:
        raise WorkerError("SNAPSHOT_INVALID") from exc
    if parsed.tzinfo is None:
        raise WorkerError("SNAPSHOT_INVALID")
    return parsed.astimezone(BERLIN)


def _bounded_text(value: Any, maximum: int, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise WorkerError("SNAPSHOT_INVALID")
    text = " ".join(value.split())
    if (not allow_empty and not text) or len(text) > maximum:
        raise WorkerError("SNAPSHOT_TEXT_TOO_LONG" if len(text) > maximum else "SNAPSHOT_INVALID")
    return text


def _default_template_descriptors() -> dict[str, dict[str, Any]]:
    return {
        kind: {"kind": kind, "source": "SERVER_DEFAULT"}
        for kind in ("POST", "STORY", "LED")
    }


def _normalize_template_descriptors(value: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(value, list) or len(value) != 3:
        raise WorkerError("SNAPSHOT_INVALID")
    result: dict[str, dict[str, Any]] = {}
    for item in value:
        if not isinstance(item, dict):
            raise WorkerError("SNAPSHOT_INVALID")
        kind = str(item.get("kind") or "").upper()
        source = str(item.get("source") or "").upper()
        if kind not in {"POST", "STORY", "LED"} or kind in result:
            raise WorkerError("SNAPSHOT_INVALID")
        if source == "SERVER_DEFAULT":
            if set(item) != {"kind", "source"}:
                raise WorkerError("SNAPSHOT_INVALID")
            result[kind] = {"kind": kind, "source": source}
            continue
        if source != "CUSTOM" or set(item) != {
            "kind", "source", "versionId", "objectName", "filename", "sha256", "bytes"
        }:
            raise WorkerError("SNAPSHOT_INVALID")
        version_id = _uuid(item.get("versionId"))
        object_name = _bounded_text(item.get("objectName"), 500)
        filename = _bounded_text(item.get("filename"), 160)
        sha256 = str(item.get("sha256") or "")
        size = item.get("bytes")
        if (
            not re.fullmatch(r"versions/dev/[0-9a-f-]{36}/[0-9a-f-]{36}[.]svg", object_name, re.IGNORECASE)
            or not re.fullmatch(r"[A-Za-z0-9ÄÖÜäöüß._ -]+[.]svg", filename)
            or not re.fullmatch(r"[0-9a-f]{64}", sha256)
            or not isinstance(size, int)
            or isinstance(size, bool)
            or not 1000 <= size <= MAX_TEMPLATE_BYTES
        ):
            raise WorkerError("SNAPSHOT_INVALID")
        result[kind] = {
            "kind": kind,
            "source": source,
            "versionId": version_id,
            "objectName": object_name,
            "filename": filename,
            "sha256": sha256,
            "bytes": size,
        }
    if set(result) != {"POST", "STORY", "LED"}:
        raise WorkerError("SNAPSHOT_INVALID")
    return result


def validate_snapshot(snapshot: Any) -> dict[str, Any]:
    if not isinstance(snapshot, dict):
        raise WorkerError("SNAPSHOT_INVALID")
    schema_version = snapshot.get("schemaVersion")
    if schema_version == 1:
        if set(snapshot) != {"schemaVersion", "shortlinkPath", "place", "trip", "boardingStops"}:
            raise WorkerError("SNAPSHOT_INVALID")
        trip_label = {"enabled": True, "text": TRIP_LABEL_DEFAULT}
        templates = _default_template_descriptors()
    elif schema_version == 2:
        if set(snapshot) != {"schemaVersion", "shortlinkPath", "place", "trip", "boardingStops", "publishing"}:
            raise WorkerError("SNAPSHOT_INVALID")
        publishing = snapshot.get("publishing")
        if not isinstance(publishing, dict) or set(publishing) != {"settings", "templates"}:
            raise WorkerError("SNAPSHOT_INVALID")
        settings = publishing.get("settings")
        if not isinstance(settings, dict) or set(settings) != {"tripLabel"}:
            raise WorkerError("SNAPSHOT_INVALID")
        raw_label = settings.get("tripLabel")
        if not isinstance(raw_label, dict) or set(raw_label) != {"enabled", "text"}:
            raise WorkerError("SNAPSHOT_INVALID")
        enabled = raw_label.get("enabled")
        text = raw_label.get("text")
        if not isinstance(enabled, bool) or not isinstance(text, str):
            raise WorkerError("SNAPSHOT_INVALID")
        text = " ".join(text.split())
        if len(text) > TRIP_LABEL_MAX_CHARS or any(ord(char) < 32 or ord(char) == 127 for char in text):
            raise WorkerError("SNAPSHOT_INVALID")
        if enabled and not text:
            raise WorkerError("SNAPSHOT_INVALID")
        if not enabled:
            text = ""
        trip_label = {"enabled": enabled, "text": text}
        templates = _normalize_template_descriptors(publishing.get("templates"))
    else:
        raise WorkerError("SNAPSHOT_INVALID")

    shortlink_path = _bounded_text(snapshot.get("shortlinkPath"), 160)
    place = snapshot.get("place")
    trip = snapshot.get("trip")
    boarding = snapshot.get("boardingStops")
    if not isinstance(place, dict) or not isinstance(trip, dict) or not isinstance(boarding, list):
        raise WorkerError("SNAPSHOT_INVALID")

    if set(place) != {"id", "slug", "displayName"}:
        raise WorkerError("SNAPSHOT_INVALID")
    place_id = _uuid(place.get("id"))
    slug = _bounded_text(place.get("slug"), 80).lower()
    display_name = _bounded_text(place.get("displayName"), 120)
    if not SLUG_RE.fullmatch(slug) or shortlink_path != f"/ontour/{slug}":
        raise WorkerError("SNAPSHOT_INVALID")

    required_trip_keys = {
        "tripId",
        "tripStatus",
        "eventType",
        "displayTitle",
        "eventDate",
        "eventTime",
        "venue",
        "departureAt",
        "departureInfo",
        "registrationOpensAt",
        "registrationClosesAt",
        "priceCents",
        "capacity",
        "activeRegistrationCount",
        "remainingCapacity",
        "registrationStatus",
        "organizationContact",
    }
    if not required_trip_keys.issubset(trip.keys()):
        raise WorkerError("SNAPSHOT_INVALID")
    trip_id = _uuid(trip.get("tripId"))
    if trip.get("tripStatus") != "PUBLISHED" or trip.get("eventType") != "GAME":
        raise WorkerError("SNAPSHOT_INVALID")
    event_date = _date_only(trip.get("eventDate"))
    event_time = _bounded_text(trip.get("eventTime"), 16, allow_empty=True)
    _bounded_text(trip.get("displayTitle"), 240)
    _bounded_text(trip.get("venue"), 160)
    registration_closes = _datetime(trip.get("registrationClosesAt"))
    price_cents = _integer(trip.get("priceCents"), minimum=0, maximum=1_000_000)

    stops: list[dict[str, Any]] = []
    for raw in boarding:
        if not isinstance(raw, dict):
            raise WorkerError("SNAPSHOT_INVALID")
        try:
            stop = {
                "id": _uuid(raw.get("id")),
                "label": _bounded_text(raw.get("label"), 120),
                "departure": _datetime(raw.get("departureAt")).astimezone(BERLIN),
            }
        except WorkerError:
            raise
        stops.append(stop)
    if len(stops) > 2:
        raise WorkerError("SNAPSHOT_UNSUPPORTED_STOPS")

    organization = trip.get("organizationContact")
    if not isinstance(organization, dict):
        organization = {}

    return {
        "schemaVersion": schema_version,
        "shortlinkPath": shortlink_path,
        "placeId": place_id,
        "slug": slug,
        "displayName": display_name,
        "tripId": trip_id,
        "eventDate": event_date,
        "eventTime": event_time,
        "registrationClosesAt": registration_closes.astimezone(BERLIN),
        "priceCents": price_cents,
        "stops": stops,
        "organizationContact": organization,
        "tripLabel": trip_label,
        "templates": templates,
    }

def _format_price(cents: int) -> str:
    euros, remainder = divmod(cents, 100)
    return f"{euros} €" if remainder == 0 else f"{euros},{remainder:02d} €"


def _contact_slots(organization: dict[str, Any]) -> list[tuple[str, str]]:
    candidates: list[Any] = []
    contacts = organization.get("contacts")
    if isinstance(contacts, list):
        candidates.extend(contacts)
    primary = organization.get("primary")
    if isinstance(primary, dict):
        candidates.append(primary)
    result: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        name = candidate.get("name")
        phone = candidate.get("phone")
        if not isinstance(name, str) or not isinstance(phone, str):
            continue
        name = " ".join(name.split())
        phone = " ".join(phone.split())
        if not name or not phone or len(name) > 40 or len(phone) > 32:
            continue
        key = (name, phone)
        if key not in seen:
            seen.add(key)
            result.append(key)
        if len(result) == 2:
            break
    return result


def build_text_fields(normalized: dict[str, Any]) -> dict[str, str]:
    event_date: date = normalized["eventDate"]
    deadline: datetime = normalized["registrationClosesAt"]
    event_time = normalized["eventTime"]
    fields = {
        "m340-destination": normalized["displayName"].upper(),
        "m340-trip-label-text": normalized["tripLabel"]["text"],
        "text34": GERMAN_WEEKDAYS[event_date.weekday()],
        "m340-date": event_date.strftime("%d.%m.%Y"),
        "m340-game-start": f"{event_time[:5]} UHR" if event_time else "",
        "m340-price": _format_price(normalized["priceCents"]),
        "m340-registration-deadline-date": deadline.strftime("%d.%m.%Y,"),
        "m340-registration-deadline-time": deadline.strftime("%H:%M UHR"),
    }
    stops = normalized["stops"]
    for number in (1, 2):
        if len(stops) >= number:
            stop = stops[number - 1]
            fields[f"m340-boarding-{number}-time"] = stop["departure"].strftime("%H:%M UHR –")
            fields[f"m340-boarding-{number}-place"] = stop["label"]
            fields[f"m340-boarding-{number}-detail"] = ""
        else:
            fields[f"m340-boarding-{number}-time"] = ""
            fields[f"m340-boarding-{number}-place"] = ""
            fields[f"m340-boarding-{number}-detail"] = ""

    contacts = _contact_slots(normalized["organizationContact"])
    for index, key in enumerate(("pascal", "luca")):
        if len(contacts) > index:
            fields[f"m340-contact-{key}-name"] = contacts[index][0]
            fields[f"m340-contact-{key}-phone"] = contacts[index][1]
        else:
            fields[f"m340-contact-{key}-name"] = ""
            fields[f"m340-contact-{key}-phone"] = ""
    return fields


def _find_id(root: ET.Element, element_id: str) -> ET.Element:
    for element in root.iter():
        if element.get("id") == element_id:
            return element
    raise WorkerError("TEMPLATE_CONTRACT_INVALID")


def _number_attribute(element: ET.Element, name: str) -> float:
    try:
        value = float(element.get(name, ""))
    except ValueError as exc:
        raise WorkerError("TEMPLATE_CONTRACT_INVALID") from exc
    if value <= 0 and name in {"width", "height"}:
        raise WorkerError("TEMPLATE_CONTRACT_INVALID")
    return value


def _svg_dimension(value: str | None) -> float:
    match = re.fullmatch(r"([0-9]+(?:[.][0-9]+)?)(?:px)?", str(value or "").strip())
    if not match:
        raise WorkerError("TEMPLATE_CONTRACT_INVALID")
    return float(match.group(1))


def validate_template_contract(path: Path, kind: str) -> None:
    expected = EXPECTED_TEMPLATE_DIMENSIONS.get(kind.upper())
    if expected is None:
        raise WorkerError("TEMPLATE_CONTRACT_INVALID")
    try:
        raw = path.read_bytes()
    except OSError as exc:
        raise WorkerError("TEMPLATE_CONTRACT_INVALID") from exc
    if not 1000 <= len(raw) <= MAX_TEMPLATE_BYTES or b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise WorkerError("TEMPLATE_CONTRACT_INVALID")
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise WorkerError("TEMPLATE_CONTRACT_INVALID") from exc
    if root.tag.rsplit("}", 1)[-1].lower() != "svg":
        raise WorkerError("TEMPLATE_CONTRACT_INVALID")
    if (_svg_dimension(root.get("width")), _svg_dimension(root.get("height"))) != expected:
        raise WorkerError("TEMPLATE_DIMENSIONS_INVALID")
    try:
        viewbox = tuple(float(part) for part in re.split(r"[ ,]+", root.get("viewBox", "").strip()))
    except ValueError as exc:
        raise WorkerError("TEMPLATE_DIMENSIONS_INVALID") from exc
    if viewbox != (0.0, 0.0, float(expected[0]), float(expected[1])):
        raise WorkerError("TEMPLATE_DIMENSIONS_INVALID")

    forbidden = {"script", "foreignobject", "iframe", "object", "embed", "audio", "video", "link"}
    id_counts: dict[str, int] = {}
    for element in root.iter():
        tag = element.tag.rsplit("}", 1)[-1].lower()
        if tag in forbidden:
            raise WorkerError("TEMPLATE_CONTRACT_INVALID")
        element_id = element.get("id")
        if element_id:
            id_counts[element_id] = id_counts.get(element_id, 0) + 1
        for attribute, value in element.attrib.items():
            local = attribute.rsplit("}", 1)[-1].lower()
            lowered = str(value).strip().lower()
            if local.startswith("on") or "javascript:" in lowered:
                raise WorkerError("TEMPLATE_CONTRACT_INVALID")
            if local == "href":
                if str(value).startswith("#"):
                    continue
                if re.match(r"^data:image/(?:png|jpeg|webp);base64,", str(value), re.IGNORECASE):
                    continue
                raise WorkerError("TEMPLATE_EXTERNAL_RESOURCE")
    if any(id_counts.get(element_id) != 1 for element_id in REQUIRED_TEMPLATE_IDS):
        raise WorkerError("TEMPLATE_CONTRACT_INVALID")
    brush = _find_id(root, "plaerrdeifl-brush-horizontal-proof")
    if brush.tag.rsplit("}", 1)[-1].lower() != "path" or brush.get("transform") or not brush.get("d"):
        raise WorkerError("TEMPLATE_CONTRACT_INVALID")


def _set_display(element: ET.Element, visible: bool) -> None:
    declarations = []
    for raw in str(element.get("style") or "").split(";"):
        item = raw.strip()
        if not item or item.lower().startswith("display:"):
            continue
        declarations.append(item)
    declarations.append("display:inline" if visible else "display:none")
    element.set("style", ";".join(declarations))


def apply_template(
    template_path: Path,
    output_path: Path,
    fields: dict[str, str],
    qr_svg_path: Path,
    qr_url: str,
    document_title: str,
    trip_label_enabled: bool = True,
    kind: str | None = None,
) -> None:
    try:
        tree = ET.parse(template_path)
        root = tree.getroot()
        qr_tree = ET.parse(qr_svg_path)
        qr_root = qr_tree.getroot()
    except (OSError, ET.ParseError) as exc:
        raise WorkerError("TEMPLATE_CONTRACT_INVALID") from exc

    for element_id, value in fields.items():
        element = _find_id(root, element_id)
        element.text = value
        for child in list(element):
            child.text = ""

    label = _find_id(root, "m340-trip-label-text")
    brush = _find_id(root, "plaerrdeifl-brush-horizontal-proof")
    legacy_brush = _find_id(root, "m340-trip-label-brush")
    _set_display(label, trip_label_enabled)
    _set_display(brush, trip_label_enabled)
    _set_display(legacy_brush, False)
    brush.attrib.pop("transform", None)
    legacy_brush.attrib.pop("transform", None)

    slot = _find_id(root, "m340-qr-slot")
    quiet = _find_id(root, "m340-qr-quiet-zone")
    vector = _find_id(root, "m340-qr-vector")
    qr_vector = _find_id(qr_root, "m340-qr-vector")
    viewbox = qr_root.get("viewBox", "").split()
    if len(viewbox) != 4:
        raise WorkerError("QR_RENDER_FAILED")
    try:
        total_width = float(viewbox[2])
        total_height = float(viewbox[3])
    except ValueError as exc:
        raise WorkerError("QR_RENDER_FAILED") from exc
    if total_width <= 0 or total_height <= 0:
        raise WorkerError("QR_RENDER_FAILED")

    x = _number_attribute(quiet, "x")
    y = _number_attribute(quiet, "y")
    width = _number_attribute(quiet, "width")
    height = _number_attribute(quiet, "height")
    qr_path = qr_vector.get("d")
    if not qr_path:
        raise WorkerError("QR_RENDER_FAILED")
    slot.set("data-qr-url", qr_url)
    vector.set("d", qr_path)
    vector.set(
        "transform",
        f"translate({x:.8f} {y:.8f}) scale({width / total_width:.10f} {height / total_height:.10f})",
    )
    vector.set("fill", "#000000")
    vector.set("style", "fill:#000000;stroke:none")

    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] == "title":
            element.text = document_title
            break

    try:
        tree.write(output_path, encoding="utf-8", xml_declaration=True)
    except OSError as exc:
        raise WorkerError("TEMPLATE_RENDER_FAILED") from exc


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as exc:
        raise WorkerError("FILE_IO_FAILED") from exc
    return digest.hexdigest()


def _png_dimensions(path: Path) -> tuple[int, int]:
    try:
        with path.open("rb") as handle:
            header = handle.read(24)
    except OSError as exc:
        raise WorkerError("FILE_IO_FAILED") from exc
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise WorkerError("PNG_INVALID")
    width, height = struct.unpack(">II", header[16:24])
    if width <= 0 or height <= 0:
        raise WorkerError("PNG_INVALID")
    return width, height


def verify_runtime(config: Config) -> None:
    if _sha256(config.font_file) != config.font_sha256:
        raise WorkerError("FONT_HASH_MISMATCH")
    for kind in ("post", "story", "led"):
        path = config.templates_dir / f"{kind}.svg"
        if not path.is_file():
            raise WorkerError("TEMPLATE_CONTRACT_INVALID")
        validate_template_contract(path, kind.upper())
    if not Path(__file__).with_name("qr_bridge.py").is_file():
        raise WorkerError("QR_BRIDGE_MISSING")


def _run_renderer(command: list[str], error_code: str) -> None:
    try:
        completed = subprocess.run(
            command,
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=180,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise WorkerError(error_code) from exc
    if completed.returncode != 0:
        raise WorkerError(error_code)


def _run_renderer_output(command: list[str], error_code: str) -> str:
    try:
        completed = subprocess.run(
            command,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=180,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise WorkerError(error_code) from exc
    if completed.returncode != 0:
        raise WorkerError(error_code)
    return completed.stdout


def _docker_base(config: Config, job_dir: Path) -> list[str]:
    return [
        "docker",
        "run",
        "--rm",
        "--network",
        "none",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit=256",
        "--user",
        f"{os.getuid()}:{os.getgid()}",
        "-e",
        "HOME=/tmp",
        "-v",
        f"{job_dir}:/work",
    ]


def _query_bbox(config: Config, job_dir: Path, filename: str, element_id: str) -> tuple[float, float, float, float]:
    command = _docker_base(config, job_dir) + [
        "-v",
        f"{config.font_file.parent}:/usr/share/fonts/truetype/m340:ro",
        "--entrypoint",
        "inkscape",
        config.renderer_image,
        f"/work/{filename}",
        f"--query-id={element_id}",
        "--query-x",
        "--query-y",
        "--query-width",
        "--query-height",
    ]
    output = _run_renderer_output(command, "TEMPLATE_MEASURE_FAILED")
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    if len(lines) != 4:
        raise WorkerError("TEMPLATE_MEASURE_FAILED")
    try:
        values = tuple(float(value) for value in lines)
    except ValueError as exc:
        raise WorkerError("TEMPLATE_MEASURE_FAILED") from exc
    if not all(value == value and abs(value) < 100_000 for value in values):
        raise WorkerError("TEMPLATE_MEASURE_FAILED")
    return values  # type: ignore[return-value]


def fit_trip_label_brush(config: Config, svg_path: Path) -> None:
    text_x, _, text_width, _ = _query_bbox(config, svg_path.parent, svg_path.name, "m340-trip-label-text")
    brush_x, _, brush_width, _ = _query_bbox(config, svg_path.parent, svg_path.name, "plaerrdeifl-brush-horizontal-proof")
    if text_width <= 0 or brush_width <= 0:
        raise WorkerError("TEMPLATE_MEASURE_FAILED")
    desired_width = text_width + 2 * TRIP_LABEL_BRUSH_PADDING
    if desired_width > brush_width:
        raise WorkerError("TRIP_LABEL_TOO_WIDE")
    scale = max(0.20, min(1.0, desired_width / brush_width))
    try:
        tree = ET.parse(svg_path)
        root = tree.getroot()
    except (OSError, ET.ParseError) as exc:
        raise WorkerError("TEMPLATE_CONTRACT_INVALID") from exc
    brush = _find_id(root, "plaerrdeifl-brush-horizontal-proof")
    center = brush_x + brush_width / 2.0
    brush.set(
        "transform",
        f"translate({center:.6f} 0) scale({scale:.8f} 1) translate({-center:.6f} 0)",
    )
    # Keep measurement metadata technical and local to the generated SVG only.
    brush.set("data-m340-text-width", f"{text_width:.3f}")
    brush.set("data-m340-brush-scale", f"{scale:.6f}")
    try:
        tree.write(svg_path, encoding="utf-8", xml_declaration=True)
    except OSError as exc:
        raise WorkerError("TEMPLATE_RENDER_FAILED") from exc


def _download_custom_template(
    config: Config,
    descriptor: dict[str, Any],
    output_dir: Path,
    kind: str,
) -> Path:
    version_id = str(descriptor.get("versionId") or "")
    resolved = call_edge(config, {"action": "template", "versionId": version_id})
    required = {"environment", "kind", "versionId", "objectName", "filename", "sha256", "bytes", "downloadUrl"}
    if set(resolved) != required:
        raise WorkerError("TEMPLATE_RESOLVE_INVALID")
    if (
        resolved.get("environment") != config.environment
        or resolved.get("kind") != kind
        or resolved.get("versionId") != version_id
        or resolved.get("objectName") != descriptor.get("objectName")
        or resolved.get("filename") != descriptor.get("filename")
        or resolved.get("sha256") != descriptor.get("sha256")
        or resolved.get("bytes") != descriptor.get("bytes")
    ):
        raise WorkerError("TEMPLATE_RESOLVE_INVALID")
    download_url = str(resolved.get("downloadUrl") or "")
    try:
        parsed = urllib.parse.urlsplit(download_url)
    except ValueError as exc:
        raise WorkerError("TEMPLATE_RESOLVE_INVALID") from exc
    if (
        parsed.scheme != "https"
        or parsed.hostname != EXPECTED_EDGE_HOST
        or parsed.username
        or parsed.password
        or not parsed.path.startswith("/storage/v1/object/sign/m340-publishing-templates/")
        or not urllib.parse.parse_qs(parsed.query).get("token")
        or parsed.fragment
    ):
        raise WorkerError("TEMPLATE_RESOLVE_INVALID")

    expected_bytes = int(descriptor["bytes"])
    request = urllib.request.Request(download_url, headers={"User-Agent": "Plaerrdeifl-M340-Worker/1"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read(expected_bytes + 1)
            if response.status != 200:
                raise WorkerError("TEMPLATE_DOWNLOAD_FAILED")
    except urllib.error.HTTPError as exc:
        raise WorkerError("TEMPLATE_DOWNLOAD_FAILED") from exc
    except urllib.error.URLError as exc:
        raise WorkerError("TEMPLATE_DOWNLOAD_FAILED") from exc
    if len(body) != expected_bytes or hashlib.sha256(body).hexdigest() != descriptor["sha256"]:
        raise WorkerError("TEMPLATE_HASH_MISMATCH")
    path = output_dir / f"template-{kind.lower()}.svg"
    try:
        path.write_bytes(body)
    except OSError as exc:
        raise WorkerError("FILE_IO_FAILED") from exc
    validate_template_contract(path, kind)
    return path


def _template_path(config: Config, normalized: dict[str, Any], output_dir: Path, kind: str) -> Path:
    descriptor = normalized["templates"][kind]
    if descriptor["source"] == "SERVER_DEFAULT":
        return config.templates_dir / f"{kind.lower()}.svg"
    return _download_custom_template(config, descriptor, output_dir, kind)


def render_assets(config: Config, snapshot: dict[str, Any], output_dir: Path) -> dict[str, Path]:
    verify_runtime(config)
    normalized = validate_snapshot(snapshot)
    output_dir.mkdir(parents=True, exist_ok=True)
    qr_url = config.public_base_url + normalized["shortlinkPath"]
    if not qr_url.isascii() or len(qr_url) > 512:
        raise WorkerError("QR_RENDER_FAILED")

    bridge_dir = Path(__file__).resolve().parent
    qr_command = _docker_base(config, output_dir) + [
        "-v",
        f"{bridge_dir}:/worker:ro",
        "--entrypoint",
        "python3",
        config.renderer_image,
        "/worker/qr_bridge.py",
        "--text",
        qr_url,
        "--output",
        "/work/qr.svg",
    ]
    _run_renderer(qr_command, "QR_RENDER_FAILED")

    fields = build_text_fields(normalized)
    title = f"Plärrdeifl Fanbus – {normalized['displayName']} {normalized['eventDate'].strftime('%d.%m.%Y')}"
    label_enabled = normalized["tripLabel"]["enabled"]
    for kind in ("POST", "STORY", "LED"):
        output_svg = output_dir / f"{kind.lower()}.svg"
        apply_template(
            _template_path(config, normalized, output_dir, kind),
            output_svg,
            fields,
            output_dir / "qr.svg",
            qr_url,
            title,
            trip_label_enabled=label_enabled,
            kind=kind,
        )
        if label_enabled:
            fit_trip_label_brush(config, output_svg)

    font_dir = config.font_file.parent
    for kind in ARTIFACTS:
        command = _docker_base(config, output_dir) + [
            "-v",
            f"{font_dir}:/usr/share/fonts/truetype/m340:ro",
            "--entrypoint",
            "inkscape",
            config.renderer_image,
            f"/work/{kind}.svg",
            "--export-type=png",
            f"--export-filename=/work/{kind}.png",
        ]
        _run_renderer(command, "QR_RENDER_FAILED" if kind == "qr" else "TEMPLATE_RENDER_FAILED")
        png = output_dir / f"{kind}.png"
        if not png.is_file() or png.stat().st_size <= 0:
            raise WorkerError("TEMPLATE_RENDER_FAILED")
        if _png_dimensions(png) != EXPECTED_PNG_DIMENSIONS[kind]:
            raise WorkerError("PNG_DIMENSIONS_INVALID")

    return {kind: output_dir / f"{kind}.png" for kind in ARTIFACTS}

def _remote_path(path: str, required_root: str = "/Fanbus") -> str:
    if (
        not path.startswith(required_root + "/")
        or ".." in path
        or "\\" in path
        or "?" in path
        or "#" in path
        or len(path) > 500
    ):
        raise WorkerError("NEXTCLOUD_PATH_INVALID")
    return path


def _webdav_url(config: Config, remote_path: str) -> str:
    _remote_path(remote_path)
    encoded = urllib.parse.quote(remote_path.lstrip("/"), safe="/")
    return config.nextcloud_webdav_base.rstrip("/") + "/" + encoded


def _webdav_request(
    config: Config,
    method: str,
    remote_path: str,
    expected_statuses: set[int],
    data: bytes | None = None,
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, bytes]:
    password = read_secret(config.nextcloud_password_file, 1)
    credentials = base64.b64encode(
        f"{config.nextcloud_username}:{password}".encode("utf-8")
    ).decode("ascii")
    headers = {"Authorization": f"Basic {credentials}", "User-Agent": "Plaerrdeifl-M340-Worker/1"}
    if extra_headers:
        headers.update(extra_headers)
    request = urllib.request.Request(
        _webdav_url(config, remote_path),
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read(1_048_577)
            status = response.status
    except urllib.error.HTTPError as exc:
        status = exc.code
        body = b""
        if status not in expected_statuses:
            if status in {401, 403}:
                raise WorkerError("NEXTCLOUD_AUTH_FAILED") from exc
            raise WorkerError("NEXTCLOUD_UPLOAD_FAILED") from exc
    except urllib.error.URLError as exc:
        raise WorkerError("NEXTCLOUD_UPLOAD_FAILED") from exc
    if status not in expected_statuses or len(body) > 1_048_576:
        raise WorkerError("NEXTCLOUD_UPLOAD_FAILED")
    return status, body


def _public_share(config: Config, remote_path: str) -> tuple[str, str]:
    remote = _remote_path(remote_path)
    password = read_secret(config.nextcloud_password_file, 1)
    credentials = base64.b64encode(
        f"{config.nextcloud_username}:{password}".encode("utf-8")
    ).decode("ascii")
    payload = urllib.parse.urlencode({
        "path": remote,
        "shareType": "3",
        "permissions": "1",
        "label": f"Fanbus Flyer {Path(remote).name}",
    }).encode("utf-8")
    request = urllib.request.Request(
        NEXTCLOUD_SHARE_API + "?format=json",
        data=payload,
        headers={
            "Authorization": f"Basic {credentials}",
            "OCS-APIRequest": "true",
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Plaerrdeifl-M340-Worker/1",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read(1_048_577)
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            raise WorkerError("NEXTCLOUD_AUTH_FAILED") from exc
        raise WorkerError("NEXTCLOUD_SHARE_FAILED") from exc
    except urllib.error.URLError as exc:
        raise WorkerError("NEXTCLOUD_SHARE_FAILED") from exc
    try:
        body = json.loads(raw.decode("utf-8"))
        meta = body["ocs"]["meta"]
        if int(meta.get("statuscode", 0)) != 200:
            raise ValueError("OCS share creation failed")
        share_url = str(body["ocs"]["data"]["url"]).rstrip("/")
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise WorkerError("NEXTCLOUD_SHARE_FAILED") from exc
    if not re.fullmatch(r"https://cloud[.]plaerrdeifl[.]de/s/[A-Za-z0-9]{8,128}", share_url):
        raise WorkerError("NEXTCLOUD_SHARE_FAILED")
    return share_url, share_url + "/download"


def _mkcol(config: Config, remote_path: str) -> None:
    _webdav_request(config, "MKCOL", remote_path, {201, 405})


def _ensure_collection_chain(config: Config, remote_path: str) -> None:
    _remote_path(remote_path)
    parts = remote_path.strip("/").split("/")
    if not parts or parts[0] != "Fanbus":
        raise WorkerError("NEXTCLOUD_PATH_INVALID")
    current = "/Fanbus"
    for part in parts[1:]:
        current += "/" + part
        _mkcol(config, current)


def _load_job_state(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise WorkerError("LOCAL_STATE_INVALID") from exc
    if not isinstance(state, dict):
        raise WorkerError("LOCAL_STATE_INVALID")
    return state


def _write_job_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    try:
        temporary.write_text(json.dumps(state, sort_keys=True) + "\n", encoding="utf-8")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    except OSError as exc:
        raise WorkerError("LOCAL_STATE_INVALID") from exc


def select_generation(
    config: Config,
    normalized: dict[str, Any],
    job_dir: Path,
) -> tuple[str, str]:
    folder = f"{normalized['eventDate'].isoformat()}_{normalized['slug']}"
    base = f"{config.nextcloud_root}/{folder}"
    state_path = job_dir / "state.json"
    state = _load_job_state(state_path)
    if state is not None:
        if (
            state.get("schemaVersion") != 1
            or state.get("base") != base
            or not isinstance(state.get("generation"), str)
            or re.fullmatch(r"generation-\d{3}", state["generation"]) is None
        ):
            raise WorkerError("LOCAL_STATE_INVALID")
        return base, state["generation"]

    _ensure_collection_chain(config, base)
    _, body = _webdav_request(
        config,
        "PROPFIND",
        base,
        {207},
        extra_headers={"Depth": "1"},
    )
    numbers = [int(value) for value in re.findall(rb"generation-(\d{3})", body)]
    number = max(numbers, default=0) + 1
    if number > 999:
        raise WorkerError("GENERATION_LIMIT_REACHED")
    generation = f"generation-{number:03d}"
    _write_job_state(
        state_path,
        {"schemaVersion": 1, "base": base, "generation": generation},
    )
    return base, generation


def _put_file(config: Config, local: Path, remote: str) -> None:
    try:
        data = local.read_bytes()
    except OSError as exc:
        raise WorkerError("FILE_IO_FAILED") from exc
    content_type = "image/png" if local.suffix == ".png" else "image/svg+xml"
    _webdav_request(
        config,
        "PUT",
        remote,
        {201, 204},
        data=data,
        extra_headers={"Content-Type": content_type},
    )


def build_manifest(
    pngs: dict[str, Path],
    remote_generation: str,
    shares: dict[str, tuple[str, str]],
) -> dict[str, Any]:
    artifacts: list[dict[str, Any]] = []
    for kind, api_kind in (("qr", "QR"), ("post", "POST"), ("story", "STORY"), ("led", "LED")):
        path = pngs[kind]
        size = path.stat().st_size
        share_url, download_url = shares[kind]
        if size <= 0 or size > 104_857_600:
            raise WorkerError("MANIFEST_INVALID")
        if not re.fullmatch(r"https://cloud[.]plaerrdeifl[.]de/s/[A-Za-z0-9]{8,128}", share_url):
            raise WorkerError("MANIFEST_INVALID")
        if download_url != share_url + "/download":
            raise WorkerError("MANIFEST_INVALID")
        artifacts.append(
            {
                "kind": api_kind,
                "filename": f"{kind}.png",
                "nextcloudPath": _remote_path(f"{remote_generation}/{kind}.png"),
                "sha256": _sha256(path),
                "bytes": size,
                "shareUrl": share_url,
                "downloadUrl": download_url,
            }
        )
    return {"schemaVersion": 1, "artifacts": artifacts}


def process_job(config: Config, job: dict[str, Any]) -> dict[str, Any]:
    normalized = validate_snapshot(job["request"])
    job_dir = config.work_dir / "jobs" / job["jobId"]
    pngs = render_assets(config, job["request"], job_dir)
    base, generation = select_generation(config, normalized, job_dir)
    generation_path = f"{base}/{generation}"
    current_path = f"{base}/current"
    _ensure_collection_chain(config, generation_path)
    _ensure_collection_chain(config, current_path)

    for kind in ARTIFACTS:
        for extension in ("svg", "png"):
            local = job_dir / f"{kind}.{extension}"
            _put_file(config, local, f"{generation_path}/{kind}.{extension}")

    for kind in ARTIFACTS:
        for extension in ("svg", "png"):
            local = job_dir / f"{kind}.{extension}"
            _put_file(config, local, f"{current_path}/{kind}.{extension}")

    shares = {
        kind: _public_share(config, f"{generation_path}/{kind}.png")
        for kind in ARTIFACTS
    }
    return build_manifest(pngs, generation_path, shares)


def _failure_code(exc: BaseException) -> str:
    return exc.code if isinstance(exc, WorkerError) else "WORKER_INTERNAL"


def run_once(config: Config) -> bool:
    job = claim(config)
    if job is None:
        return False
    try:
        manifest = process_job(config, job)
        complete(config, job, True, None, manifest)
        logging.info("M340 job %s completed", job["jobId"])
    except Exception as exc:  # lease/retry contract covers ordinary worker failures
        code = _failure_code(exc)
        logging.error("M340 job %s failed with %s", job["jobId"], code)
        try:
            complete(config, job, False, code, None)
        except Exception:
            logging.error("M340 job %s failure completion could not be delivered", job["jobId"])
    return True


def run_forever(config: Config) -> None:
    while True:
        try:
            run_once(config)
        except Exception as exc:
            logging.error("M340 poll failed with %s", _failure_code(exc))
        time.sleep(config.poll_seconds)


def render_fixture(config: Config, fixture_path: Path, output_dir: Path) -> None:
    try:
        snapshot = json.loads(fixture_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise WorkerError("SNAPSHOT_INVALID") from exc
    if not isinstance(snapshot, dict):
        raise WorkerError("SNAPSHOT_INVALID")
    render_assets(config, snapshot, output_dir)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--render-fixture")
    parser.add_argument("--output-dir")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        config = load_config(Path(args.config))
        if args.render_fixture:
            if not args.output_dir:
                raise WorkerError("CONFIG_INVALID")
            render_fixture(config, Path(args.render_fixture), Path(args.output_dir))
            return 0
        verify_runtime(config)
        if args.once:
            run_once(config)
        else:
            run_forever(config)
        return 0
    except WorkerError as exc:
        logging.error("M340 worker stopped with %s", exc.code)
        return 1
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
