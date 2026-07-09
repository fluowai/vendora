import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { executeAgent, getAgent } from "../lib/agent-engine.ts";
import { executeFlow } from "../lib/flow-engine.ts";

const router = Router();

router.get("/widget.js", (_req: Request, res: Response) => {
  res.type("application/javascript").send(`
(function(){
  var script = document.currentScript;
  var cfg = {
    agentId: script && script.dataset.agentId,
    flowId: script && script.dataset.flowId,
    title: (script && script.dataset.title) || 'Assistente Virtual',
    color: (script && script.dataset.color) || '#25D366'
  };
  if (!cfg.agentId && !cfg.flowId) return;
  var base = new URL(script.src).origin;
  var state = { open: false, runId: null };
  var root = document.createElement('div');
  root.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:2147483647;font-family:Inter,Arial,sans-serif';
  root.innerHTML = '<button data-vda-toggle style="width:56px;height:56px;border-radius:999px;border:0;background:'+cfg.color+';color:white;font-weight:700;box-shadow:0 12px 30px rgba(0,0,0,.18);cursor:pointer">IA</button><div data-vda-panel style="display:none;position:absolute;right:0;bottom:72px;width:360px;max-width:calc(100vw - 32px);height:520px;background:white;border:1px solid #E2E8F0;border-radius:16px;box-shadow:0 18px 60px rgba(15,23,42,.18);overflow:hidden"><div style="padding:14px 16px;background:'+cfg.color+';color:white;font-weight:700">'+cfg.title+'</div><div data-vda-msgs style="height:398px;overflow:auto;padding:14px;background:#F8FAFC"></div><form data-vda-form style="display:flex;gap:8px;padding:12px;border-top:1px solid #E2E8F0"><input data-vda-input placeholder="Digite sua mensagem..." style="flex:1;border:1px solid #E2E8F0;border-radius:10px;padding:10px;outline:none"/><button style="border:0;border-radius:10px;background:'+cfg.color+';color:white;padding:0 14px;font-weight:700;cursor:pointer">Enviar</button></form></div>';
  document.body.appendChild(root);
  var panel = root.querySelector('[data-vda-panel]');
  var msgs = root.querySelector('[data-vda-msgs]');
  var form = root.querySelector('[data-vda-form]');
  var input = root.querySelector('[data-vda-input]');
  function add(role, text){
    var item = document.createElement('div');
    item.style.cssText = 'margin:8px 0;display:flex;'+(role === 'user' ? 'justify-content:flex-end' : 'justify-content:flex-start');
    item.innerHTML = '<div style="max-width:80%;border-radius:14px;padding:9px 11px;font-size:13px;line-height:1.35;background:'+(role === 'user' ? '#E2E8F0;color:#0F172A' : cfg.color+';color:white')+'"></div>';
    item.firstChild.textContent = text;
    msgs.appendChild(item);
    msgs.scrollTop = msgs.scrollHeight;
  }
  root.querySelector('[data-vda-toggle]').onclick = function(){ state.open = !state.open; panel.style.display = state.open ? 'block' : 'none'; };
  form.onsubmit = async function(ev){
    ev.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    add('user', text);
    try {
      var path = cfg.flowId ? '/api/public/flows/'+cfg.flowId+'/execute' : '/api/public/agents/'+cfg.agentId+'/chat';
      var payload = cfg.flowId ? { input: text, runId: state.runId } : { message: text };
      var resp = await fetch(base + path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      var data = await resp.json();
      if (data.runId) state.runId = data.runId;
      var output = data.response || (data.outputs || []).map(function(o){ return o.content; }).filter(Boolean).join('\\n') || data.error || 'Nao consegui responder agora.';
      add('agent', output);
    } catch (e) {
      add('agent', 'Nao consegui responder agora.');
    }
  };
})();`);
});

router.post("/agents/:id/chat", async (req: Request, res: Response) => {
  const agent = await getAgent(req.params.id);
  if (!agent || agent.status !== "active" || !agent.isPublished) {
    res.status(404).json({ error: "Agente publico nao encontrado" });
    return;
  }
  try {
    const result = await executeAgent(agent, String(req.body.message || ""));
    res.json({ response: result.response, metadata: result.metadata });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Erro ao responder" });
  }
});

router.post("/flows/:id/execute", async (req: Request, res: Response) => {
  const flow = await prisma.agentFlow.findFirst({
    where: { id: req.params.id, status: "active", publicEnabled: true },
  });
  if (!flow) {
    res.status(404).json({ error: "Fluxo publico nao encontrado" });
    return;
  }
  try {
    const runId = req.body.runId ? String(req.body.runId) : undefined;
    const result = await executeFlow({
      tenantId: flow.tenantId,
      flowId: flow.id,
      runId,
      input: String(req.body.input || ""),
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Erro ao executar fluxo" });
  }
});

export default router;
