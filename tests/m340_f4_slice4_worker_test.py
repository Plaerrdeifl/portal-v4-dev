from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKER_DIR = ROOT / "workers" / "m340-publishing"
WORKER_PATH = WORKER_DIR / "worker.py"
QR_BRIDGE_PATH = WORKER_DIR / "qr_bridge.py"
CONFIG_PATH = WORKER_DIR / "config.dev.example.json"
SERVICE_PATH = WORKER_DIR / "m340-publishing-worker.service"

spec = importlib.util.spec_from_file_location("m340_worker", WORKER_PATH)
assert spec is not None and spec.loader is not None
worker = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = worker
spec.loader.exec_module(worker)


def snapshot(stops: int = 2):
    boarding = [
        {
            "id": "00000000-0000-4000-8000-000000000101",
            "tripBoardingStopId": "00000000-0000-4000-8000-000000000101",
            "boardingStopId": "00000000-0000-4000-8000-000000000201",
            "label": "Münnerstadt",
            "address": "Testweg 1",
            "defaultNote": "Pendlerparkplatz",
            "departureAt": "2026-10-03T09:30:00+00:00",
            "tripNote": None,
            "position": 1,
        },
        {
            "id": "00000000-0000-4000-8000-000000000102",
            "tripBoardingStopId": "00000000-0000-4000-8000-000000000102",
            "boardingStopId": "00000000-0000-4000-8000-000000000202",
            "label": "Schweinfurt",
            "address": "Testweg 2",
            "defaultNote": "Icedome",
            "departureAt": "2026-10-03T10:00:00+00:00",
            "tripNote": None,
            "position": 2,
        },
        {
            "id": "00000000-0000-4000-8000-000000000103",
            "tripBoardingStopId": "00000000-0000-4000-8000-000000000103",
            "boardingStopId": "00000000-0000-4000-8000-000000000203",
            "label": "Dritter Zustieg",
            "address": "Testweg 3",
            "defaultNote": "Nur Test",
            "departureAt": "2026-10-03T10:15:00+00:00",
            "tripNote": None,
            "position": 3,
        },
    ][:stops]
    return {
        "schemaVersion": 1,
        "shortlinkPath": "/ontour/landsberg",
        "place": {
            "id": "00000000-0000-4000-8000-000000000001",
            "slug": "landsberg",
            "displayName": "Landsberg",
        },
        "trip": {
            "tripId": "00000000-0000-4000-8000-000000000002",
            "tripStatus": "PUBLISHED",
            "eventType": "GAME",
            "displayTitle": "Testgegner – Mighty Dogs Schweinfurt",
            "eventDate": "2026-10-03",
            "eventTime": "18:00:00",
            "venue": "Landsberg",
            "departureAt": "2026-10-03T09:30:00+00:00",
            "departureInfo": "Test",
            "registrationOpensAt": "2026-09-01T10:00:00+00:00",
            "registrationClosesAt": "2026-09-30T18:00:00+00:00",
            "priceCents": 2500,
            "capacity": 50,
            "activeRegistrationCount": 1,
            "remainingCapacity": 49,
            "registrationStatus": "OPEN",
            "organizationContact": {
                "primary": {"name": "Plärrdeifl", "phone": "+49 000 000"},
                "contacts": [
                    {"name": "Pascal", "phone": "+49 111 111"},
                    {"name": "Luca", "phone": "+49 222 222"},
                ],
            },
        },
        "boardingStops": boarding,
    }


def snapshot_v2(label_text: str = "AUSWÄRTSFAHRT", enabled: bool = True, custom: bool = False):
    value = snapshot()
    value["schemaVersion"] = 2
    templates = [
        {"kind": "POST", "source": "SERVER_DEFAULT"},
        {"kind": "STORY", "source": "SERVER_DEFAULT"},
        {"kind": "LED", "source": "SERVER_DEFAULT"},
    ]
    if custom:
        templates[0] = {
            "kind": "POST",
            "source": "CUSTOM",
            "versionId": "00000000-0000-4000-8000-000000000301",
            "objectName": "versions/dev/00000000-0000-4000-8000-000000000302/00000000-0000-4000-8000-000000000301.svg",
            "filename": "post-neu.svg",
            "sha256": "a" * 64,
            "bytes": 123456,
        }
    value["publishing"] = {
        "settings": {"tripLabel": {"enabled": enabled, "text": label_text}},
        "templates": templates,
    }
    return value


