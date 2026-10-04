/**
 * Skill: query the local candidate dataset (names, office, number and proposal
 * summaries). Its data comes from the agent `context`.
 */
import { defineSkill } from './defineSkill.js';

function normalize(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export const dataSkill = defineSkill({
  name: 'consultar_dados',
  description:
    'Consulta a base local de candidatos (nome, cargo, número e resumo das propostas). Use antes de buscar na internet.',
  parameters: {
    type: 'object',
    properties: {
      termo: { type: 'string', description: 'Nome do candidato ou cargo.' },
    },
    required: ['termo'],
  },
  async run({ termo }, context = {}) {
    const report = typeof context.report === 'function' ? context.report : () => {};
    report(`Buscando na base local: "${termo}"`);

    const candidates = Array.isArray(context.data) ? context.data : [];
    const query = normalize(termo);
    if (!query) return { text: 'Consulta vazia.', sources: [] };

    const matches = candidates
      .filter((candidate) => normalize(candidate.nome).includes(query))
      .slice(0, 5);

    report(`${matches.length} candidato${matches.length === 1 ? '' : 's'} encontrado${matches.length === 1 ? '' : 's'}`);

    if (matches.length === 0) {
      return { text: 'Nenhum candidato encontrado na base local.', sources: [] };
    }

    const lines = matches.map((candidate) => {
      const proposals = (candidate.propostas ?? [])
        .map((proposal) => `  - ${proposal.area}: ${proposal.resumo}`)
        .join('\n');
      return `${candidate.nome} — ${candidate.cargo} · nº ${candidate.numero}${proposals ? `\n${proposals}` : ''}`;
    });
    return { text: lines.join('\n\n'), sources: [] };
  },
});
