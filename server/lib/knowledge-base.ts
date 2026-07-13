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
  const detailed = await searchKnowledgeBaseDetailed(kbId, query, maxResults);
  return detailed.map((result) => result.text);
}

export async function searchKnowledgeBaseDetailed(kbId: string, query: string, maxResults = 3) {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    include: { documents: true },
  });

  if (!kb || kb.documents.length === 0) return [];

  const queryLower = normalize(query);
  const keywords = tokenize(queryLower);
  const scored: { text: string; score: number; documentId: string; documentName: string; chunkIndex: number }[] = [];

  for (const doc of kb.documents) {
    const chunks = Array.isArray(doc.chunks) ? doc.chunks as string[] : chunkText(doc.content);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const chunkLower = normalize(chunk);
      const chunkTokens = new Set(tokenize(chunkLower));
      let score = 0;

      for (const keyword of keywords) {
        if (chunkTokens.has(keyword)) score += 2;
        else if (chunkLower.includes(keyword)) score += 1;
      }

      if (queryLower.length > 12 && chunkLower.includes(queryLower)) {
        score += 8;
      }

      const coverage = keywords.length
        ? keywords.filter((keyword) => chunkLower.includes(keyword)).length / keywords.length
        : 0;
      score += coverage * 4;

      if (score > 0) {
        scored.push({
          text: chunk,
          score,
          documentId: doc.id,
          documentName: doc.name,
          chunkIndex: index,
        });
      }
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

function chunkText(text: string, chunkSize = 500, _overlap = 50): string[] {
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

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  const stopwords = new Set(["para", "pela", "pelo", "como", "quando", "onde", "qual", "quais", "sobre", "com", "sem", "uma", "um", "das", "dos", "que"]);
  return normalize(text)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));
}
