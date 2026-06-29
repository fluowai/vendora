import { Request, Response, Express } from "express";

const counters = {
  httpRequestsTotal: 0,
  httpRequestsByRoute: {} as Record<string, number>,
  httpRequestDurationByRoute: {} as Record<string, number[]>,
  llmCallsTotal: 0,
  llmCallsByProvider: {} as Record<string, number>,
  messagesProcessedTotal: 0,
};

export function incrementLlmCalls(provider: string) {
  counters.llmCallsTotal++;
  counters.llmCallsByProvider[provider] = (counters.llmCallsByProvider[provider] || 0) + 1;
}

export function incrementMessagesProcessed() {
  counters.messagesProcessedTotal++;
}

export function trackHttpRequest(req: Request, res: Response, next: any) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const route = `${req.method} ${req.path}`;
    counters.httpRequestsTotal++;
    counters.httpRequestsByRoute[route] = (counters.httpRequestsByRoute[route] || 0) + 1;
    if (!counters.httpRequestDurationByRoute[route]) {
      counters.httpRequestDurationByRoute[route] = [];
    }
    counters.httpRequestDurationByRoute[route].push(duration);
  });
  next();
}

export function getMetrics() {
  const avgDuration: Record<string, number> = {};
  for (const [route, durations] of Object.entries(counters.httpRequestDurationByRoute)) {
    const sum = durations.reduce((a, b) => a + b, 0);
    avgDuration[route] = Math.round(sum / durations.length);
  }

  return {
    http: {
      totalRequests: counters.httpRequestsTotal,
      byRoute: counters.httpRequestsByRoute,
      avgDurationMs: avgDuration,
    },
    llm: {
      totalCalls: counters.llmCallsTotal,
      byProvider: counters.llmCallsByProvider,
    },
    messages: {
      totalProcessed: counters.messagesProcessedTotal,
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
}

export function registerMetricsEndpoint(app: Express) {
  app.get("/api/metrics", (_req: Request, res: Response) => {
    res.json(getMetrics());
  });
}
