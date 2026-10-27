"""Headless browser smoke test (desktop + mobile).

    pip install playwright && python -m playwright install chromium
    python tests/browser_smoke.py

Starts the real server, opens the site and checks every section works
without JavaScript errors: intro, in-browser training, Two Earths,
the shared world (teacher + villain), and the checklist.
"""

import os
import random
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = random.randint(20000, 29000)
BASE = f"http://127.0.0.1:{PORT}"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def wait_server():
    for _ in range(100):
        try:
            urllib.request.urlopen(BASE + "/api/health", timeout=1)
            return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError("server did not start")


def check(name, viewport, mobile, browser, failures):
    ctx = browser.new_context(viewport=viewport, is_mobile=mobile, has_touch=mobile)
    page = ctx.new_page()
    page.set_default_timeout(90000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    def expect(cond, what):
        if not cond:
            failures.append(f"[{name}] {what}")

    page.goto(BASE + "/")
    page.wait_for_timeout(2500)
    expect(page.evaluate("document.body.classList.contains('intro-on')"), "intro starts")
    expect(page.evaluate("document.querySelector('.intro-caption h2').textContent.length > 5"), "intro caption")
    page.click("[data-intro-skip]")
    page.wait_for_timeout(500)
    expect(not page.evaluate("document.body.classList.contains('intro-on')"), "intro can be skipped")

    page.evaluate("document.querySelector('#proof').scrollIntoView()")
    done = False
    for _ in range(120):
        page.wait_for_timeout(500)
        if page.evaluate("!!document.querySelector('[data-proof-table] tr.me td') && !document.querySelector('[data-proof-train]').disabled"):
            done = True
            break
    expect(done, "in-browser training finishes")
    harm = page.evaluate("document.querySelectorAll('[data-proof-table] tr.me td')[1]?.textContent")
    expect(harm in ("0%", "1%", "2%"), f"trained network causes ~0% catastrophes (got {harm})")

    page.evaluate("document.querySelector('#twins').scrollIntoView()")
    page.wait_for_timeout(1500)
    page.select_option("[data-twins-speed]", "8")
    page.wait_for_timeout(25000)
    statuses = page.evaluate("[...document.querySelectorAll('.twin [data-status]')].map(e => e.innerText.trim())")
    expect(len(statuses) == 2 and all(statuses), f"two Earths render ({statuses})")
    expect(page.evaluate("document.querySelectorAll('.twin canvas.globe-canvas').length") == 2, "two WebGL globes")

    page.evaluate("document.querySelector('#play').scrollIntoView()")
    page.wait_for_timeout(5000)
    expect("LIVE" in page.evaluate("document.querySelector('[data-play-conn]').innerText"), "connects to the shared world")
    page.evaluate("document.querySelector('[data-role=villain]').click()")
    page.wait_for_timeout(800)
    page.evaluate("document.querySelector('[data-attack=deepfake]').click()")
    page.wait_for_timeout(1500)
    expect(len(page.evaluate("document.querySelector('[data-play-toast]').innerText")) > 3, "villain action resolves")

    page.evaluate("document.querySelector('[data-open-checklist]').click()")
    page.wait_for_timeout(800)
    expect(page.evaluate("document.querySelectorAll('#checklist .req').length") > 60, "checklist lists requirements")
    expect(not page.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), "no horizontal scroll")
    real_errors = [e for e in errors if "favicon" not in e]
    expect(not real_errors, f"no JavaScript errors: {real_errors[:3]}")
    ctx.close()


def main():
    data = tempfile.mkdtemp(prefix="wg-")
    env = {**os.environ, "PORT": str(PORT), "TICK_MS": "300", "DATA_DIR": data}
    srv = subprocess.Popen(["node", str(ROOT / "server" / "server.mjs")], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    failures = []
    try:
        wait_server()
        with sync_playwright() as p:
            browser = p.chromium.launch(args=ARGS)
            check("desktop", {"width": 1440, "height": 900}, False, browser, failures)
            check("mobile", {"width": 390, "height": 844}, True, browser, failures)
            browser.close()
    finally:
        srv.terminate()
    if failures:
        print("FAILED:\n  " + "\n  ".join(failures))
        sys.exit(1)
    print("browser smoke test: OK (desktop + mobile)")


if __name__ == "__main__":
    main()