class ConfigTests(unittest.TestCase):
    def test_dev_example_is_locked_to_frozen_endpoints(self):
        config = worker.load_config(CONFIG_PATH)
        self.assertEqual(config.environment, "DEV")
        self.assertEqual(config.edge_url, "https://tpieykhhawszlzsoflnl.supabase.co/functions/v1/m340-publishing-worker")
        self.assertEqual(config.public_base_url, "https://staging.plaerrdeifl.de")
        self.assertEqual(config.nextcloud_root, "/Fanbus/_DEV")
        self.assertEqual(config.poll_seconds, 30)
        self.assertEqual(config.renderer_image, worker.EXPECTED_RENDERER)
        self.assertEqual(config.font_sha256, worker.EXPECTED_FONT_SHA256)

    def test_prod_or_wrong_hosts_are_rejected(self):
        raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        cases = [
            ("environment", "PROD"),
            ("edgeUrl", "https://example.invalid/functions/v1/m340-publishing-worker"),
            ("publicBaseUrl", "https://plaerrdeifl.de"),
            ("nextcloudRoot", "/Fanbus"),
            ("nextcloudWebdavBase", "https://cloud.plaerrdeifl.de/remote.php/dav/files/other"),
            ("pollSeconds", 29),
        ]
        for key, value in cases:
            with self.subTest(key=key):
                candidate = dict(raw)
                candidate[key] = value
                with tempfile.TemporaryDirectory() as tmp:
                    path = Path(tmp) / "config.json"
                    path.write_text(json.dumps(candidate), encoding="utf-8")
                    with self.assertRaises(worker.WorkerError) as caught:
                        worker.load_config(path)
                    self.assertEqual(caught.exception.code, "CONFIG_INVALID")


class SnapshotTests(unittest.TestCase):
    def test_snapshot_drives_all_flyer_text_without_second_business_logic(self):
        normalized = worker.validate_snapshot(snapshot())
        fields = worker.build_text_fields(normalized)
        self.assertEqual(fields["m340-destination"], "LANDSBERG")
        self.assertEqual(fields["m340-trip-label-text"], "FANBUSFAHRT")
        self.assertEqual(fields["text34"], "SAMSTAG")
        self.assertEqual(fields["m340-date"], "03.10.2026")
        self.assertEqual(fields["m340-game-start"], "18:00 UHR")
        self.assertEqual(fields["m340-price"], "25 €")
        self.assertEqual(fields["m340-registration-deadline-date"], "30.09.2026,")
        self.assertEqual(fields["m340-registration-deadline-time"], "20:00 UHR")
        self.assertEqual(fields["m340-boarding-1-time"], "11:30 UHR –")
        self.assertEqual(fields["m340-boarding-1-place"], "Münnerstadt")
        self.assertEqual(fields["m340-boarding-1-detail"], "")
        self.assertEqual(fields["m340-boarding-2-time"], "12:00 UHR –")
        self.assertEqual(fields["m340-contact-pascal-name"], "Pascal")
        self.assertEqual(fields["m340-contact-luca-name"], "Luca")

    def test_more_than_two_boarding_stops_fails_closed(self):
        with self.assertRaises(worker.WorkerError) as caught:
            worker.validate_snapshot(snapshot(3))
        self.assertEqual(caught.exception.code, "SNAPSHOT_UNSUPPORTED_STOPS")

    def test_shortlink_must_match_place_slug(self):
        value = snapshot()
        value["shortlinkPath"] = "/ontour/other"
        with self.assertRaises(worker.WorkerError) as caught:
            worker.validate_snapshot(value)
        self.assertEqual(caught.exception.code, "SNAPSHOT_INVALID")


    def test_snapshot_v2_freezes_label_and_template_version(self):
        normalized = worker.validate_snapshot(snapshot_v2(custom=True))
        self.assertEqual(normalized["schemaVersion"], 2)
        self.assertEqual(normalized["tripLabel"], {"enabled": True, "text": "AUSWÄRTSFAHRT"})
        self.assertEqual(normalized["templates"]["POST"]["source"], "CUSTOM")
        self.assertEqual(normalized["templates"]["POST"]["sha256"], "a" * 64)
        self.assertEqual(worker.build_text_fields(normalized)["m340-trip-label-text"], "AUSWÄRTSFAHRT")

    def test_snapshot_v1_keeps_frozen_default_label_and_server_templates(self):
        normalized = worker.validate_snapshot(snapshot())
        self.assertEqual(normalized["tripLabel"], {"enabled": True, "text": "FANBUSFAHRT"})
        self.assertEqual({entry["source"] for entry in normalized["templates"].values()}, {"SERVER_DEFAULT"})

    def test_snapshot_v2_rejects_invalid_label_and_incomplete_template_set(self):
        value = snapshot_v2(label_text="X" * 33)
        with self.assertRaises(worker.WorkerError):
            worker.validate_snapshot(value)
        value = snapshot_v2()
        value["publishing"]["templates"].pop()
        with self.assertRaises(worker.WorkerError):
            worker.validate_snapshot(value)


