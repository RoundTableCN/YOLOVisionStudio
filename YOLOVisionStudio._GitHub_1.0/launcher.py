"""YOLOVision Studio Launcher"""
import subprocess, time, sys, os, webbrowser, socket, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_PORT = 8618
FRONTEND_PORT = 5173
LOG_FILE = os.path.join(ROOT, ".backend.log")


def port_in_use(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2)
    try:
        s.connect(("127.0.0.1", port))
        s.close()
        return True
    except Exception:
        s.close()
        return False


def backend_healthy(port):
    try:
        req = urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=3)
        return req.status == 200
    except Exception:
        return False


def main():
    print()
    print("=" * 50)
    print("   YOLOVision Studio V1.0")
    print("=" * 50)
    print()

    # --- Backend ---
    print("[1/3] Starting backend...")

    # Already running?
    if backend_healthy(BACKEND_PORT):
        print(f"    Backend already running (port {BACKEND_PORT})")
    elif port_in_use(BACKEND_PORT):
        print(f"    ERROR: Port {BACKEND_PORT} in use but no response.")
        print(f"    A previous backend may have crashed. Waiting 30s for port release...")
        for _ in range(30):
            time.sleep(1)
            if not port_in_use(BACKEND_PORT):
                print("    Port released.")
                break
        else:
            print("    Port still busy. Restart your computer or wait 2 minutes.")
            input("    Press Enter to exit...")
            return

    if not backend_healthy(BACKEND_PORT) and not port_in_use(BACKEND_PORT):
        # Open log file for backend stderr
        log = open(LOG_FILE, "w")
        backend = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app",
             "--host", "127.0.0.1", "--port", str(BACKEND_PORT)],
            cwd=os.path.join(ROOT, "backend"),
            stdout=log, stderr=log,
        )

        # Wait for backend to be ready (check both port AND health)
        print(f"    Waiting (up to 90s)", end="", flush=True)
        ok = False
        for i in range(90):
            time.sleep(1)
            if backend.poll() is not None:
                # Process exited — it crashed!
                print(f"\n    BACKEND CRASHED after {i+1}s")
                log.close()
                # Show last 20 lines of log
                with open(LOG_FILE, "r") as f:
                    lines = f.readlines()
                    for line in lines[-20:]:
                        print(f"    {line.rstrip()}")
                print()
                print(f"    See full log: {LOG_FILE}")
                input("    Press Enter to exit...")
                return
            print(".", end="", flush=True)
            if backend_healthy(BACKEND_PORT):
                print(" OK")
                ok = True
                break

        log.close()
        if not ok:
            print("\n    TIMEOUT: Backend did not respond in 90s")
            print(f"    Check log: {LOG_FILE}")
            backend.kill()
            input("    Press Enter to exit...")
            return

    # --- Frontend ---
    print("[2/3] Starting frontend...")
    if port_in_use(FRONTEND_PORT):
        print(f"    Frontend already running (port {FRONTEND_PORT})")
    else:
        npx = "npx.cmd" if sys.platform == "win32" else "npx"
        frontend = subprocess.Popen(
            [npx, "vite", "--port", str(FRONTEND_PORT), "--host", "127.0.0.1"],
            cwd=os.path.join(ROOT, "frontend"),
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        print(f"    Waiting (up to 30s)", end="", flush=True)
        for i in range(30):
            time.sleep(1)
            if port_in_use(FRONTEND_PORT):
                print(" OK")
                break
            if i % 5 == 0:
                print(".", end="", flush=True)

    # --- Browser ---
    url = f"http://127.0.0.1:{FRONTEND_PORT}"
    print(f"[3/3] Opening browser -> {url}")
    webbrowser.open(url)

    print()
    print("=" * 50)
    print(f"   Ready: {url}")
    print("   Press Enter to stop all services")
    print("=" * 50)
    try:
        input()
    except EOFError:
        pass

    print("Stopping...")
    subprocess.run(["taskkill", "/f", "/im", "node.exe"], capture_output=True)
    subprocess.run(["taskkill", "/f", "/im", "python.exe"], capture_output=True)
    print("Done.")


if __name__ == "__main__":
    main()
