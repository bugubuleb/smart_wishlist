#!/usr/bin/env python3
"""One-command local launcher for Smart Wishlist.

Usage:
  python3 run.py
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"


def require_cmd(name: str) -> None:
    if shutil.which(name) is None:
        print(f"[error] Required command not found: {name}")
        sys.exit(1)


def run_step(cmd: list[str], cwd: Path, title: str) -> None:
    print(f"[{title}] {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd)
    if result.returncode != 0:
        print(f"[error] Step failed: {title}")
        sys.exit(result.returncode)


def stream_output(pipe, prefix: str) -> None:
    for line in iter(pipe.readline, ""):
        if not line:
            break
        print(f"[{prefix}] {line.rstrip()}")


def ensure_env_files() -> None:
    backend_env = BACKEND_DIR / ".env"
    frontend_env = FRONTEND_DIR / ".env.local"

    if not backend_env.exists():
        sample = BACKEND_DIR / ".env.example"
        if sample.exists():
            backend_env.write_text(sample.read_text(encoding="utf-8"), encoding="utf-8")
            print("[setup] Created backend/.env from .env.example")

    if not frontend_env.exists():
        sample = FRONTEND_DIR / ".env.local.example"
        if sample.exists():
            frontend_env.write_text(sample.read_text(encoding="utf-8"), encoding="utf-8")
            print("[setup] Created frontend/.env.local from .env.local.example")


def install_if_needed(dir_path: Path, label: str) -> None:
    if not (dir_path / "node_modules").exists():
        run_step(["npm", "install"], dir_path, f"{label}: npm install")


def main() -> None:
    require_cmd("node")
    require_cmd("npm")

    ensure_env_files()
    install_if_needed(BACKEND_DIR, "backend")
    install_if_needed(FRONTEND_DIR, "frontend")

    run_step(["npm", "run", "db:init"], BACKEND_DIR, "backend: db:init")

    backend = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=BACKEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        start_new_session=True,
    )

    frontend = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        start_new_session=True,
    )

    threads = [
        threading.Thread(target=stream_output, args=(backend.stdout, "backend"), daemon=True),
        threading.Thread(target=stream_output, args=(frontend.stdout, "frontend"), daemon=True),
    ]
    for t in threads:
        t.start()

    print("\n[ready] App starting...")
    print("[ready] Frontend: http://localhost:3000")
    print("[ready] Backend health: http://localhost:8000/api/health")
    print("[ready] Press Ctrl+C to stop all processes.\n")

    try:
        while True:
            backend_code = backend.poll()
            frontend_code = frontend.poll()
            if backend_code is not None:
                print(f"[error] backend exited with code {backend_code}")
                break
            if frontend_code is not None:
                print(f"[error] frontend exited with code {frontend_code}")
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[stop] Stopping services...")
    finally:
        for proc in (backend, frontend):
            if proc.poll() is None:
                try:
                    os.killpg(proc.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass


if __name__ == "__main__":
    main()