class TemplateTests(unittest.TestCase):
    def test_template_replacement_and_qr_embedding(self):
        fields = worker.build_text_fields(worker.validate_snapshot(snapshot()))
        ids = "".join(f'<text id="{element_id}">OLD</text>' for element_id in fields)
        template = (
            '<svg xmlns="http://www.w3.org/2000/svg">'
            '<title>OLD TITLE</title>'
            f'{ids}'
            '<rect id="m340-trip-label-brush" x="120" y="441" width="840" height="80" style="display:none"/>'
            '<g id="m340-qr-slot" data-qr-url="old">'
            '<rect id="m340-qr-quiet-zone" x="10" y="20" width="100" height="100"/>'
            '<path id="m340-qr-vector" d="OLD"/>'
            '</g></svg>'
        )
        qr = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">'
            '<path id="m340-qr-vector" d="M4 4h1v1h-1z"/>'
            '</svg>'
        )
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            template_path = tmp / "template.svg"
            qr_path = tmp / "qr.svg"
            output_path = tmp / "out.svg"
            template_path.write_text(template, encoding="utf-8")
            qr_path.write_text(qr, encoding="utf-8")
            worker.apply_template(
                template_path,
                output_path,
                fields,
                qr_path,
                "https://staging.plaerrdeifl.de/ontour/landsberg",
                "Test title",
            )
            root = ET.parse(output_path).getroot()
            by_id = {element.get("id"): element for element in root.iter() if element.get("id")}
            self.assertEqual(by_id["m340-destination"].text, "LANDSBERG")
            self.assertEqual(by_id["m340-trip-label-text"].text, "FANBUSFAHRT")
            self.assertEqual(
                by_id["m340-qr-slot"].get("data-qr-url"),
                "https://staging.plaerrdeifl.de/ontour/landsberg",
            )
            self.assertEqual(by_id["m340-qr-vector"].get("d"), "M4 4h1v1h-1z")
            self.assertIn("scale(2.0000000000 2.0000000000)", by_id["m340-qr-vector"].get("transform", ""))
            self.assertIn("display:inline", by_id["m340-trip-label-text"].get("style", ""))
            self.assertIn("display:inline", by_id["m340-trip-label-brush"].get("style", ""))


    def test_disabled_trip_label_hides_text_and_brush_together(self):
        fields = worker.build_text_fields(worker.validate_snapshot(snapshot_v2(enabled=False)))
        ids = "".join(f'<text id="{element_id}">OLD</text>' for element_id in fields)
        template = (
            '<svg xmlns="http://www.w3.org/2000/svg"><title>T</title>'
            f'{ids}<rect id="m340-trip-label-brush" x="120" y="441" width="840" height="80"/>'
            '<g id="m340-qr-slot"><rect id="m340-qr-quiet-zone" x="1" y="1" width="10" height="10"/>'
            '<path id="m340-qr-vector" d="OLD"/></g></svg>'
        )
        qr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path id="m340-qr-vector" d="M0 0h1v1z"/></svg>'
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source, qr_path, output = tmp / "post.svg", tmp / "qr.svg", tmp / "out.svg"
            source.write_text(template, encoding="utf-8")
            qr_path.write_text(qr, encoding="utf-8")
            worker.apply_template(source, output, fields, qr_path, "https://staging.plaerrdeifl.de/ontour/landsberg", "T", trip_label_enabled=False)
            root = ET.parse(output).getroot()
            by_id = {element.get("id"): element for element in root.iter() if element.get("id")}
            self.assertIn("display:none", by_id["m340-trip-label-text"].get("style", ""))
            self.assertIn("display:none", by_id["m340-trip-label-brush"].get("style", ""))


