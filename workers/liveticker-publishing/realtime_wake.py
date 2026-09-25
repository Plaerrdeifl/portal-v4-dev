"""Minimal Supabase Realtime broadcast client for the DEV publishing worker.

The worker only receives content-free wake signals. Job data and worker control
remain behind the token-authenticated Edge Function gateway.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import socket
import ssl
import struct
import threading
import time
from datetime import datetime, timezone
from typing import Callable
from urllib.parse import quote, urlsplit


HEARTBEAT_SECONDS = 20
MAX_FRAME_BYTES = 1_048_576
RECONNECT_DELAYS_SECONDS = (1, 2, 5, 10, 30)


class RealtimeError(RuntimeError):
    pass


def available_delay_seconds(payload: object, now: datetime | None = None) -> float:
    if not isinstance(payload, dict):
        return 0.0
    value = payload.get("availableAt")
    if not isinstance(value, str) or not value.strip():
        return 0.0
    try:
        target = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    if target.tzinfo is None:
        target = target.replace(tzinfo=timezone.utc)
    current = now or datetime.now(timezone.utc)
    return max(0.0, (target.astimezone(timezone.utc) - current).total_seconds())


class WakeScheduler:
    def __init__(self, monotonic: Callable[[], float] = time.monotonic):
        self._monotonic = monotonic
        self._condition = threading.Condition()
        self._scheduled_at: float | None = None
        self._reason = "wake"
        self._closed = False

    def wake(self, reason: str, delay_seconds: float = 0.0) -> None:
        due = self._monotonic() + max(0.0, delay_seconds)
        with self._condition:
            if self._closed:
                return
            if self._scheduled_at is None or due < self._scheduled_at:
                self._scheduled_at = due
                self._reason = reason
            self._condition.notify_all()

    def wait(self, timeout_seconds: float) -> str:
        deadline = self._monotonic() + max(0.0, timeout_seconds)
        with self._condition:
            while not self._closed:
                now = self._monotonic()
                if self._scheduled_at is not None and self._scheduled_at <= now:
                    reason = self._reason
                    self._scheduled_at = None
                    return reason
                wake_at = deadline
                if self._scheduled_at is not None:
                    wake_at = min(wake_at, self._scheduled_at)
                remaining = wake_at - now
                if remaining <= 0:
                    return "recovery_poll"
                self._condition.wait(remaining)
            return "shutdown"

    def close(self) -> None:
        with self._condition:
            self._closed = True
            self._condition.notify_all()


def _client_frame(payload: bytes, opcode: int = 0x1, mask: bytes | None = None) -> bytes:
    if len(payload) > MAX_FRAME_BYTES:
        raise RealtimeError("realtime frame too large")
    key = mask or os.urandom(4)
    if len(key) != 4:
        raise ValueError("mask must be four bytes")
    length = len(payload)
    if length < 126:
        header = bytes((0x80 | opcode, 0x80 | length))
    elif length <= 0xFFFF:
        header = bytes((0x80 | opcode, 0x80 | 126)) + struct.pack("!H", length)
    else:
        header = bytes((0x80 | opcode, 0x80 | 127)) + struct.pack("!Q", length)
    masked = bytes(value ^ key[index % 4] for index, value in enumerate(payload))
    return header + key + masked


class RealtimeBroadcastClient:
    def __init__(
        self,
        supabase_url: str,
        publishable_key: str,
        topic: str,
        on_wake: Callable[[object], None],
        on_subscribed: Callable[[], None],
    ):
        parsed = urlsplit(supabase_url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.path not in ("", "/"):
            raise ValueError("invalid Supabase URL")
        if not publishable_key or len(publishable_key) > 2048:
            raise ValueError("invalid publishable key")
        if not topic or len(topic) > 200:
            raise ValueError("invalid Realtime topic")
        self._host = parsed.hostname
        self._port = parsed.port or 443
        self._key = publishable_key
        self._topic = f"realtime:{topic}"
        self._on_wake = on_wake
        self._on_subscribed = on_subscribed
        self._stop = threading.Event()
        self._socket: ssl.SSLSocket | None = None
        self._thread: threading.Thread | None = None
        self._message_ref = 0

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, name="liveticker-realtime", daemon=True)
        self._thread.start()

    def close(self) -> None:
        self._stop.set()
        current = self._socket
        if current is not None:
            try:
                current.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            try:
                current.close()
            except OSError:
                pass
        if self._thread is not None:
            self._thread.join(timeout=3)

    def _next_ref(self) -> str:
        self._message_ref += 1
        return str(self._message_ref)

    def _run(self) -> None:
        attempt = 0
        while not self._stop.is_set():
            try:
                self._connect_and_listen()
                attempt = 0
            except Exception as exc:
                if self._stop.is_set():
                    return
                delay = RECONNECT_DELAYS_SECONDS[min(attempt, len(RECONNECT_DELAYS_SECONDS) - 1)]
                attempt += 1
                logging.warning("DEV Realtime reconnect in %ss (%s)", delay, type(exc).__name__)
                self._stop.wait(delay)

    def _connect_and_listen(self) -> None:
        raw = socket.create_connection((self._host, self._port), timeout=10)
        try:
            context = ssl.create_default_context()
            ws = context.wrap_socket(raw, server_hostname=self._host)
        except Exception:
            raw.close()
            raise
        self._socket = ws
        try:
            ws.settimeout(10)
            self._handshake(ws)
            ws.settimeout(1)
            join_ref = self._next_ref()
            self._send_json(ws, {
                "topic": self._topic,
                "event": "phx_join",
                "payload": {
                    "config": {
                        "broadcast": {"ack": False, "self": False},
                        "presence": {"enabled": False},
                        "postgres_changes": [],
                        "private": False,
                    }
                },
                "ref": join_ref,
                "join_ref": join_ref,
            })
            next_heartbeat = time.monotonic() + HEARTBEAT_SECONDS
            while not self._stop.is_set():
                if time.monotonic() >= next_heartbeat:
                    self._send_json(ws, {
                        "topic": "phoenix",
                        "event": "heartbeat",
                        "payload": {},
                        "ref": self._next_ref(),
                    })
                    next_heartbeat = time.monotonic() + HEARTBEAT_SECONDS
                message = self._receive_json(ws)
                if message is None:
                    continue
                if message.get("event") == "phx_reply" and message.get("ref") == join_ref:
                    if message.get("payload", {}).get("status") != "ok":
                        raise RealtimeError("Realtime join rejected")
                    logging.info("DEV Realtime subscribed to %s", self._topic)
                    self._on_subscribed()
                elif message.get("event") == "broadcast":
                    broadcast = message.get("payload")
                    if isinstance(broadcast, dict) and broadcast.get("event") == "wake":
                        self._on_wake(broadcast.get("payload"))
                elif message.get("event") in ("phx_close", "phx_error"):
                    raise RealtimeError("Realtime channel closed")
                elif message.get("event") == "system" and message.get("payload", {}).get("status") == "error":
                    raise RealtimeError("Realtime system error")
        finally:
            self._socket = None
            try:
                ws.close()
            except OSError:
                pass

    def _handshake(self, ws: ssl.SSLSocket) -> None:
        nonce = base64.b64encode(os.urandom(16)).decode("ascii")
        path = f"/realtime/v1/websocket?apikey={quote(self._key, safe='')}&vsn=1.0.0"
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {self._host}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {nonce}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        ws.sendall(request.encode("ascii"))
        response = bytearray()
        while b"\r\n\r\n" not in response:
            chunk = ws.recv(4096)
            if not chunk or len(response) + len(chunk) > 32_768:
                raise RealtimeError("invalid WebSocket handshake")
            response.extend(chunk)
        header = response.decode("iso-8859-1")
        lines = header.split("\r\n")
        if not lines or " 101 " not in lines[0]:
            raise RealtimeError("WebSocket upgrade rejected")
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                name, value = line.split(":", 1)
                headers[name.strip().lower()] = value.strip()
        expected = base64.b64encode(hashlib.sha1(
            (nonce + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")
        ).digest()).decode("ascii")
        if headers.get("sec-websocket-accept") != expected:
            raise RealtimeError("invalid WebSocket accept")

    def _send_json(self, ws: ssl.SSLSocket, message: dict) -> None:
        payload = json.dumps(message, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
        ws.sendall(_client_frame(payload))

    def _receive_json(self, ws: ssl.SSLSocket) -> dict | None:
        try:
            first = self._recv_exact(ws, 2)
        except socket.timeout:
            return None
        fin = bool(first[0] & 0x80)
        opcode = first[0] & 0x0F
        masked = bool(first[1] & 0x80)
        length = first[1] & 0x7F
        if not fin or masked:
            raise RealtimeError("unsupported WebSocket frame")
        if length == 126:
            length = struct.unpack("!H", self._recv_exact(ws, 2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._recv_exact(ws, 8))[0]
        if length > MAX_FRAME_BYTES:
            raise RealtimeError("Realtime frame too large")
        payload = self._recv_exact(ws, length)
        if opcode == 0x8:
            raise RealtimeError("Realtime socket closed")
        if opcode == 0x9:
            ws.sendall(_client_frame(payload, opcode=0xA))
            return None
        if opcode == 0xA:
            return None
        if opcode != 0x1:
            raise RealtimeError("unsupported WebSocket opcode")
        try:
            decoded = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RealtimeError("invalid Realtime message") from exc
        return decoded if isinstance(decoded, dict) else None

    def _recv_exact(self, ws: ssl.SSLSocket, length: int) -> bytes:
        result = bytearray()
        while len(result) < length:
            chunk = ws.recv(length - len(result))
            if not chunk:
                raise RealtimeError("Realtime socket ended")
            result.extend(chunk)
        return bytes(result)
