/**
 * Assistant-specific data helpers: loading the local dataset (used by the
 * `consultar_dados` skill) and formatting response metadata. The provider/agent
 * logic lives in `agent/`.
 */
const CONTEXT_FILE = 'assistant/candidates.json';

export const SYSTEM_PROMPT = [
  'Você é um assistente sobre as eleições brasileiras de 2026 e responde em português do Brasil, de forma amigável, clara e respeitosa.',
  'Seu tema é política e eleições: candidatos, cargos, partidos, coligações, propostas, políticas públicas e assuntos diretamente relacionados.',
  'Se a pergunta fugir desse tema (ex.: receitas, programação, saúde pessoal, entretenimento, assuntos pessoais), recuse com gentileza, explique que você só trata de política e eleições e ofereça ajuda dentro do tema.',
  'Para dados dos candidatos (nome, cargo, número e propostas), use a ferramenta consultar_dados antes de responder.',
  'Para informações externas ou recentes, use buscar_na_internet; para detalhes de uma fonte, use ler_pagina — sempre cite as URLs.',
  'Seja objetivo. Ao sugerir ou citar um candidato, informe o cargo e o número.',
  'Não invente números, propostas ou notícias.',
].join('\n');

export async function loadContext() {
  const response = await fetch(CONTEXT_FILE, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Falha ao carregar ${CONTEXT_FILE} (HTTP ${response.status})`);
  return response.json();
}

export function formatMetadata(elapsedMs, usage) {
  const seconds = (elapsedMs / 1000).toFixed(1).replace('.', ',');
  if (!usage) return `> ⏱ ${seconds}s`;
  const total = usage.total_tokens ?? '?';
  const prompt = usage.prompt_tokens ?? '?';
  const completion = usage.completion_tokens ?? '?';
  return `> ⏱ ${seconds}s · tokens ${total} (prompt ${prompt} · resposta ${completion})`;
}
