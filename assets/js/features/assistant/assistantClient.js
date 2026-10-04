/**
 * Assistant client: loads the single context file and calls an OpenAI-compatible
 * Chat Completions endpoint directly from the browser (BYO key).
 */
import {
  CHAT_COMPLETIONS_PATH,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  MODELS_PATH,
} from './providerCatalog.js';

const CONTEXT_FILE = 'assistant/candidates.json';

// Heuristic filter to hide non-chat models (embeddings, images, audio, video...).
const NON_CHAT_MODEL = /(embed|rerank|whisper|tts|veo|flux|stable-diffusion|sdxl|bge-|clip|image|audio|kling|video)/i;

export const SYSTEM_PROMPT = [
  'Você é um assistente sobre as eleições brasileiras de 2026 e responde em português do Brasil.',
  'Baseie-se SOMENTE nos dados JSON fornecidos abaixo. Se algo não estiver nos dados, diga "não encontrado".',
  'Seja objetivo. Ao sugerir ou citar um candidato, informe o cargo e o número.',
  'Não invente números, propostas ou notícias.',
  'DADOS (JSON com candidatos, números e resumos de propostas):',
].join('\n');

export async function loadContext() {
  const response = await fetch(CONTEXT_FILE, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Falha ao carregar ${CONTEXT_FILE} (HTTP ${response.status})`);
  return response.json();
}

export function buildSystemContent(context) {
  return `${SYSTEM_PROMPT}\n${JSON.stringify(context)}`;
}

export async function listModels({ provider, apiKey }) {
  try {
    const response = await fetch(`${provider.baseUrl}${MODELS_PATH}`, {
      headers: { Authorization: `Bearer ${apiKey}`, ...provider.extraHeaders },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const items = data.data ?? data.models ?? [];
    const ids = items
      .map((model) => model.id ?? model.name)
      .filter((id) => id && !NON_CHAT_MODEL.test(id));
    return ids.length ? ids.sort((a, b) => a.localeCompare(b)) : [provider.model];
  } catch {
    return [provider.model];
  }
}

function toApiMessages(history) {
  return history.map((message) => ({
    role: message.role === 'ai' ? 'assistant' : message.role,
    content: message.text ?? '',
  }));
}

export async function requestChatCompletion({
  provider,
  apiKey,
  model,
  systemContent,
  history,
  temperature = DEFAULT_TEMPERATURE,
  maxTokens = DEFAULT_MAX_TOKENS,
}) {
  const startedAt = performance.now();
  const response = await fetch(`${provider.baseUrl}${CHAT_COMPLETIONS_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...provider.extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: systemContent }, ...toApiMessages(history)],
    }),
  });
  const elapsedMs = performance.now() - startedAt;

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
  }

  const data = await response.json();
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    usage: data.usage,
    elapsedMs,
  };
}

export function formatMetadata(elapsedMs, usage) {
  const seconds = (elapsedMs / 1000).toFixed(1).replace('.', ',');
  if (!usage) return `> ⏱ ${seconds}s`;
  const total = usage.total_tokens ?? '?';
  const prompt = usage.prompt_tokens ?? '?';
  const completion = usage.completion_tokens ?? '?';
  return `> ⏱ ${seconds}s · tokens ${total} (prompt ${prompt} · resposta ${completion})`;
}
