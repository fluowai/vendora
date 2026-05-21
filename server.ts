import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Gemini AI Setup
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Mock Database / State (In-memory for demo)
const mockData = {
  conversations: [
    { id: '1', contact: 'João Silva', lastMessage: 'Olá, gostaria de saber mais.', time: '10:30', status: 'active', channel: 'whatsapp' },
    { id: '2', contact: 'Maria Souza', lastMessage: 'Como funciona o plano Growth?', time: '09:45', status: 'waiting', channel: 'instagram' },
  ],
  leads: [
    { id: '1', name: 'João Silva', stage: 'new', value: 1500 },
    { id: '2', name: 'Maria Souza', stage: 'negotiation', value: 3000 },
  ]
};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/ai/chat", async (req, res) => {
  const { message, context } = req.body;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: `Você é um agente de IA de vendas para a Vendaora AI. Seu tom é profissional, amigável e focado em conversão. Contexto atual: ${JSON.stringify(context)}`,
      },
    });
    res.json({ response: response.text });
  } catch (error: any) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "Erro ao processar IA" });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
