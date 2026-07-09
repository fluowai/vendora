import { useState, useRef, useCallback, useEffect } from "react";
import { AudioManager } from "../lib/audio";

export type WebRTCCallStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export function useWebRTCCall() {
  const [status, setStatus] = useState<WebRTCCallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const activeCallIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.stop();
      audioRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.onopen = null;
      dcRef.current.onclose = null;
      dcRef.current.onmessage = null;
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    activeCallIdRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
    setError(null);
  }, [cleanup]);

  const start = useCallback(
    async (
      sessionId: string,
      callId: string,
      sendSDP: (callId: string, sdpOffer: string) => Promise<{ sdp_answer: string }>,
    ) => {
      stop();
      activeCallIdRef.current = callId;
      setStatus("connecting");
      setError(null);

      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pcRef.current = pc;

        const dc = pc.createDataChannel("pcm", { ordered: true });
        dc.binaryType = "arraybuffer";
        dcRef.current = dc;

        const handleDataChannelOpen = () => {
          setStatus("connected");
          if (!audioRef.current) return;
          audioRef.current.onAudioData = (data) => {
            if (dc.readyState === "open") {
              try { dc.send(data); } catch {}
            }
          };
        };

        pc.oniceconnectionstatechange = () => {
          const s = pc.iceConnectionState;
          if (s === "disconnected" || s === "failed" || s === "closed") {
            setStatus("disconnected");
            cleanup();
          }
        };

        dc.onopen = handleDataChannelOpen;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (pc.iceGatheringState !== "complete") {
          await new Promise<void>((resolve) => {
            const handler = () => {
              if (pc.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", handler);
                resolve();
              }
            };
            pc.addEventListener("icegatheringstatechange", handler);
          });
        }

        if (activeCallIdRef.current !== callId) return;

        const { sdp_answer } = await sendSDP(callId, pc.localDescription!.sdp);
        if (activeCallIdRef.current !== callId) return;

        await pc.setRemoteDescription({ type: "answer", sdp: sdp_answer });

        const audio = new AudioManager();
        await audio.start();
        audioRef.current = audio;

        if (dc.readyState === "open") {
          handleDataChannelOpen();
        }

        dc.onmessage = (e) => {
          const int16 = new Int16Array(e.data as ArrayBuffer);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
          }
          audio.enqueuePlayback(float32);
        };

        dc.onclose = () => {
          setStatus("disconnected");
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "WebRTC error";
        setError(msg);
        setStatus("error");
        cleanup();
      }
    },
    [stop, cleanup],
  );

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { status, error, start, stop };
}
