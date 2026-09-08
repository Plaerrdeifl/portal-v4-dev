#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import logging
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path('/srv/docker/liveticker')
WORK = ROOT / 'work'
JOBS = WORK / 'jobs'
RENDERER = ROOT / 'worker' / 'render_v1.py'
NEXTCLOUD_SECRET = ROOT / 'secrets' / 'nextcloud_app_password'
WORKER_TOKEN_FILE = ROOT / 'secrets' / 'worker_token'
NEXTCLOUD_USER = 'liveticker-prod'
NEXTCLOUD_BASE = 'https://cloud.plaerrdeifl.de/remote.php/dav/files/liveticker-prod'
NEXTCLOUD_SHARE_API = 'https://cloud.plaerrdeifl.de/ocs/v2.php/apps/files_sharing/api/v1/shares'
NEXTCLOUD_ROOT = '/Liveticker'
EDGE_URL = 'https://wplescvhlgctynkfwvrj.supabase.co/functions/v1/liveticker-publishing-worker'
WORKER_HEADER = 'X-Liveticker-Worker-Token'
EXPECTED_BY_KIND = {
    'PERIOD_1': ('period_1-post.png', 'period_1-story.png'),
    'PERIOD_2': ('period_2-post.png', 'period_2-story.png'),
    'FINAL': ('final-post.png', 'final-story.png'),
}
FORMAT_BY_NAME = {
    'period_1-post.png': 'POST', 'period_1-story.png': 'STORY',
    'period_2-post.png': 'POST', 'period_2-story.png': 'STORY',
    'final-post.png': 'POST', 'final-story.png': 'STORY',
}
REMOTE_NAME_BY_LOCAL = {
    'period_1-post.png': '1-Drittel_POST.png',
    'period_1-story.png': '1-Drittel_STORY.png',
    'period_2-post.png': '2-Drittel_POST.png',
    'period_2-story.png': '2-Drittel_STORY.png',
    'final-post.png': 'Endstand_POST.png',
    'final-story.png': 'Endstand_STORY.png',
}

class WorkerError(RuntimeError):
    def __init__(self, code: str):
        self.code = code if code and len(code) <= 80 else 'WORKER_INTERNAL'
        super().__init__(self.code)

