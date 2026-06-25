import prisma from "./prisma.ts";

export async function createKnowledgeBase(name: string, tenantId: string) {
  const kb = await prisma.knowledgeBase.create({
    data: { name, tenant: { connect: { id: tenantId } } },
  });
  return kb;
}

export async function getKnowledgeBase(id: string) {
  return prisma.knowledgeBase.findUnique({ where: { id } });
}

export async function getAllKnowledgeBases(tenantId?: string) {
  const where: any = {};
  if (tenantId) where.tenantId = tenantId;
  return prisma.knowledgeBase.findMany({ where, orderBy: { createdAt: "desc" } });
}

export async function addDocument(kbId: string, doc: { name: string; type: string; content: string }) {
  const chunks = chunkText(doc.content);
  return prisma.document.create({
    data: {
      name: doc.name,
      type: doc.type,
      content: doc.content,
      chunks,
      knowledgeBase: { connect: { id: kbId } },
    },
  });
}

export async function removeDocument(docId: string) {
  try {
    await prisma.document.delete({ where: { id: docId } });
    return true;
  } catch {
    return false;
  }
}

export async function searchKnowledgeBase(kbId: string, query: string, maxResults = 3) {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    include: { documents: true },
  });

  if (!kb || kb.documents.length === 0) return [];

  const queryLower = query.toLowerCase();
  const scored: { text: string; score: number }[] = [];

  for (const doc of kb.documents) {
    for (const chunk of doc.chunks as string[]) {
      const chunkLower = chunk.toLowerCase();
      let score = 0;

      const keywords = queryLower.split(/\s+/).filter((w) => w.length > 3);
      for (const keyword of keywords) {
        if (chunkLower.includes(keyword)) score += 1;
      }

      if (score > 0) {
        scored.push({ text: chunk, score });
      }
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.text);
}

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  if (!text) return [];

  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ". " : "") + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text.slice(0, chunkSize)];
}
