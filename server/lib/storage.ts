import { Client as MinioClient } from "minio";
import { Readable } from "stream";
import crypto from "crypto";
import { logger } from "./logger.ts";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT?.trim() || "localhost";
const MINIO_PORT = parseInt(process.env.MINIO_PORT || "9000", 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY?.trim() || "minioadmin";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY?.trim() || "minioadmin";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "vendora-media";
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true";
const MINIO_PUBLIC_URL = (process.env.MINIO_PUBLIC_URL || `http://localhost:${MINIO_PORT}`).replace(/\/$/, "");

let client: MinioClient | null = null;
let bucketReady = false;

function hasMinioConfig() {
  return !!(
    process.env.MINIO_ENDPOINT?.trim()
    && process.env.MINIO_ACCESS_KEY?.trim()
    && process.env.MINIO_SECRET_KEY?.trim()
  );
}

function getClient(): MinioClient {
  if (!client) {
    client = new MinioClient({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });
  }
  return client;
}

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const mc = getClient();
  const exists = await mc.bucketExists(MINIO_BUCKET).catch(() => false);
  if (!exists) {
    await mc.makeBucket(MINIO_BUCKET, process.env.MINIO_REGION || "us-east-1");
    logger.info(`[Storage] Bucket "${MINIO_BUCKET}" created`);
  }
  bucketReady = true;
}

export async function uploadBuffer(
  buffer: Buffer,
  mimeType: string,
  prefix = "general",
): Promise<{ url: string; key: string }> {
  if (!hasMinioConfig()) {
    const localDir = process.env.UPLOAD_DIR || "./uploads";
    const fs = await import("fs");
    const path = await import("path");
    fs.mkdirSync(localDir, { recursive: true });
    const ext = (mimeType.split("/")[1] || "bin").split(/[+;]/)[0];
    const filename = `${prefix}-${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(localDir, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    const url = `/uploads/${filename}`;
    return { url, key: filename };
  }

  await ensureBucket();
  const mc = getClient();
  const key = `${prefix}/${crypto.randomUUID()}`;
  const readable = Readable.from(buffer);
  await mc.putObject(MINIO_BUCKET, key, readable, buffer.length, { "Content-Type": mimeType });
  const url = `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${key}`;
  return { url, key };
}

export async function uploadStream(
  stream: Readable,
  mimeType: string,
  prefix = "general",
): Promise<{ url: string; key: string }> {
  if (!hasMinioConfig()) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return uploadBuffer(Buffer.concat(chunks), mimeType, prefix);
  }

  await ensureBucket();
  const mc = getClient();
  const key = `${prefix}/${crypto.randomUUID()}`;
  await mc.putObject(MINIO_BUCKET, key, stream, undefined, { "Content-Type": mimeType });
  const url = `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${key}`;
  return { url, key };
}

export async function deleteObject(key: string): Promise<void> {
  if (!hasMinioConfig()) {
    return;
  }
  await ensureBucket();
  const mc = getClient();
  await mc.removeObject(MINIO_BUCKET, key);
}

export async function downloadFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function getPublicUrl(key: string): string {
  if (!hasMinioConfig()) return `/uploads/${key}`;
  return `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${key}`;
}
