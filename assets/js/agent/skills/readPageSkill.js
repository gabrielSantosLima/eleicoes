/**
 * Skill: read a web page and return only the relevant content, optimized to
 * use few tokens.
 *
 * The page is fetched through the r.jina.ai reader (CORS-enabled), stripping
 * navigation/boilerplate, then the text is filtered (drop link-heavy blocks)
 * and, when a `termo` is given, focused on the matching paragraphs. The result
 * is truncated to a small budget.
 */
import { defineSkill } from './defineSkill.js';

const READER = 'https://r.jina.ai/';
const REMOVE_SELECTOR = 'nav, header, footer, aside, style, script, sup, .navbox, .reflist, #toc';
const BLOCK_MIN = 60;
const BLOCK_MAX = 380;
const RESULTS_MAX = 5;
const TEXT_MAX = 1500;
const cache = new Map();

function normalize(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokens(text) {
  return normalize(text).split(/\W+/).filter((token) => token.length >= 4);
}

function extractBlocks(markdown) {
  const marker = markdown.indexOf('Markdown Content:');
  let body = marker >= 0 ? markdown.slice(marker + 'Markdown Content:'.length) : markdown;
  body = body.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  return body
    .split(/\n{2,}/)
    .map((block) => block.replace(/[ \t]+/g, ' ').replace(/\n+/g, ' ').trim())
    .filter((block) => block.length >= BLOCK_MIN)
    .filter((block) => {
      const linkCount = (block.match(/\]\(/g) || []).length;
      return !(linkCount >= 2 && linkCount * 20 > block.length);
    })
    .map((block) => block.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'));
}

function pickBlocks(blocks, termo) {
  const queryTokens = tokens(termo || '');
  if (queryTokens.length) {
    const scored = blocks
      .map((block, index) => ({
        block,
        index,
        score: queryTokens.reduce((sum, token) => sum + (normalize(block).includes(token) ? 1 : 0), 0),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index);
    if (scored.length) return scored.slice(0, RESULTS_MAX).map((item) => item.block);
  }
  return blocks.slice(0, 4);
}

export const readPageSkill = defineSkill({
  name: 'ler_pagina',
  description:
    'Lê uma página da web a partir de uma URL e devolve apenas o conteúdo relevante, resumido e otimizado para poucos tokens. Use depois da busca, com a URL de uma fonte. Pode focar por um termo.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL completa (começa com https://).' },
      termo: { type: 'string', description: 'Assunto/termo para focar a leitura (opcional).' },
    },
    required: ['url'],
  },
  async run({ url, termo }, context = {}) {
    const report = typeof context.report === 'function' ? context.report : () => {};
    const target = String(url ?? '').trim();
    if (!/^https?:\/\//.test(target)) return { text: 'URL inválida.', sources: [] };

    const cacheKey = `${target}::${termo ?? ''}`;
    if (cache.has(cacheKey)) {
      report('Usando conteúdo em cache');
      return cache.get(cacheKey);
    }

    report(`Lendo a página: ${target}`);
    let markdown;
    try {
      const response = await fetch(`${READER}${target}`, {
        headers: { 'x-respond-with': 'markdown', 'x-remove-selector': REMOVE_SELECTOR, Accept: 'text/plain' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      markdown = await response.text();
    } catch (error) {
      return { text: `Não foi possível ler a página (${error?.message ?? 'erro'}).`, sources: [] };
    }

    const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : target;
    const picked = pickBlocks(extractBlocks(markdown), termo);
    const text = picked.map((block) => block.slice(0, BLOCK_MAX)).join('\n\n').slice(0, TEXT_MAX);

    report(`${picked.length} trecho(s) relevantes`);
    const output = { text: text || 'Conteúdo não encontrado.', sources: [{ title, url: target }] };
    cache.set(cacheKey, output);
    return output;
  },
});
