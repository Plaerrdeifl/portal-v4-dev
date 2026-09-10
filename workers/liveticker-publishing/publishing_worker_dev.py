#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import logging
import base64
import binascii
import json
import os
import urllib.error
import urllib.request
import sys
import time
from pathlib import Path

BASE_WORKER = Path('/srv/docker/liveticker/worker/publishing_worker.py')
DEV_ROOT = Path('/srv/docker/liveticker/dev')
DEV_WORK = DEV_ROOT / 'work'
DEV_JOBS = DEV_WORK / 'jobs'
DEV_TOKEN = DEV_ROOT / 'secrets' / 'worker_token'
DEV_EDGE_URL = 'https://tpieykhhawszlzsoflnl.supabase.co/functions/v1/liveticker-publishing-worker'
DEV_NEXTCLOUD_ROOT = '/Liveticker/_DEV'
DEV_RENDERER = DEV_ROOT / 'worker' / 'render_v1.py'
DEV_EDGE_MAX_BYTES = 4 * 1024 * 1024

spec = importlib.util.spec_from_file_location('liveticker_publishing_base', BASE_WORKER)
if spec is None or spec.loader is None:
    raise SystemExit('DEV_WORKER_IMPORT_FAILED')
base = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = base
spec.loader.exec_module(base)

base.WORK = DEV_WORK
base.JOBS = DEV_JOBS
base.WORKER_TOKEN_FILE = DEV_TOKEN
base.EDGE_URL = DEV_EDGE_URL
base.NEXTCLOUD_ROOT = DEV_NEXTCLOUD_ROOT
base.RENDERER = DEV_RENDERER


def edge_dev(payload: dict) -> dict:
    token = base.read_secret(base.WORKER_TOKEN_FILE, 32)
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    request = urllib.request.Request(
        base.EDGE_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            base.WORKER_HEADER: token,
            "User-Agent": "Plaerrdeifl-Liveticker-DEV-Worker/1",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read(DEV_EDGE_MAX_BYTES + 1)
            status = response.status
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            raise base.WorkerError("EDGE_AUTH_FAILED") from exc
        raise base.WorkerError("EDGE_HTTP_FAILED") from exc
    except urllib.error.URLError as exc:
        raise base.WorkerError("EDGE_NETWORK_FAILED") from exc
    if status != 200 or len(raw) > DEV_EDGE_MAX_BYTES:
        raise base.WorkerError("EDGE_RESPONSE_INVALID")
    try:
        decoded = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise base.WorkerError("EDGE_RESPONSE_INVALID") from exc
    if not isinstance(decoded, dict) or decoded.get("ok") is not True or not isinstance(decoded.get("data"), dict):
        raise base.WorkerError("EDGE_RESPONSE_INVALID")
    return decoded["data"]


base.edge = edge_dev


def snapshot_logo_path_dev(team: dict, logo_dir: Path, label: str) -> Path:
    encoded = team.get("logoDataBase64")
    mime = str(team.get("logoMime") or "").lower()
    if isinstance(encoded, str) and encoded.strip():
        if mime not in base.LOGO_EXTENSIONS:
            raise base.WorkerError("TEAM_LOGO_MIME_INVALID")
        compact = "".join(encoded.split())
        try:
            data = base64.b64decode(compact, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise base.WorkerError("TEAM_LOGO_DATA_INVALID") from exc
        if not data or len(data) > 1024 * 1024:
            raise base.WorkerError("TEAM_LOGO_SIZE_INVALID")
        valid = (
            (mime == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n"))
            or (mime == "image/jpeg" and data.startswith(b"\xff\xd8\xff"))
            or (mime == "image/webp" and data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP")
        )
        if not valid:
            raise base.WorkerError("TEAM_LOGO_DATA_INVALID")
        logo_dir.mkdir(parents=True, exist_ok=True)
        path = logo_dir / f"{label}{base.LOGO_EXTENSIONS[mime]}"
        path.write_bytes(data)
        os.chmod(path, 0o600)
        return path
    asset_path = team.get("logoAssetPath")
    if not isinstance(asset_path, str) or not asset_path.strip():
        raise base.WorkerError("TEAM_LOGO_MISSING")
    return base.local_logo_path(asset_path)


base.snapshot_logo_path = snapshot_logo_path_dev


def dev_remote_path(path: str) -> str:
    if (
        path != DEV_NEXTCLOUD_ROOT
        and not path.startswith(DEV_NEXTCLOUD_ROOT + '/')
    ) or '..' in path or '\\' in path or '?' in path or '#' in path:
        raise base.WorkerError('NEXTCLOUD_PATH_INVALID')
    return path


base.remote_path = dev_remote_path


def claim_dev():
    result = base.edge({'action': 'claim'})
    if result.get('claimed') is False:
        return None
    job = result.get('job')
    if result.get('claimed') is not True or not isinstance(job, dict):
        raise base.WorkerError('CLAIM_INVALID')
    required = {'jobId', 'claimToken', 'environment', 'attemptCount', 'claimExpiresAt', 'request'}
    if set(job) != required or job.get('environment') != 'DEV' or not isinstance(job.get('request'), dict):
        raise base.WorkerError('CLAIM_INVALID')
    return job


def run_once_dev() -> bool:
    job = claim_dev()
    if job is None:
        logging.info('no pending DEV jobs')
        return False
    started = time.monotonic()
    try:
        manifest = base.process_job(job)
        base.complete(job, True, None, manifest)
        logging.info(
            'DEV graphic job %s completed (%s) in %.2fs',
            job['jobId'], job['request'].get('kind'), time.monotonic() - started,
        )
    except Exception as exc:
        code = exc.code if isinstance(exc, base.WorkerError) else 'WORKER_INTERNAL'
        logging.exception('DEV graphic job %s failed with %s', job.get('jobId'), code)
        try:
            base.complete(job, False, code, None)
        except Exception:
            logging.exception('completion of failed DEV job %s could not be delivered', job.get('jobId'))
    return True


def control_dev() -> dict:
    result = base.edge({'action': 'control'})
    required = {'workerCode', 'enabled', 'state', 'activePollSeconds', 'disabledPollSeconds'}
    if set(result) != required:
        raise base.WorkerError('CONTROL_INVALID')
    if result.get('workerCode') != 'LIVETICKER_GRAPHICS':
        raise base.WorkerError('CONTROL_INVALID')
    if not isinstance(result.get('enabled'), bool):
        raise base.WorkerError('CONTROL_INVALID')
    if result.get('activePollSeconds') != 5 or result.get('disabledPollSeconds') != 60:
        raise base.WorkerError('CONTROL_INVALID')
    return result


def main() -> int:
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    DEV_JOBS.mkdir(parents=True, exist_ok=True)
    while True:
        sleep_seconds = 60
        try:
            control = control_dev()
            if control['enabled']:
                run_once_dev()
                sleep_seconds = 5
            else:
                sleep_seconds = 60
        except Exception as exc:
            code = exc.code if isinstance(exc, base.WorkerError) else 'WORKER_INTERNAL'
            logging.error('DEV poll failed with %s', code)
        time.sleep(sleep_seconds)


if __name__ == '__main__':
    raise SystemExit(main())
