import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Bot,
  GitBranch,
  Hand,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Save,
  Send,
  Square,
  Wrench,
  Workflow,
  Zap,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { api } from "@/src/lib/api";

type FlowNodeData = {
  label: string
  type: string
  text?: string
  variable?: string
  agentId?: string
  prompt?: string
  departmentId?: string
  toolName?: string
  args?: Record<string, any>
  stopOnError?: boolean
  isStart?: boolean
}

type FlowEdgeData = Edge & {
  condition?: {
    variable?: string
    operator?: string
    value?: string
  }
}

const nodeTypes = [
  { type: "message", label: "Mensagem", icon: MessageSquare },
  { type: "question", label: "Pergunta", icon: GitBranch },
  { type: "agent", label: "Agente IA", icon: Bot },
  { type: "tool", label: "Ferramenta", icon: Wrench },
  { type: "condition", label: "Condicao", icon: Workflow },
  { type: "handoff", label: "Humano", icon: Hand },
  { type: "end", label: "Fim", icon: Square },
];

const defaultGraph = {
  startNodeId: "start",
  nodes: [
    { id: "start", type: "message", data: { text: "Ola! Recebi sua mensagem e vou iniciar seu atendimento." }, position: { x: 160, y: 120 } },
    { id: "ask_name", type: "question", data: { text: "Para continuar, qual e o seu nome?", variable: "contactName" }, position: { x: 160, y: 280 } },
    { id: "end", type: "end", data: { text: "Obrigado, {{contactName}}. Ja tenho o necessario para seguir." }, position: { x: 160, y: 440 } },
  ],
  edges: [
    { source: "start", target: "ask_name" },
    { source: "ask_name", target: "end" },
  ],
};

function nodeLabel(type: string, data: any) {
  if (type === "question") return data?.text || "Pergunta";
  if (type === "agent") return data?.prompt || "Agente IA";
  if (type === "tool") return data?.toolName || "Ferramenta";
  if (type === "condition") return "Condicao";
  if (type === "handoff") return "Transferir";
  if (type === "end") return data?.text || "Fim";
  return data?.text || "Mensagem";
}

function conditionLabel(condition?: FlowEdgeData["condition"]) {
  if (!condition?.variable) return "";
  const operator = condition.operator || "equals";
  const value = operator === "exists" || operator === "not_exists" ? "" : ` ${condition.value || ""}`;
  return `${condition.variable} ${operator}${value}`.trim();
}