class PngTests(unittest.TestCase):
    def test_png_dimensions_are_read_from_ihdr(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "image.png"
            path.write_bytes(
                b"\x89PNG\r\n\x1a\n"
                + b"\x00\x00\x00\x0dIHDR"
                + (1080).to_bytes(4, "big")
                + (1350).to_bytes(4, "big")
            )
            self.assertEqual(worker._png_dimensions(path), (1080, 1350))

    def test_invalid_png_header_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.png"
            path.write_bytes(b"not-a-png")
            with self.assertRaises(worker.WorkerError) as caught:
                worker._png_dimensions(path)
            self.assertEqual(caught.exception.code, "PNG_INVALID")


class ManifestTests(unittest.TestCase):
    def test_manifest_is_exactly_four_png_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            pngs = {}
            for index, kind in enumerate(worker.ARTIFACTS, start=1):
                path = tmp / f"{kind}.png"
                path.write_bytes(b"png" + bytes([index]))
                pngs[kind] = path
            shares = {
                kind: (f"https://cloud.plaerrdeifl.de/s/TestShare{index:02d}", f"https://cloud.plaerrdeifl.de/s/TestShare{index:02d}/download")
                for index, kind in enumerate(worker.ARTIFACTS, start=1)
            }
            manifest = worker.build_manifest(
                pngs,
                "/Fanbus/_DEV/2026-10-03_landsberg/generation-001",
                shares,
            )
            self.assertEqual(manifest["schemaVersion"], 1)
            self.assertEqual([item["kind"] for item in manifest["artifacts"]], ["QR", "POST", "STORY", "LED"])
            self.assertEqual(len(manifest["artifacts"]), 4)
            for item in manifest["artifacts"]:
                self.assertRegex(item["sha256"], r"^[0-9a-f]{64}$")
                self.assertTrue(item["nextcloudPath"].startswith("/Fanbus/_DEV/"))
                self.assertTrue(item["filename"].endswith(".png"))
                self.assertRegex(item["shareUrl"], r"^https://cloud\.plaerrdeifl\.de/s/[A-Za-z0-9]{8,128}$")
                self.assertEqual(item["downloadUrl"], item["shareUrl"] + "/download")

    def test_remote_path_rejects_traversal_and_urls(self):
        invalid = [
            "/Fanbus/_DEV/../x.png",
            "https://cloud.plaerrdeifl.de/Fanbus/x.png",
            "/Fanbus/_DEV/x.png?download=1",
            "/Fanbus/_DEV/x\\y.png",
        ]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(worker.WorkerError):
                worker._remote_path(value)

    def test_collection_chain_skips_protected_fanbus_root(self):
        config = worker.load_config(CONFIG_PATH)
        created = []
        original = worker._mkcol
        worker._mkcol = lambda _config, path: created.append(path)
        try:
            worker._ensure_collection_chain(
                config,
                "/Fanbus/_DEV/2026-10-03_landsberg/generation-001",
            )
        finally:
            worker._mkcol = original

        self.assertEqual(created[0], "/Fanbus/_DEV")
        self.assertNotIn("/Fanbus", created)
        self.assertEqual(created[-1], "/Fanbus/_DEV/2026-10-03_landsberg/generation-001")


class ContractTests(unittest.TestCase):
    def test_qr_bridge_uses_only_pinned_inkscape_encoder(self):
        source = QR_BRIDGE_PATH.read_text(encoding="utf-8")
        self.assertIn("/usr/share/inkscape/extensions/render_barcode_qrcode.py", source)
        self.assertNotIn("import qrcode", source)
        self.assertNotIn("requests", source)
        self.assertNotIn("urllib", source)
        self.assertIn("margin = 4", source)
        self.assertIn("getMinimumQRCode", source)

    def test_worker_is_outbound_only_and_generation_precedes_current(self):
        source = WORKER_PATH.read_text(encoding="utf-8")
        self.assertIn('WORKER_HEADER = "X-M340-Worker-Token"', source)
        self.assertIn('"action": "claim"', source)
        self.assertIn('"action": "complete"', source)
        self.assertIn('"--network",\n        "none"', source)
        self.assertNotIn("socket.listen", source)
        self.assertNotIn("HTTPServer", source)
        generation_upload = source.index('_put_file(config, local, f"{generation_path}/{kind}.{extension}")')
        current_upload = source.index('_put_file(config, local, f"{current_path}/{kind}.{extension}")')
        self.assertLess(generation_upload, current_upload)
        self.assertIn("time.sleep(config.poll_seconds)", source)

    def test_systemd_unit_runs_as_benny_without_inbound_listener(self):
        service = SERVICE_PATH.read_text(encoding="utf-8")
        self.assertIn("User=benny", service)
        self.assertIn("SupplementaryGroups=docker", service)
        self.assertIn("NoNewPrivileges=true", service)
        self.assertIn("ProtectSystem=strict", service)
        self.assertIn("ReadWritePaths=/srv/docker/m340/work", service)
        self.assertNotIn("ListenStream", service)
        self.assertNotIn("Environment=M340_WORKER_TOKEN", service)


if __name__ == "__main__":
    unittest.main()
