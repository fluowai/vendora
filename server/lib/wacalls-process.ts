import { spawn, execSync, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import net from "net";
import { logger } from "./logger.ts";

const WACALLS_REPO = "https://github.com/JotaDev66/WaCalls.git";
const WACALLS_DIR = path.join(process.cwd(), "wacalls");
const WACALLS_PORT = parseInt(process.env.WACALLS_PORT || "8081", 10);
const WACALLS_DB_PATH = process.env.WACALLS_DB_PATH || path.join(WACALLS_DIR, "wacalls.db");

function getBinName(): string {
  return process.platform === "win32" ? "wacalls-server.exe" : "wacalls-server";
}

function getBinPath(): string {
  return path.join(WACALLS_DIR, getBinName());
}

function hasGo(): boolean {
  try {
    execSync("go version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function ensureWaCallsBuilt(): Promise<string | null> {
  const binPath = getBinPath();
  if (fs.existsSync(binPath)) return binPath;

  if (!hasGo()) {
    logger.info("[WaCalls] Go not found. Install Go 1.26+ to build WaCalls, or set WACALLS_URL");
    return null;
  }

  if (!fs.existsSync(WACALLS_DIR)) {
    logger.info("[WaCalls] Cloning WaCalls repository...");
    try {
      execSync(`git clone ${WACALLS_REPO} "${WACALLS_DIR}"`, { stdio: "inherit", timeout: 120000 });
    } catch (err) {
      logger.error("[WaCalls] Failed to clone repository", { error: err });
      return null;
    }
  }

  logger.info("[WaCalls] Building WaCalls server...");
  try {
    execSync(`go build -ldflags="-s -w" -o "${binPath}" ./cmd/server`, {
      cwd: WACALLS_DIR,
      stdio: "inherit",
      timeout: 180000,
    });
  } catch (err) {
    logger.error("[WaCalls] Build failed", { error: err });
    return null;
  }

  if (fs.existsSync(binPath)) {
    logger.info(`[WaCalls] Built: ${binPath}`);
    return binPath;
  }
  return null;
}

export function startEmbeddedWaCalls(): Promise<ChildProcess> {
  return new Promise(async (resolve, reject) => {
    const binPath = await ensureWaCallsBuilt();
    if (!binPath) {
      reject(new Error("WaCalls binary not available"));
      return;
    }

    const inUse = await isPortInUse(WACALLS_PORT);
    if (inUse) {
      const resolvedUrl = `http://localhost:${WACALLS_PORT}`;
      logger.info(`[WaCalls] Port ${WACALLS_PORT} already in use, assuming external WaCalls at ${resolvedUrl}`);
      process.env.WACALLS_URL = resolvedUrl;
      resolve(null as unknown as ChildProcess);
      return;
    }

    const dbDir = path.dirname(WACALLS_DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    logger.info(`[WaCalls] Starting embedded server on :${WACALLS_PORT}...`);
    const proc = spawn(binPath, ["-addr", `:${WACALLS_PORT}`, "-db", WACALLS_DB_PATH], {
      cwd: WACALLS_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const resolvedUrl = `http://localhost:${WACALLS_PORT}`;
    let started = false;

    proc.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (!started && text.includes("HTTP server listening")) {
        started = true;
        process.env.WACALLS_URL = resolvedUrl;
        logger.info(`[WaCalls] Embedded server ready at ${resolvedUrl}`);
        resolve(proc);
      }
      process.stdout.write(`[WaCalls:out] ${text}`);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (!started && text.includes("HTTP server listening")) {
        started = true;
        process.env.WACALLS_URL = resolvedUrl;
        logger.info(`[WaCalls] Embedded server ready at ${resolvedUrl}`);
        resolve(proc);
      }
      process.stderr.write(`[WaCalls:err] ${text}`);
    });

    proc.on("error", (err) => {
      if (!started) reject(err);
      else logger.error("[WaCalls] Process error", { error: err });
    });

    proc.on("exit", (code) => {
      logger.info(`[WaCalls] Process exited with code ${code}`);
      if (!started) reject(new Error(`WaCalls exited with code ${code}`));
    });

    setTimeout(() => {
      if (!started) {
        reject(new Error("WaCalls startup timed out after 30s"));
        proc.kill();
      }
    }, 30000);
  });
}
