#!/usr/bin/env python3
"""Serve the game over HTTP using only Python's standard library."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4000, help="Port (default: 4000)")
    parser.add_argument(
        "--bind", default="0.0.0.0", help="IPv4 address to bind (default: all interfaces)"
    )
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")

    directory = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    try:
        server = ThreadingHTTPServer((args.bind, args.port), handler)
    except OSError as error:
        parser.exit(1, f"Could not start server: {error}\n")

    with server:
        print(f"Serving {directory}", flush=True)
        if args.bind == "0.0.0.0":
            print(f"Local: http://localhost:{args.port}", flush=True)
            print(f"LAN:   http://<this-computer-LAN-IP>:{args.port}", flush=True)
        else:
            print(f"Open: http://{args.bind}:{args.port}", flush=True)
        print("Press Ctrl+C to stop.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
