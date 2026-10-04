/**
 * Assistant-specific data helpers: loading the single context file and
 * formatting response metadata. The provider/agent logic lives in `agent/`.
 */
const CONTEXT_FILE = 'assistant/candidates.json';

export const SYSTEM_PROMPT = [
  'Você é um assistente sobre as eleições brasileiras de 2026 e responde em português do Brasil.',
  'Baseie-se nos dados JSON fornecidos abaixo. Se algo não estiver nos dados, use a ferramenta de busca na internet e cite as fontes.',
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

export function formatMetadata(elapsedMs, usage) {
  const seconds = (elapsedMs / 1000).toFixed(1).replace('.', ',');
  if (!usage) return `> ⏱ ${seconds}s`;
  const total = usage.total_tokens ?? '?';
  const prompt = usage.prompt_tokens ?? '?';
  const completion = usage.completion_tokens ?? '?';
  return `> ⏱ ${seconds}s · tokens ${total} (prompt ${prompt} · resposta ${completion})`;
}
