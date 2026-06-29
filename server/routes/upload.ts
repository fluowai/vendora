import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { authMiddleware } from "../middleware/auth.ts";

const router = Router();
router.use(authMiddleware);

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

router.post("/avatar", async (req: Request, res: Response) => {
  try {
    const { base64, mimeType } = req.body;

    if (!base64 || !mimeType) {
      res.status(400).json({ error: "base64 e mimeType são obrigatórios" });
      return;
    }

    if (!ALLOWED_TYPES.includes(mimeType)) {
      res.status(400).json({ error: `Tipo não permitido. Use: ${ALLOWED_TYPES.join(", ")}` });
      return;
    }

    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > MAX_SIZE) {
      res.status(400).json({ error: "Arquivo muito grande. Máximo 5MB." });
      return;
    }

    const ext = mimeType.split("/")[1];
    const filename = `${req.user!.tenantId}-${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(filePath, buffer);

    const url = `/uploads/${filename}`;
    res.status(201).json({ url });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao fazer upload" });
  }
});

export default router;
