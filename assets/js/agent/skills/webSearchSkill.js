/**
 * Skill: search the internet via the main engines (DuckDuckGo, Bing, Google)
 * plus Wikipedia. Results are normalized, de-duplicated, relevance-filtered and
 * trimmed to keep token usage low.
 *
 * Search engines are fetched through the r.jina.ai reader (CORS-enabled) with
 * `x-respond-with: html`, then parsed with DOMParser.
 */
import { defineSkill } from './defineSkill.js';

const READER = 'https://r.jina.ai/';
const MAX_RESULTS = 6;
const SNIPPET_MAX = 200;
const TEXT_MAX = 1600;

const ENGINES = [
  {
    name: 'DuckDuckGo',
    buildUrl: (query) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    parse: parseDuckDuckGo,
  },
  {
    name: 'Bing',
    buildUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    parse: parseBing,
  },
  {
    name: 'Google',
    buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    parse: parseGoogle,
  },
];

function normalize(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokens(text) {
  return normalize(text).split(/\W+/).filter((token) => token.length >= 4);
}

function textOf(element) {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function base64UrlToUtf8(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function decodeDuckDuckGoUrl(href) {
  if (!href) return null;
  try {
    const url = new URL(href, 'https://duckduckgo.com');
    const target = url.searchParams.get('uddg');
    if (target) return decodeURIComponent(target);
    return href.startsWith('http') ? href : null;
  } catch {
    return null;
  }
}

function decodeBingUrl(href) {
  if (!href) return null;
  if (href.startsWith('http') && !href.includes('bing.com/ck/')) return href;
  try {
    const url = new URL(href, 'https://www.bing.com');
    const target = url.searchParams.get('u');
    if (target && target.startsWith('a1')) return base64UrlToUtf8(target.slice(2));
  } catch {
    /* fall through */
  }
  return href.startsWith('http') ? href : null;
}

function parseDuckDuckGo(doc) {
  return [...doc.querySelectorAll('.result')].map((element) => {
    const anchor = element.querySelector('.result__a');
    return {
      title: textOf(anchor),
      url: decodeDuckDuckGoUrl(anchor?.getAttribute('href')),
      snippet: textOf(element.querySelector('.result__snippet')),
    };
  });
}

function parseBing(doc) {
  return [...doc.querySelectorAll('li.b_algo')].map((element) => {
    const anchor = element.querySelector('h2 a');
    return {
      title: textOf(anchor),
      url: decodeBingUrl(anchor?.getAttribute('href')),
      snippet: textOf(element.querySelector('.b_caption p') || element.querySelector('.b_lineclamp')),
    };
  });
}

function parseGoogle(doc) {
  return [...doc.querySelectorAll('div.g, div.MjjYud')]
    .map((element) => {
      const heading = element.querySelector('h3');
      const anchor = heading?.closest('a');
      return {
        title: textOf(heading),
        url: anchor?.getAttribute('href') ?? null,
        snippet: textOf(element.querySelector('.VwiC3b, div[style*="line-clamp"]')),
      };
    })
    .filter((result) => result.url && result.url.startsWith('http'));
}

async function fetchViaReader(targetUrl) {
  const response = await fetch(`${READER}${targetUrl}`, {
    headers: { 'x-respond-with': 'html', Accept: 'text/html' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function searchEngine(engine, query) {
  try {
    const html = await fetchViaReader(engine.buildUrl(query));
    return engine.parse(new DOMParser().parseFromString(html, 'text/html'));
  } catch {
    return [];
  }
}

async function searchWikipedia(query) {
  const api = 'https://pt.wikipedia.org/w/api.php';
  try {
    const searchUrl = `${api}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=2&format=json&origin=*`;
    const searchData = await (await fetch(searchUrl)).json();
    const titles = (searchData?.query?.search ?? []).map((hit) => hit.title);
    const results = [];
    for (const title of titles) {
      const url = `${api}?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
      const data = await (await fetch(url)).json();
      const page = Object.values(data?.query?.pages ?? {})[0];
      if (page?.extract) {
        results.push({
          title: page.title,
          url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
          snippet: page.extract,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

function isRelevant(result, queryTokens) {
  if (queryTokens.length === 0) return true;
  const haystack = normalize(`${result.title} ${result.snippet}`);
  return queryTokens.some((token) => haystack.includes(token));
}

const cache = new Map();

export const webSearchSkill = defineSkill({
  name: 'buscar_na_internet',
  description:
    'Busca informações públicas na internet (DuckDuckGo, Bing, Google e Wikipédia) sobre um candidato ou tema. Use quando os dados locais não bastarem. Retorna poucos trechos com URLs; cite-as na resposta.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Termo de busca, ex.: "Nome do candidato cargo".' },
    },
    required: ['query'],
  },
  async run({ query }) {
    const term = String(query ?? '').trim();
    if (!term) return { text: 'Consulta vazia.', sources: [] };
    if (cache.has(term)) return cache.get(term);

    const queryTokens = tokens(term);
    const lists = await Promise.all(ENGINES.map((engine) => searchEngine(engine, term)));
    const found = lists.flat();
    if (found.length < 3) found.push(...(await searchWikipedia(term)));

    const seen = new Set();
    const picked = [];
    for (const result of found) {
      const url = (result.url ?? '').split('#')[0];
      const titleKey = normalize(result.title);
      if (!/^https?:\/\//.test(url) || seen.has(url) || !titleKey || seen.has(titleKey)) continue;
      if (!isRelevant(result, queryTokens)) continue;
      seen.add(url);
      seen.add(titleKey);
      picked.push({ title: result.title.slice(0, 120), url, snippet: (result.snippet ?? '').slice(0, SNIPPET_MAX) });
      if (picked.length >= MAX_RESULTS) break;
    }

    const output =
      picked.length === 0
        ? { text: 'Nenhum resultado relevante encontrado na internet.', sources: [] }
        : {
            text: picked.map((item) => `${item.title}\n${item.url}\n${item.snippet}`).join('\n\n').slice(0, TEXT_MAX),
            sources: picked.map((item) => ({ title: item.title, url: item.url })),
          };

    cache.set(term, output);
    return output;
  },
});
