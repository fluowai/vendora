import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import net from "net";
import { logger } from "./logger.ts";

const WAHAPLUS_PORT = parseInt(process.env.WAHAPLUS_PORT || "3000", 10);
const WAHAPLUS_DIR = path.join(process.cwd(), "wahaplus");

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

function hasDocker(): boolean {
  try {
    const { execSync } = require("child_process");
    execSync("docker --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function startEmbeddedWahaplus(): Promise<ChildProcess | null> {
  return new Promise(async (resolve, reject) => {
    if (process.env.WAHAPLUS_URL) {
      logger.info(`[WAHA+] Using external WAHA server at ${process.env.WAHAPLUS_URL}`);
      resolve(null);
      return;
    }

    const inUse = await isPortInUse(WAHAPLUS_PORT);
    if (inUse) {
      const resolvedUrl = `http://localhost:${WAHAPLUS_PORT}`;
      logger.info(`[WAHA+] Port ${WAHAPLUS_PORT} already in use, assuming external WAHA at ${resolvedUrl}`);
      process.env.WAHAPLUS_URL = resolvedUrl;
      resolve(null);
      return;
    }

    if (!hasDocker()) {
      logger.info("[WAHA+] Docker not found. Install Docker to run WAHA+, or set WAHAPLUS_URL");
      reject(new Error("Docker not found"));
      return;
    }

    const imageName = process.env.WAHAPLUS_IMAGE || "devlikeapro/waha-plus";
    const containerName = "vendora-wahaplus";

    logger.info(`[WAHA+] Starting Docker container ${imageName}...`);

    const proc = spawn("docker", [
      "run", "-d",
      "--name", containerName,
      "--rm",
      "-p", `${WAHAPLUS_PORT}:3000`,
      ...(process.env.WAHAPLUS_LICENSE ? ["-e", `WAHA_LICENSE_KEY=${process.env.WAHAPLUS_LICENSE}`] : []),
      imageName,
    ], { stdio: ["ignore", "pipe", "pipe"] });

    let containerId = "";
    proc.stdout?.on("data", (data: Buffer) => {
      containerId = data.toString().trim();
    });

    proc.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Docker run failed with code ${code}`));
        return;
      }

      const resolvedUrl = `http://localhost:${WAHAPLUS_PORT}`;
      process.env.WAHAPLUS_URL = resolvedUrl;
      logger.info(`[WAHA+] Container ${containerId} started at ${resolvedUrl}`);

      const logs = spawn("docker", ["logs", "-f", containerName], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      logs.stdout?.on("data", (data: Buffer) => {
        process.stdout.write(`[WAHA+:out] ${data.toString()}`);
      });
      logs.stderr?.on("data", (data: Buffer) => {
        process.stderr.write(`[WAHA+:err] ${data.toString()}`);
      });

      const proxyProc = {
        kill: () => {
          try {
            require("child_process").execSync(`docker stop ${containerName}`, { stdio: "pipe" });
            logger.info(`[WAHA+] Container ${containerName} stopped`);
          } catch {}
        },
      } as ChildProcess;

      resolve(proxyProc);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      logger.error(`[WAHA+] Docker error: ${data.toString().trim()}`);
    });

    setTimeout(() => {
      reject(new Error("WAHA+ Docker startup timed out after 60s"));
    }, 60000);
  });
}

export function stopWahaplusContainer() {
  const containerName = "vendora-wahaplus";
  try {
    const { execSync } = require("child_process");
    execSync(`docker stop ${containerName}`, { stdio: "pipe", timeout: 30000 });
    logger.info(`[WAHA+] Container ${containerName} stopped`);
  } catch (err: any) {
    if (!err.message?.includes("No such container")) {
      logger.error(`[WAHA+] Failed to stop container: ${err.message}`);
    }
  }
}
