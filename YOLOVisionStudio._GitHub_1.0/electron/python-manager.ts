import { spawn, ChildProcess } from "child_process";
import path from "path";
import http from "http";

let pythonProcess: ChildProcess | null = null;
const BACKEND_PORT = 8618;

function getPythonExe(): string {
  const runtimePath = path.join(__dirname, "..", "..", "python_runtime", "python.exe");
  return runtimePath;
}

function getBackendDir(): string {
  return path.join(__dirname, "..", "..", "backend");
}

export async function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonExe = getPythonExe();
    const backendDir = getBackendDir();

    pythonProcess = spawn(pythonExe, ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)], {
      cwd: backendDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    pythonProcess.stdout?.on("data", (data: Buffer) => {
      console.log(`[Python] ${data.toString().trim()}`);
    });

    pythonProcess.stderr?.on("data", (data: Buffer) => {
      console.error(`[Python ERR] ${data.toString().trim()}`);
    });

    pythonProcess.on("error", (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });

    pythonProcess.on("exit", (code) => {
      console.log(`[Python] exited with code ${code}`);
      pythonProcess = null;
    });

    waitForBackend(30, 500).then(resolve).catch(reject);
  });
}

function waitForBackend(retries: number, delayMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    function check(remaining: number) {
      if (remaining <= 0) {
        reject(new Error("Backend did not start in time"));
        return;
      }
      http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(() => check(remaining - 1), delayMs);
        }
      }).on("error", () => {
        setTimeout(() => check(remaining - 1), delayMs);
      });
    }
    check(retries);
  });
}

export function stopBackend(): void {
  if (pythonProcess) {
    pythonProcess.kill("SIGTERM");
    setTimeout(() => {
      if (pythonProcess) {
        pythonProcess.kill("SIGKILL");
      }
    }, 5000);
  }
}
