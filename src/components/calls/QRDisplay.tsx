import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRDisplayProps {
  qr: string
  sessionName: string
}

export function QRDisplay({ qr, sessionName }: QRDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qr, { width: 256, margin: 2 });
    }
  }, [qr]);

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="p-4 bg-white rounded-2xl shadow-sm">
        <canvas ref={canvasRef} />
      </div>
      <div className="text-center space-y-1">
        <p className="font-medium text-sm">Parear "{sessionName}"</p>
        <p className="text-sm text-muted">
          Escaneie com o WhatsApp
        </p>
        <p className="text-xs text-muted/70">
          WhatsApp → Dispositivos Conectados → Conectar Dispositivo
        </p>
      </div>
    </div>
  );
}
