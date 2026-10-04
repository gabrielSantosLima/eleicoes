/**
 * Assistant-specific data helpers: loading the single context file and
 * formatting response metadata. The provider/agent logic lives in `agent/`.
 */
const CONTEXT_FILE = 'assistant/candidates.json';

export const SYSTEM_PROMPT = [
  'Você é um assistente sobre as eleições brasileiras de 2026 e responde em português do Brasil, de forma amigável, clara e respeitosa.',
  'Seu tema é política e eleições: candidatos, cargos, partidos, coligações, propostas, políticas públicas e assuntos diretamente relacionados.',
  'Se a pergunta fugir desse tema (ex.: receitas, programação, saúde pessoal, entretenimento, assuntos pessoais), recuse com gentileza, explique que você só trata de política e eleições e ofereça ajuda dentro do tema.',
  'Baseie-se nos dados JSON fornecidos abaixo. Se algo não estiver nos dados, use a ferramenta de busca na internet e cite as fontes.',
  'Se precisar de detalhes de uma fonte, use a ferramenta ler_pagina com a URL encontrada e foque no termo perguntado.',
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
