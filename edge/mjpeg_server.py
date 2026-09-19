"""
A minimal MJPEG HTTP server for the edge pipeline's annotated frame.

Why this instead of WebRTC/RTSP-out: the reference doc's own principle
(Section 11) is bandwidth-aware video — only event clips and, for a local
dev demo, a lightweight preview stream cross any process boundary, never a
heavy real-time protocol that a hackathon timeline can't afford to debug.
MJPEG-over-HTTP is a few dozen lines, has zero extra dependencies beyond
what's already installed, and every browser renders it natively via <img>.
"""

import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BOUNDARY = "ibvapframe"


class FrameBroadcaster:
    def __init__(self):
        self._lock = threading.Lock()
        self._latest: bytes | None = None

    def update(self, jpg_bytes: bytes) -> None:
        with self._lock:
            self._latest = jpg_bytes

    def get(self) -> bytes | None:
        with self._lock:
            return self._latest


def make_handler(broadcaster: FrameBroadcaster):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):  # noqa: A002 - silence default access log
            pass

        def do_GET(self):
            if self.path.split("?")[0] != "/stream":
                self.send_response(404)
                self.end_headers()
                return

            self.send_response(200)
            self.send_header("Age", "0")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Pragma", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", f"multipart/x-mixed-replace; boundary={BOUNDARY}")
            self.end_headers()

            try:
                while True:
                    frame = broadcaster.get()
                    if frame is None:
                        continue
                    self.wfile.write(f"--{BOUNDARY}\r\n".encode())
                    self.wfile.write(b"Content-Type: image/jpeg\r\n")
                    self.wfile.write(f"Content-Length: {len(frame)}\r\n\r\n".encode())
                    self.wfile.write(frame)
                    self.wfile.write(b"\r\n")
                    threading.Event().wait(0.08)  # ~12fps cap on the stream out
            except (BrokenPipeError, ConnectionResetError):
                pass

    return Handler


def start_server(broadcaster: FrameBroadcaster, port: int) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(broadcaster))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server
