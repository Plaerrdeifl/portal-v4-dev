from __future__ import annotations

import importlib.util
import json
import pathlib
import struct
import sys
import unittest
from datetime import datetime, timezone


ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "workers" / "liveticker-publishing" / "realtime_wake.py"
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("liveticker_realtime_wake", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class FakeClock:
    def __init__(self) -> None:
        self.value = 100.0

    def __call__(self) -> float:
        return self.value


class RealtimeWakeTest(unittest.TestCase):
    def test_available_delay_is_bounded_at_zero_and_parses_utc(self) -> None:
        now = datetime(2026, 9, 25, 6, 0, tzinfo=timezone.utc)
        self.assertEqual(
            MODULE.available_delay_seconds({"availableAt": "2026-09-25T06:00:30Z"}, now),
            30.0,
        )
        self.assertEqual(
            MODULE.available_delay_seconds({"availableAt": "2026-09-25T05:59:30Z"}, now),
            0.0,
        )
        self.assertEqual(MODULE.available_delay_seconds({"availableAt": "invalid"}, now), 0.0)

    def test_scheduler_prefers_earliest_known_wake(self) -> None:
        clock = FakeClock()
        scheduler = MODULE.WakeScheduler(monotonic=clock)
        scheduler.wake("later_retry", 60)
        scheduler.wake("earlier_retry", 30)
        clock.value = 130
        self.assertEqual(scheduler.wait(120), "earlier_retry")
        scheduler.close()

    def test_client_frames_are_masked_and_round_trip(self) -> None:
        payload = json.dumps({"event": "wake"}).encode("utf-8")
        mask = b"\x01\x02\x03\x04"
        frame = MODULE._client_frame(payload, mask=mask)
        self.assertEqual(frame[0], 0x81)
        self.assertTrue(frame[1] & 0x80)
        length = frame[1] & 0x7F
        self.assertEqual(length, len(payload))
        self.assertEqual(frame[2:6], mask)
        decoded = bytes(value ^ mask[index % 4] for index, value in enumerate(frame[6:]))
        self.assertEqual(decoded, payload)

    def test_large_client_frame_uses_16_bit_length(self) -> None:
        payload = b"x" * 300
        frame = MODULE._client_frame(payload, mask=b"\x00\x00\x00\x00")
        self.assertEqual(frame[1] & 0x7F, 126)
        self.assertEqual(struct.unpack("!H", frame[2:4])[0], len(payload))


if __name__ == "__main__":
    unittest.main()
