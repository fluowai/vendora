import { Router, Request, Response } from "express";
import { getPublishedAgents, getAgentsBySegment, getTopRatedAgents, getMostInstalledAgents } from "../lib/agent-engine.ts";

const router = Router();

router.get("/agents", async (_req: Request, res: Response) => {
  const { segment, sort } = _req.query as any;

  let agents = await getPublishedAgents();

  if (segment && segment !== "todos") {
    agents = await getAgentsBySegment(segment as string);
  }

  if (sort === "rating") {
    agents = await getTopRatedAgents(agents.length);
  } else if (sort === "installs") {
    agents = await getMostInstalledAgents(agents.length);
  }

  const segments = [...new Set(agents.map((a: any) => a.segment))];
  const stats = {
    total: agents.length,
    segments,
    segmentsCount: segments.reduce((acc: Record<string, number>, seg: string) => {
      acc[seg] = agents.filter((a: any) => a.segment === seg).length;
      return acc;
    }, {} as Record<string, number>),
  };

  res.json({ agents, stats });
});

router.get("/featured", async (_req: Request, res: Response) => {
  const agents = await getTopRatedAgents(6);
  res.json({ agents });
});

router.get("/trending", async (_req: Request, res: Response) => {
  const agents = await getMostInstalledAgents(6);
  res.json({ agents });
});

router.get("/segments", async (_req: Request, res: Response) => {
  const segments = [
    { id: "vendas", label: "Vendas", icon: "Briefcase", count: 0 },
    { id: "suporte", label: "Suporte", icon: "HelpCircle", count: 0 },
    { id: "retencao", label: "Retenção", icon: "Target", count: 0 },
    { id: "saude", label: "Saúde", icon: "Heart", count: 0 },
    { id: "juridico", label: "Jurídico", icon: "Scale", count: 0 },
    { id: "educacao", label: "Educação", icon: "BookOpen", count: 0 },
    { id: "imobiliario", label: "Imobiliário", icon: "Home", count: 0 },
    { id: "financeiro", label: "Financeiro", icon: "DollarSign", count: 0 },
    { id: "rh", label: "RH", icon: "Users", count: 0 },
    { id: "logistica", label: "Logística", icon: "Truck", count: 0 },
    { id: "ecommerce", label: "E-commerce", icon: "ShoppingCart", count: 0 },
  ];

  const all = await getPublishedAgents();
  for (const seg of segments) {
    seg.count = all.filter((a: any) => a.segment === seg.id).length;
  }

  res.json({ segments });
});

export default router;
