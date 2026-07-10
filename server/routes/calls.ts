import { Router, Request, Response } from "express";
import { WacallsClientError } from "../lib/wacalls-client.ts";
import { getWaCallsBridge } from "../lib/wacalls-sse.ts";
import { getWahaplusBridge } from "../lib/wahaplus-sse.ts";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { preferredCallPeer } from "../lib/phone.ts";
import { getDefaultVoiceGateway } from "../lib/voice-gateway.ts";

const router = Router();
const voiceGateway = getDefaultVoiceGateway();

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
    const data = await voiceGateway.listSessions();
    res.json(data);
  } catch (err) { handleError(res, err); }
});

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const data = await voiceGateway.createSession(name || "WhatsApp Calls");
    res.status(201).json(data);
  } catch (err) { handleError(res, err); }
});

router.delete("/sessions/:sid", async (req: Request, res: Response) => {
  try {
    await voiceGateway.deleteSession(req.params.sid);
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

router.post("/sessions/:sid/logout", async (req: Request, res: Response) => {
  try {
    await voiceGateway.logoutSession(req.params.sid);
    res.json({ ok: true });
  } catch (err) { handleError(res, err); }
});

router.post("/sessions/:sid/pair", async (req: Request, res: Response) => {
  try {
    await voiceGateway.pairSession(req.params.sid);
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
    const data = await voiceGateway.startCall({
      sessionId: req.params.sid,
      phone,
      record,
      clientId: req.user!.userId,
    });
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
    const data = await voiceGateway.sendWebRTC({
      sessionId: req.params.sid,
      callId: req.params.callId,
      sdpOffer: sdp_offer,
      clientId: req.user!.userId,
    });
    res.json(data);
  } catch (err) { handleError(res, err); }
});

router.post("/sessions/:sid/calls/:callId/accept", async (req: Request, res: Response) => {
  try {
    const data = await voiceGateway.acceptCall(req.params.sid, req.params.callId, req.user!.userId);
    res.json(data);
  } catch (err) { handleError(res, err); }
});

router.post("/sessions/:sid/calls/:callId/reject", async (req: Request, res: Response) => {
  try {
    const data = await voiceGateway.rejectCall(req.params.sid, req.params.callId, req.user!.userId);
    res.json(data);
  } catch (err) { handleError(res, err); }
});

router.delete("/sessions/:sid/calls/:callId", async (req: Request, res: Response) => {
  try {
    await voiceGateway.endCall(req.params.sid, req.params.callId, req.user!.userId);
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
    const ownerIds = rows.map((r) => r.owner).filter(Boolean) as string[];
    const owners = ownerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const ownerMap = new Map(owners.map((u) => [u.id, u.name || u.email]));

    res.json({
      rows: rows.map((r) => ({
        sessionId: r.sessionId,
        callId: r.callId,
        owner: r.owner || undefined,
        ownerName: r.owner ? ownerMap.get(r.owner) || r.owner : undefined,
        direction: r.direction,
        peer: preferredCallPeer({ peer: r.peer }),
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
  const wacallsUrl = process.env.WACALLS_URL || null;
  const wahaplusUrl = process.env.WAHAPLUS_URL || "http://vendedoraai_wahaplus:3000";
  res.json({
    gateways: {
      wacalls: {
        configured: !!wacallsUrl,
        bridgeUrl: wacallsUrl,
        sseConnected: getWaCallsBridge().isConnected,
      },
      wahaplus: {
        configured: !!wahaplusUrl,
        bridgeUrl: wahaplusUrl,
        sseConnected: getWahaplusBridge().isConnected,
      },
    },
    activeGateway: voiceGateway.kind,
    capabilities: voiceGateway.capabilities,
  });
});

export default router;
