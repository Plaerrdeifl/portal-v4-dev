#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import logging
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
