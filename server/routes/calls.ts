import { Router, Request, Response } from "express";
import { wacalls, WacallsClientError } from "../lib/wacalls-client.ts";
import { getWaCallsBridge } from "../lib/wacalls-sse.ts";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";

const router = Router();

function handleError(res: Response, err: unknown) {
  if (err instanceof WacallsClientError) {
    res.status(err.status).json({ error: err.message });
  } else {
    const message = err instanceof Error ? err.message : "Erro interno";
    res.status(500).json({ error: message });
  }
}

router.use(authMiddleware);

router.get("/sessions", async (_req: Request, res: Response) => {
  try {
    const data = await wacalls.listSessions();
    res.json(data);
  } catch (err) { handleError(res, err); }
});

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const data = await wacalls.createSession(name || "WhatsApp Calls");
    res.status(201).json(data);
  } catch (err) { handleError(res, err); }
});

router.delete("/sessions/:sid", async (req: Request, res: Response) => {
  try {
    await wacalls.deleteSession(req.params.sid);
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

router.post("/sessions/:sid/logout", async (req: Request, res: Response) => {
  try {
    await wacalls.logoutSession(req.params.sid);
    res.json({ ok: true });
  } catch (err) { handleError(res, err); }
});

router.post("/sessions/:sid/pair", async (req: Request, res: Response) => {
  try {
    await wacalls.pairSession(req.params.sid);
    res.json({ ok: true });
  } catch (err) { handleError(res, err); }
});

router.post("/sessions/:sid/calls", async (req: Request, res: Response) => {
  try {
    const { phone, record } = req.body;
    if (!phone) {
      res.status(400).json({ error: "phone is required" });
      return;
    }
    const data = await wacalls.startCall(req.params.sid, phone, record);
    res.json(data);
  } catch (err) { handleError(res, err); }
});

router.post("/sessions/:sid/calls/:callId/webrtc", async (req: Request, res: Response) => {
  try {
    const { sdp_offer } = req.body;
    if (!sdp_offer) {
      res.status(400).json({ error: "sdp_offer is required" });
      return;
    }
    const data = await wacalls.sendWebRTC(req.params.sid, req.params.callId, sdp_offer);
    res.json(data);
  } catch (err) { handleError(res, err); }
});

router.post("/sessions/:sid/calls/:callId/accept", async (req: Request, res: Response) => {
  try {
    const data = await wacalls.acceptCall(req.params.sid, req.params.callId);
    res.json(data);
  } catch (err) { handleError(res, err); }
});

router.post("/sessions/:sid/calls/:callId/reject", async (req: Request, res: Response) => {
  try {
    const data = await wacalls.rejectCall(req.params.sid, req.params.callId);
    res.json(data);
  } catch (err) { handleError(res, err); }
});

router.delete("/sessions/:sid/calls/:callId", async (req: Request, res: Response) => {
  try {
    await wacalls.endCall(req.params.sid, req.params.callId);
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

router.get("/sessions/:sid/history", async (req: Request, res: Response) => {
  try {
    const rows = await prisma.waCallRecord.findMany({
      where: { sessionId: req.params.sid },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
    res.json({
      rows: rows.map((r) => ({
        sessionId: r.sessionId,
        callId: r.callId,
        owner: r.owner || undefined,
        direction: r.direction,
        peer: r.peer,
        startedAt: r.startedAt.getTime(),
        status: r.status,
        endedAt: r.endedAt?.getTime() || undefined,
        endReason: r.endReason || undefined,
      })),
    });
  } catch (err) { handleError(res, err); }
});

router.post("/bridge/start", async (_req: Request, res: Response) => {
  try {
    getWaCallsBridge().start();
    res.json({ ok: true, message: "SSE bridge started" });
  } catch (err) { handleError(res, err); }
});

router.post("/bridge/stop", async (_req: Request, res: Response) => {
  try {
    getWaCallsBridge().stop();
    res.json({ ok: true, message: "SSE bridge stopped" });
  } catch (err) { handleError(res, err); }
});

router.get("/bridge/status", async (_req: Request, res: Response) => {
  const bridgeUrl = process.env.WACALLS_URL || "not configured";
  const connected = !!process.env.WACALLS_URL;
  res.json({
    configured: connected,
    bridgeUrl: connected ? bridgeUrl : null,
    sseConnected: getWaCallsBridge().isConnected,
  });
});

export default router;