function graphToCanvas(graph: any) {
  const nodes = (graph?.nodes || []).map((node: any, index: number) => ({
    id: node.id,
    type: "default",
    position: node.position || { x: 160 + (index % 3) * 260, y: 120 + Math.floor(index / 3) * 160 },
    data: {
      ...(node.data || {}),
      type: node.type,
      label: nodeLabel(node.type, node.data),
      isStart: node.id === (graph?.startNodeId || graph?.nodes?.[0]?.id),
    } as FlowNodeData,
  }));
  const edges = (graph?.edges || []).map((edge: any, index: number) => ({
    id: edge.id || `${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    animated: true,
    condition: edge.condition,
    label: conditionLabel(edge.condition),
  }));
  return { nodes, edges };
}

function canvasToGraph(nodes: Node<FlowNodeData>[], edges: FlowEdgeData[]) {
  const startNode = nodes.find((node) => node.data.isStart) || nodes[0];
  return {
    startNodeId: startNode?.id,
    nodes: nodes.map((node) => {
      const { label: _label, type, ...data } = node.data;
      return {
        id: node.id,
        type,
        data,
        position: node.position,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      condition: edge.condition,
    })),
  };
}

export default function Automations() {
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeData>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testInput, setTestInput] = useState("Oi, quero atendimento");
  const [testOutput, setTestOutput] = useState("");

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) || null,
    [edges, selectedEdgeId],
  );

  const loadFlows = useCallback(async () => {
    const res = await api.getFlows();
    setFlows(res.flows);
    if (!selectedFlowId && res.flows[0]?.id) setSelectedFlowId(res.flows[0].id);
  }, [selectedFlowId]);

  useEffect(() => {
    Promise.all([
      loadFlows(),
      api.getAgents().then((res) => setAgents(res.agents)).catch(() => setAgents([])),
      api.getTools().then((res) => setTools(res.tools)).catch(() => setTools([])),
    ]).finally(() => setLoading(false));
  }, [loadFlows]);

  useEffect(() => {
    if (!selectedFlowId) {
      const canvas = graphToCanvas(defaultGraph);
      setNodes(canvas.nodes);
      setEdges(canvas.edges);
      return;
    }
    api.getFlow(selectedFlowId).then((res) => {
      setSelectedFlow(res.flow);
      const latestVersion = res.flow.versions?.[0];
      const canvas = graphToCanvas(latestVersion?.graph || defaultGraph);
      setNodes(canvas.nodes);
      setEdges(canvas.edges);
      setSelectedNodeId(canvas.nodes[0]?.id || null);
    });
    api.getFlowAnalytics(selectedFlowId)
      .then((res) => setAnalytics(res.analytics))
      .catch(() => setAnalytics(null));
  }, [selectedFlowId, setEdges, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((items) => addEdge({ ...connection, animated: true }, items)),
    [setEdges],
  );

  async function handleCreateFlow() {
    setSaving(true);
    try {
      const created = await api.createFlow({
        name: `Fluxo ${flows.length + 1}`,
        description: "Atendimento conversacional",
        trigger: "new_message",
        channel: "whatsmeow",
        publicEnabled: true,
        graph: defaultGraph,
      });
      const version = created.flow.versions?.[0];
      if (version?.id) await api.publishFlowVersion(created.flow.id, version.id);
      await loadFlows();
      setSelectedFlowId(created.flow.id);
    } finally {
      setSaving(false);
    }
  }

  function handleAddNode(type: string) {
    const config = nodeTypes.find((item) => item.type === type);
    const id = `${type}_${Date.now()}`;
    const data: FlowNodeData = {
      type,
      label: config?.label || type,
      text: type === "end" ? "Atendimento finalizado." : type === "question" ? "Qual informacao voce pode me passar?" : "Mensagem do fluxo.",
      variable: type === "question" ? `resposta_${nodes.length + 1}` : undefined,
      toolName: type === "tool" ? "create_ticket" : undefined,
      args: type === "tool" ? { title: "Atendimento via IA", description: "Criado pelo fluxo" } : undefined,
    };
    setNodes((items) => [
      ...items,
      {
        id,
        type: "default",
        position: { x: 180 + (items.length % 3) * 260, y: 140 + Math.floor(items.length / 3) * 150 },
        data: { ...data, label: nodeLabel(type, data) },
      },
    ]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }

  function updateSelectedNode(patch: Partial<FlowNodeData>) {
    if (!selectedNodeId) return;
    setNodes((items) => items.map((node) => {
      if (node.id !== selectedNodeId) return node;
      const nextData = { ...node.data, ...patch };
      return { ...node, data: { ...nextData, label: nodeLabel(nextData.type, nextData) } };
    }));
  }

  function setStartNode(nodeId: string) {
    setNodes((items) => items.map((node) => ({
      ...node,
      data: { ...node.data, isStart: node.id === nodeId },
    })));
  }

  function updateSelectedEdgeCondition(patch: NonNullable<FlowEdgeData["condition"]>) {
    if (!selectedEdgeId) return;
    setEdges((items) => items.map((edge) => {
      if (edge.id !== selectedEdgeId) return edge;
      const condition = { ...(edge.condition || {}), ...patch };
      return { ...edge, condition, label: conditionLabel(condition) };
    }));
  }

  function clearSelectedEdgeCondition() {
    if (!selectedEdgeId) return;
    setEdges((items) => items.map((edge) => (
      edge.id === selectedEdgeId ? { ...edge, condition: undefined, label: undefined } : edge
    )));
  }

  async function handleSavePublish() {
    if (!selectedFlowId) return;
    setSaving(true);
    try {
      const version = await api.createFlowVersion(selectedFlowId, canvasToGraph(nodes, edges));
      await api.publishFlowVersion(selectedFlowId, version.version.id);
      await loadFlows();
      const refreshed = await api.getFlow(selectedFlowId);
      setSelectedFlow(refreshed.flow);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!selectedFlowId) return;
    setSaving(true);
    setTestOutput("");
    try {
      const version = await api.createFlowVersion(selectedFlowId, canvasToGraph(nodes, edges));
      await api.publishFlowVersion(selectedFlowId, version.version.id);
      const result = await api.executeFlow(selectedFlowId, { input: testInput });
      setTestOutput((result.outputs || []).map((item: any) => item.content).filter(Boolean).join("\n"));
    } catch (error: any) {
      setTestOutput(error.message || "Erro ao testar fluxo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold flex items-center gap-2 mb-1">
            <Zap className="w-7 h-7 text-primary" /> Automacoes Visuais
          </h1>
          <p className="text-muted text-sm">Fluxos conversacionais, agentes IA e handoff humano.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleCreateFlow} disabled={saving} className="px-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-bg disabled:opacity-60">
            <Plus className="w-4 h-4" /> Novo
          </button>
          <button onClick={handleTest} disabled={saving || !selectedFlowId} className="px-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-bg disabled:opacity-60">
            <Play className="w-4 h-4" /> Testar
          </button>
          <button onClick={handleSavePublish} disabled={saving || !selectedFlowId} className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-primary/90 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Publicar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_320px] gap-4 min-h-[720px]">
        <aside className="bg-surface border border-border rounded-2xl p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Fluxos</h2>
          {loading && <div className="text-xs text-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando</div>}
          {flows.map((flow) => (
            <button
              key={flow.id}
              onClick={() => setSelectedFlowId(flow.id)}
              className={cn(
                "w-full p-3 rounded-xl border text-left transition-all",
                selectedFlowId === flow.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-bg border-border hover:border-primary/30",
              )}
            >
              <span className="block text-sm font-bold truncate">{flow.name}</span>
              <span className="block text-[10px] text-muted uppercase mt-1">{flow.status} | {flow.trigger}</span>
            </button>
          ))}
        </aside>

        <main className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="border-b border-border p-3 flex flex-wrap gap-2 bg-bg">
            {nodeTypes.map((item) => (
              <button
                key={item.type}
                onClick={() => handleAddNode(item.type)}
                className="px-3 py-2 bg-surface border border-border rounded-xl text-[10px] font-bold flex items-center gap-2 hover:border-primary/30"
              >
                <item.icon className="w-4 h-4 text-primary" /> {item.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-[620px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
              }}
              onEdgeClick={(_, edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedNodeId(null);
              }}
              fitView
            >
              <Background />
              <MiniMap pannable zoomable />
              <Controls />
            </ReactFlow>
          </div>
        </main>

        <aside className="bg-surface border border-border rounded-2xl p-4 space-y-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Propriedades</h2>
            <p className="text-sm font-bold mt-2">{selectedFlow?.name || "Novo fluxo"}</p>
          </div>

          {selectedFlowId && (
            <button
              onClick={async () => {
                const next = !selectedFlow?.publicEnabled;
                const res = await api.updateFlow(selectedFlowId, { publicEnabled: next });
                setSelectedFlow(res.flow);
                await loadFlows();
              }}
              className={cn(
                "w-full p-3 rounded-xl border text-left text-xs font-bold transition-all",
                selectedFlow?.publicEnabled ? "bg-primary/10 border-primary/30 text-primary" : "bg-bg border-border text-muted hover:border-primary/30",
              )}
            >
              Widget publico: {selectedFlow?.publicEnabled ? "ativo" : "desativado"}
            </button>
          )}

          {analytics && (
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Runs", analytics.total],
                ["30 dias", analytics.recentRuns],
                ["Concluidos", analytics.completed],
                ["Falhas", analytics.failed],
              ].map(([label, value]) => (
                <div key={label} className="bg-bg border border-border rounded-xl p-3">
                  <p className="text-lg font-display font-bold">{value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted">{label}</p>
                </div>
              ))}
            </div>
          )}

          {selectedNode ? (
            <div className="space-y-3">
              <button
                onClick={() => setStartNode(selectedNode.id)}
                className={cn(
                  "w-full p-3 rounded-xl border text-left text-xs font-bold transition-all",
                  selectedNode.data.isStart ? "bg-primary/10 border-primary/30 text-primary" : "bg-bg border-border text-muted hover:border-primary/30",
                )}
              >
                Bloco inicial: {selectedNode.data.isStart ? "sim" : "definir este bloco"}
              </button>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Tipo</label>
                <select
                  value={selectedNode.data.type}
                  onChange={(event) => updateSelectedNode({ type: event.target.value })}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm outline-none"
                >
                  {nodeTypes.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
                </select>
              </div>

              {(selectedNode.data.type === "message" || selectedNode.data.type === "question" || selectedNode.data.type === "end") && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Texto</label>
                  <textarea
                    value={selectedNode.data.text || ""}
                    onChange={(event) => updateSelectedNode({ text: event.target.value })}
                    className="w-full h-28 bg-bg border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  />
                </div>
              )}

              {selectedNode.data.type === "question" && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Variavel</label>
                  <input
                    value={selectedNode.data.variable || ""}
                    onChange={(event) => updateSelectedNode({ variable: event.target.value })}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
              )}

              {selectedNode.data.type === "agent" && (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Agente</label>
                    <select
                      value={selectedNode.data.agentId || ""}
                      onChange={(event) => updateSelectedNode({ agentId: event.target.value })}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm outline-none"
                    >
                      <option value="">Selecionar</option>
                      {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Prompt</label>
                    <textarea
                      value={selectedNode.data.prompt || ""}
                      onChange={(event) => updateSelectedNode({ prompt: event.target.value })}
                      className="w-full h-28 bg-bg border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none"
                    />
                  </div>
                </>
              )}

              {selectedNode.data.type === "tool" && (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Ferramenta</label>
                    <select
                      value={selectedNode.data.toolName || ""}
                      onChange={(event) => updateSelectedNode({ toolName: event.target.value })}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm outline-none"
                    >
                      {tools.map((tool) => <option key={tool.name} value={tool.name}>{tool.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Argumentos JSON</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.args || {}, null, 2)}
                      onChange={(event) => {
                        try {
                          updateSelectedNode({ args: JSON.parse(event.target.value) });
                        } catch {
                        }
                      }}
                      className="w-full h-36 bg-bg border border-border rounded-xl px-3 py-2 text-xs font-mono outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Variavel de saida</label>
                    <input
                      value={selectedNode.data.variable || ""}
                      onChange={(event) => updateSelectedNode({ variable: event.target.value })}
                      placeholder="toolResult"
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          ) : selectedEdge ? (
            <div className="space-y-3">
              <div className="bg-bg border border-border rounded-xl p-3">
                <p className="text-xs font-bold">{selectedEdge.source} {"->"} {selectedEdge.target}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted mt-1">Condicao da conexao</p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Variavel</label>
                <input
                  value={selectedEdge.condition?.variable || "input"}
                  onChange={(event) => updateSelectedEdgeCondition({ variable: event.target.value })}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Operador</label>
                <select
                  value={selectedEdge.condition?.operator || "equals"}
                  onChange={(event) => updateSelectedEdgeCondition({ operator: event.target.value })}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm outline-none"
                >
                  <option value="equals">Igual</option>
                  <option value="not_equals">Diferente</option>
                  <option value="contains">Contem</option>
                  <option value="not_contains">Nao contem</option>
                  <option value="exists">Existe</option>
                  <option value="not_exists">Nao existe</option>
                </select>
              </div>
              {selectedEdge.condition?.operator !== "exists" && selectedEdge.condition?.operator !== "not_exists" && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">Valor</label>
                  <input
                    value={selectedEdge.condition?.value || ""}
                    onChange={(event) => updateSelectedEdgeCondition({ value: event.target.value })}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
              )}
              <button
                onClick={clearSelectedEdgeCondition}
                className="w-full p-3 rounded-xl border bg-bg border-border text-muted text-xs font-bold hover:border-primary/30"
              >
                Remover condicao
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted">Selecione um bloco ou conexao.</p>
          )}

          <div className="pt-4 border-t border-border space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted block">Teste</label>
            <div className="flex gap-2">
              <input
                value={testInput}
                onChange={(event) => setTestInput(event.target.value)}
                className="min-w-0 flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-xs outline-none"
              />
              <button onClick={handleTest} disabled={saving || !selectedFlowId} className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center disabled:opacity-60">
                <Send className="w-4 h-4" />
              </button>
            </div>
            {testOutput && (
              <pre className="bg-bg border border-border rounded-xl p-3 text-xs whitespace-pre-wrap max-h-40 overflow-auto">{testOutput}</pre>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