def read_secret(path: Path, minimum: int = 1) -> str:
    try:
        value = path.read_text(encoding='utf-8').strip()
    except OSError as exc:
        raise WorkerError('SECRET_UNAVAILABLE') from exc
    if len(value) < minimum or len(value) > 2048 or '\x00' in value:
        raise WorkerError('SECRET_INVALID')
    return value

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def edge(payload: dict[str, Any]) -> dict[str, Any]:
    token = read_secret(WORKER_TOKEN_FILE, 32)
    body = json.dumps(payload, separators=(',', ':'), ensure_ascii=True).encode('utf-8')
    request = urllib.request.Request(
        EDGE_URL,
        data=body,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            WORKER_HEADER: token,
            'User-Agent': 'Plaerrdeifl-Liveticker-Worker/1',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read(1_048_577)
            status = response.status
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            raise WorkerError('EDGE_AUTH_FAILED') from exc
        raise WorkerError('EDGE_HTTP_FAILED') from exc
    except urllib.error.URLError as exc:
        raise WorkerError('EDGE_NETWORK_FAILED') from exc
    if status != 200 or len(raw) > 1_048_576:
        raise WorkerError('EDGE_RESPONSE_INVALID')
    try:
        decoded = json.loads(raw.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise WorkerError('EDGE_RESPONSE_INVALID') from exc
    if not isinstance(decoded, dict) or decoded.get('ok') is not True or not isinstance(decoded.get('data'), dict):
        raise WorkerError('EDGE_RESPONSE_INVALID')
    return decoded['data']

def claim() -> dict[str, Any] | None:
    result = edge({'action': 'claim'})
    if result.get('claimed') is False:
        return None
    job = result.get('job')
    if result.get('claimed') is not True or not isinstance(job, dict):
        raise WorkerError('CLAIM_INVALID')
    required = {'jobId', 'claimToken', 'environment', 'attemptCount', 'claimExpiresAt', 'request'}
    if set(job) != required or job.get('environment') != 'PROD' or not isinstance(job.get('request'), dict):
        raise WorkerError('CLAIM_INVALID')
    return job

def complete(job: dict[str, Any], success: bool, error_code: str | None, manifest: dict[str, Any] | None) -> None:
    result = edge({
        'action': 'complete',
        'jobId': job['jobId'],
        'claimToken': job['claimToken'],
        'success': success,
        'errorCode': error_code,
        'result': manifest,
    })
    if result.get('completed') is not True:
        raise WorkerError('COMPLETE_REJECTED')

def remote_path(path: str) -> str:
    if not path.startswith('/Liveticker/') or '..' in path or '\\' in path or '?' in path or '#' in path:
        raise WorkerError('NEXTCLOUD_PATH_INVALID')
    return path


def slug(value: str, fallback: str) -> str:
    normalized = re.sub(r'[^A-Za-z0-9ÄÖÜäöüß._-]+', '-', str(value or '').strip())
    normalized = re.sub(r'-{2,}', '-', normalized).strip('-.')
    return normalized[:80] or fallback


def game_remote_dir(request: dict[str, Any]) -> str:
    event_id = str(request.get('eventId') or '').strip()
    event_date = str(request.get('eventDate') or '').strip()
    opponent = request.get('opponentTeam')
    if not re.fullmatch(r'[0-9a-fA-F-]{36}', event_id):
        raise WorkerError('SNAPSHOT_EVENT_ID_INVALID')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', event_date):
        raise WorkerError('SNAPSHOT_EVENT_DATE_INVALID')
    opponent_name = opponent.get('shortName') or opponent.get('name') if isinstance(opponent, dict) else ''
    folder = f'{event_date}_{slug(str(opponent_name), "Gegner")}'
    return f'{NEXTCLOUD_ROOT}/{folder}'

def webdav_url(path: str) -> str:
    return NEXTCLOUD_BASE.rstrip('/') + '/' + urllib.parse.quote(remote_path(path).lstrip('/'), safe='/')

def webdav(method: str, path: str, expected: set[int], data: bytes | None = None, content_type: str | None = None) -> int:
    password = read_secret(NEXTCLOUD_SECRET)
    auth = base64.b64encode(f'{NEXTCLOUD_USER}:{password}'.encode('utf-8')).decode('ascii')
    headers = {'Authorization': f'Basic {auth}', 'User-Agent': 'Plaerrdeifl-Liveticker-Worker/1'}
    if content_type:
        headers['Content-Type'] = content_type
    request = urllib.request.Request(webdav_url(path), data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            status = response.status
            response.read(1_048_577)
    except urllib.error.HTTPError as exc:
        if exc.code in expected:
            return exc.code
        if exc.code in {401, 403}:
            raise WorkerError('NEXTCLOUD_AUTH_FAILED') from exc
        raise WorkerError('NEXTCLOUD_UPLOAD_FAILED') from exc
    except urllib.error.URLError as exc:
        raise WorkerError('NEXTCLOUD_UPLOAD_FAILED') from exc
    if status not in expected:
        raise WorkerError('NEXTCLOUD_UPLOAD_FAILED')
    return status

def ensure_collection(path: str) -> None:
    parts = remote_path(path).strip('/').split('/')
    current = '/Liveticker'
    for part in parts[1:]:
        current += '/' + part
        webdav('MKCOL', current, {201, 405})

def valid_share_url(value: Any) -> str | None:
    share_url = str(value or '').rstrip('/')
    if re.fullmatch(r'https://cloud[.]plaerrdeifl[.]de/s/[A-Za-z0-9]{8,128}', share_url):
        return share_url
    return None


def existing_public_share(remote: str, auth: str) -> str | None:
    query = urllib.parse.urlencode({
        'format': 'json',
        'path': remote_path(remote),
        'reshares': 'true',
    })
    request = urllib.request.Request(
        NEXTCLOUD_SHARE_API + '?' + query,
        headers={
            'Authorization': f'Basic {auth}',
            'OCS-APIRequest': 'true',
            'Accept': 'application/json',
            'User-Agent': 'Plaerrdeifl-Liveticker-Worker/1',
        },
        method='GET',
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read(1_048_577)
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            raise WorkerError('NEXTCLOUD_AUTH_FAILED') from exc
        raise WorkerError('NEXTCLOUD_SHARE_FAILED') from exc
    except urllib.error.URLError as exc:
        raise WorkerError('NEXTCLOUD_SHARE_FAILED') from exc
    try:
        body = json.loads(raw.decode('utf-8'))
        meta = body['ocs']['meta']
        if int(meta.get('statuscode', 0)) != 200:
            raise ValueError('OCS share lookup failed')
        shares = body['ocs']['data']
        if not isinstance(shares, list):
            raise TypeError('OCS share lookup returned invalid data')
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise WorkerError('NEXTCLOUD_SHARE_FAILED') from exc
    for share in reversed(shares):
        if not isinstance(share, dict):
            continue
        if int(share.get('share_type', -1)) != 3:
            continue
        if int(share.get('permissions', 0)) & 1 != 1:
            continue
        share_url = valid_share_url(share.get('url'))
        if share_url:
            return share_url
    return None


def public_share(remote: str) -> tuple[str, str]:
    password = read_secret(NEXTCLOUD_SECRET)
    auth = base64.b64encode(f'{NEXTCLOUD_USER}:{password}'.encode('utf-8')).decode('ascii')
    share_url = existing_public_share(remote, auth)
    if share_url:
        return share_url, share_url + '/download'

    payload = urllib.parse.urlencode({
        'path': remote_path(remote),
        'shareType': '3',
        'permissions': '1',
        'label': f'Liveticker Grafik {Path(remote).name}',
    }).encode('utf-8')
    request = urllib.request.Request(
        NEXTCLOUD_SHARE_API + '?format=json',
        data=payload,
        headers={
            'Authorization': f'Basic {auth}',
            'OCS-APIRequest': 'true',
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Plaerrdeifl-Liveticker-Worker/1',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read(1_048_577)
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            raise WorkerError('NEXTCLOUD_AUTH_FAILED') from exc
        raise WorkerError('NEXTCLOUD_SHARE_FAILED') from exc
    except urllib.error.URLError as exc:
        raise WorkerError('NEXTCLOUD_SHARE_FAILED') from exc
    try:
        body = json.loads(raw.decode('utf-8'))
        meta = body['ocs']['meta']
        if int(meta.get('statuscode', 0)) != 200:
            raise ValueError('OCS share creation failed')
        share_url = valid_share_url(body['ocs']['data']['url'])
        if share_url is None:
            raise ValueError('OCS share creation returned invalid URL')
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise WorkerError('NEXTCLOUD_SHARE_FAILED') from exc
    return share_url, share_url + '/download'


def put(local: Path, remote: str) -> dict[str, Any]:
    data = local.read_bytes()
    webdav('PUT', remote, {201, 204}, data=data, content_type='image/png')
    share_url, download_url = public_share(remote)
    return {
        'kind': FORMAT_BY_NAME[local.name],
        'filename': local.name,
        'nextcloudPath': remote,
        'sha256': sha256(local),
        'bytes': len(data),
        'shareUrl': share_url,
        'downloadUrl': download_url,
    }

def local_logo_path(asset_path: str) -> Path:
    name = Path(asset_path).name
    if not name or name != asset_path.rstrip('/').split('/')[-1]:
        raise WorkerError('TEAM_LOGO_PATH_INVALID')
    path = ROOT / 'assets' / 'teams' / name
    if not path.is_file():
        raise WorkerError('TEAM_LOGO_MISSING')
    return path

LOGO_EXTENSIONS = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
}

def snapshot_logo_path(team: dict[str, Any], logo_dir: Path, label: str) -> Path:
    encoded = team.get('logoDataBase64')
    mime = str(team.get('logoMime') or '').lower()
    if isinstance(encoded, str) and encoded.strip():
        if mime not in LOGO_EXTENSIONS:
            raise WorkerError('TEAM_LOGO_MIME_INVALID')
        try:
            data = base64.b64decode(encoded, validate=True)
        except Exception as exc:
            raise WorkerError('TEAM_LOGO_DATA_INVALID') from exc
        if not data or len(data) > 1024 * 1024:
            raise WorkerError('TEAM_LOGO_SIZE_INVALID')
        valid = (
            (mime == 'image/png' and data.startswith(b'\x89PNG\r\n\x1a\n'))
            or (mime == 'image/jpeg' and data.startswith(b'\xff\xd8\xff'))
            or (mime == 'image/webp' and data.startswith(b'RIFF') and len(data) >= 12 and data[8:12] == b'WEBP')
        )
        if not valid:
            raise WorkerError('TEAM_LOGO_DATA_INVALID')
        logo_dir.mkdir(parents=True, exist_ok=True)
        path = logo_dir / f'{label}{LOGO_EXTENSIONS[mime]}'
        path.write_bytes(data)
        os.chmod(path, 0o600)
        return path
    asset_path = team.get('logoAssetPath')
    if not isinstance(asset_path, str) or not asset_path.strip():
        raise WorkerError('TEAM_LOGO_MISSING')
    return local_logo_path(asset_path)

def normalize_snapshot(snapshot: dict[str, Any], logo_dir: Path) -> tuple[str, dict[str, Any]]:
    kind = str(snapshot.get('kind') or '').upper()
    if kind not in EXPECTED_BY_KIND or not isinstance(snapshot.get('history'), list):
        raise WorkerError('SNAPSHOT_INVALID')
    templates = snapshot.get('graphicTemplates')
    if not isinstance(templates, dict):
        raise WorkerError('GRAPHIC_TEMPLATE_SNAPSHOT_MISSING')
    normalized = {
        'kind': kind,
        'competitionLabel': str(snapshot.get('competitionLabel') or ''),
        'seriesInfo': str(snapshot.get('seriesInfo') or ''),
        'history': snapshot['history'],
        'graphicTemplates': templates,
    }
    for source_key, target_key in (('ourTeam', 'ourTeam'), ('opponentTeam', 'opponentTeam')):
        team = snapshot.get(source_key)
        if not isinstance(team, dict):
            raise WorkerError('SNAPSHOT_INVALID')
        normalized[target_key] = {
            'name': str(team.get('name') or ''),
            'logoPath': str(snapshot_logo_path(team, logo_dir, target_key)),
        }
    return kind, normalized

def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.chmod(temp, 0o600)
    os.replace(temp, path)

def render(state_file: Path, outdir: Path) -> list[dict[str, Any]]:
    outdir.mkdir(parents=True, exist_ok=True)
    completed = subprocess.run(
        ['/usr/bin/python3', str(RENDERER), str(state_file), '--out', str(outdir)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        timeout=1200,
    )
    if completed.returncode != 0:
        raise WorkerError('RENDER_FAILED')
    try:
        manifest = json.loads((outdir / 'manifest.json').read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise WorkerError('RENDER_MANIFEST_INVALID') from exc
    if not isinstance(manifest, list) or len(manifest) != 2 or not all(isinstance(item, dict) and item.get('backgroundApplied') is True for item in manifest):
        raise WorkerError('RENDER_OUTPUT_INVALID')
    return manifest

def process_job(job: dict[str, Any]) -> dict[str, Any]:
    job_id = str(job['jobId'])
    jobdir = JOBS / job_id
    kind, state = normalize_snapshot(job['request'], jobdir / 'logos')
    rendered = jobdir / 'rendered'
    state_file = jobdir / 'state.json'
    write_json(state_file, state)
    render(state_file, rendered)
    names = EXPECTED_BY_KIND[kind]
    for name in names:
        if not (rendered / name).is_file() or (rendered / name).stat().st_size <= 0:
            raise WorkerError('RENDER_OUTPUT_MISSING')
    remote_dir = game_remote_dir(job['request'])
    ensure_collection(remote_dir)
    artifacts = [put(rendered / name, f'{remote_dir}/{REMOTE_NAME_BY_LOCAL[name]}') for name in names]
    manifest = {'schemaVersion': 1, 'graphicKind': kind, 'artifacts': artifacts}
    write_json(jobdir / 'receipt.json', manifest)
    return manifest

def run_once() -> bool:
    job = claim()
    if job is None:
        logging.info('no pending PROD jobs')
        return False
    try:
        manifest = process_job(job)
        complete(job, True, None, manifest)
        logging.info('PROD graphic job %s completed (%s)', job['jobId'], job['request'].get('kind'))
    except Exception as exc:
        code = exc.code if isinstance(exc, WorkerError) else 'WORKER_INTERNAL'
        logging.exception('PROD graphic job %s failed with %s', job.get('jobId'), code)
        try:
            complete(job, False, code, None)
        except Exception:
            logging.exception('completion of failed job %s could not be delivered', job.get('jobId'))
    return True

def run_forever(poll_seconds: int) -> None:
    JOBS.mkdir(parents=True, exist_ok=True)
    while True:
        try:
            run_once()
        except Exception as exc:
            code = exc.code if isinstance(exc, WorkerError) else 'WORKER_INTERNAL'
            logging.error('poll failed with %s', code)
        time.sleep(poll_seconds)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--poll-seconds', type=int, default=30)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    if args.poll_seconds < 5 or args.poll_seconds > 3600:
        raise SystemExit('poll-seconds must be 5..3600')
    if args.once:
        run_once()
        return 0
    run_forever(args.poll_seconds)
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
