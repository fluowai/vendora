import { GoogleGenAI } from "@google/genai";
import { LLMConfig, LLMProvider } from "../../src/types/index.ts";

interface LLMResponse {
  text: string
  usage?: { promptTokens: number; completionTokens: number }
}

export async function executeLLM(config: LLMConfig, prompt: string, context?: string): Promise<LLMResponse> {
  switch (config.provider) {
    case 'gemini':
      return executeGemini(config, prompt, context)
    case 'openai':
      return executeOpenAI(config, prompt, context)
    case 'anthropic':
      return executeAnthropic(config, prompt, context)
    case 'groq':
      return executeGroq(config, prompt, context)
    default:
      throw new Error(`Unsupported provider: ${config.provider}`)
  }
}

async function executeGemini(config: LLMConfig, prompt: string, context?: string): Promise<LLMResponse> {
  const ai = new GoogleGenAI({
    apiKey: config.apiKey || process.env.GEMINI_API_KEY,
  })

  const systemInstruction = context
    ? `${config.systemPrompt || ''}\n\nContexto atual: ${context}`
    : config.systemPrompt

  const response = await ai.models.generateContent({
    model: config.model || "gemini-3-flash-preview",
    contents: prompt,
    config: systemInstruction ? {
      systemInstruction,
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxTokens ?? 1024,
    } : {
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxTokens ?? 1024,
    },
  })

  return {
    text: response.text || '',
    usage: {
      promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    },
  }
}

async function executeOpenAI(config: LLMConfig, prompt: string, context?: string): Promise<LLMResponse> {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const messages: any[] = []
  if (config.systemPrompt || context) {
    messages.push({
      role: 'system',
      content: [config.systemPrompt, context].filter(Boolean).join('\n\nContexto: '),
    })
  }
  messages.push({ role: 'user', content: prompt })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4-turbo',
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 1024,
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(`OpenAI error: ${data.error?.message || response.statusText}`)

  return {
    text: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  }
}

async function executeAnthropic(config: LLMConfig, prompt: string, context?: string): Promise<LLMResponse> {
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API key not configured')

  const systemPrompt = [config.systemPrompt, context].filter(Boolean).join('\n\nContexto: ')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-opus-20240229',
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: config.maxTokens ?? 1024,
      temperature: config.temperature ?? 0.7,
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(`Anthropic error: ${data.error?.message || response.statusText}`)

  return {
    text: data.content?.[0]?.text || '',
    usage: {
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
    },
  }
}

async function executeGroq(config: LLMConfig, prompt: string, context?: string): Promise<LLMResponse> {
  const apiKey = config.apiKey || process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('Groq API key not configured')

  const messages: any[] = []
  if (config.systemPrompt || context) {
    messages.push({
      role: 'system',
      content: [config.systemPrompt, context].filter(Boolean).join('\n\nContexto: '),
    })
  }
  messages.push({ role: 'user', content: prompt })

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'llama-3.3-70b-versatile',
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 1024,
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(`Groq error: ${data.error?.message || response.statusText}`)

  return {
    text: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  }
}

export const AVAILABLE_MODELS: Record<LLMProvider, { id: string; name: string }[]> = {
  gemini: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  ],
  openai: [
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
  anthropic: [
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Fast)' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B' },
  ],
  custom: [
    { id: 'custom', name: 'Custom endpoint' },
  ],
}

export const SEGMENT_PROMPTS: Record<string, string> = {
  saude: 'Você é um assistente de saúde. Mantenha tom profissional e ético. Nunca forneça diagnósticos definitivos. Oriente o paciente a buscar um profissional para casos graves.',
  juridico: 'Você é um assistente jurídico. Use linguagem formal e precisa. Informe que não substitui um advogado. Ajude com informações gerais sobre legislação.',
  educacao: 'Você é um tutor educacional. Seja paciente e didático. Adapte a explicação ao nível do aluno. Incentive o aprendizado ativo.',
  imobiliario: 'Você é um corretor virtual. Seja persuasivo mas honesto. Destaque os benefícios dos imóveis. Ajude a qualificar leads.',
  financeiro: 'Você é um analista financeiro. Seja conservador nas recomendações. Informe riscos. Nunca prometa retornos garantidos.',
  rh: 'Você é um recrutador assistente. Seja profissional e acolhedor. Ajude a triar candidatos de forma justa e imparcial.',
  logistica: 'Você é um assistente de logística. Foque em prazos, fretes e rastreios. Seja objetivo e direto.',
  ecommerce: 'Você é um vendedor de e-commerce. Ajude com recomendações de produtos. Esclareça dúvidas sobre estoque, pagamento e entrega.',
}
