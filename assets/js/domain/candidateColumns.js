/**
 * Candidate column catalogue.
 *
 * Each column is a plain data object, so adding/removing a column is a change
 * in one place and does not require touching the table renderer (Open/Closed).
 */
import { escapeHtml, formatEducation, formatBoolean, formatMissing, isMissing } from '../core/format.js';

export const DEFAULT_VISIBLE_COLUMN_KEYS = Object.freeze([
  'nome_urna',
  'numero',
  'partido',
  'eh_reeleicao',
  'formacao_academica',
  'propostas_governo',
  'noticias',
]);

function displayName(candidate) {
  return candidate.nome_urna || candidate.nome_completo || '';
}

function missingCell() {
  return '<span class="cell-muted">—</span>';
}

function booleanBadge(value) {
  if (value === true) return '<span class="badge badge--yes">Sim</span>';
  if (value === false) return '<span class="badge badge--no">Não</span>';
  return missingCell();
}

function countBadge(count, singularLabel, pluralLabel) {
  if (!count) return missingCell();
  const label = count === 1 ? singularLabel : pluralLabel;
  return `<span class="badge badge--count">${count} ${escapeHtml(label)}</span>`;
}

export const CANDIDATE_COLUMNS = Object.freeze([
  {
    key: 'foto',
    label: 'Foto',
    isFixed: true,
    getSortValue: () => 1,
    getPlainText: displayName,
    renderCell: () => '',
  },
  {
    key: 'nome_urna',
    label: 'Nome',
    getSortValue: displayName,
    getPlainText: displayName,
    renderCell: (candidate) => `<span class="cell-name">${escapeHtml(displayName(candidate) || '—')}</span>`,
  },
  {
    key: 'numero',
    label: 'Número',
    isNumeric: true,
    getSortValue: (candidate) => candidate.numero,
    getPlainText: (candidate) => formatMissing(candidate.numero),
    renderCell: (candidate) => (isMissing(candidate.numero) ? missingCell() : escapeHtml(String(candidate.numero))),
  },
  {
    key: 'partido',
    label: 'Partido',
    getSortValue: (candidate) => candidate.partido || '',
    getPlainText: (candidate) => candidate.partido || '—',
    renderCell: (candidate) => (candidate.partido ? `<span class="party">${escapeHtml(candidate.partido)}</span>` : missingCell()),
  },
  {
    key: 'coligacao',
    label: 'Coligação',
    getSortValue: (candidate) => candidate.coligacao || '',
    getPlainText: (candidate) => candidate.coligacao || '—',
    renderCell: (candidate) => escapeHtml(candidate.coligacao || '—'),
  },
  {
    key: 'eh_reeleicao',
    label: 'Reeleição',
    getSortValue: (candidate) => candidate.eh_reeleicao,
    getPlainText: (candidate) => formatBoolean(candidate.eh_reeleicao),
    renderCell: (candidate) => booleanBadge(candidate.eh_reeleicao),
  },
  {
    key: 'grau_instrucao',
    label: 'Escolaridade',
    getSortValue: (candidate) => candidate.grau_instrucao || '',
    getPlainText: (candidate) => candidate.grau_instrucao || '—',
    renderCell: (candidate) => escapeHtml(candidate.grau_instrucao || '—'),
  },
  {
    key: 'ocupacao',
    label: 'Ocupação',
    getSortValue: (candidate) => candidate.ocupacao || '',
    getPlainText: (candidate) => candidate.ocupacao || '—',
    renderCell: (candidate) => escapeHtml(candidate.ocupacao || '—'),
  },
  {
    key: 'formacao_academica',
    label: 'Formação',
    getSortValue: (candidate) => formatEducation(candidate.formacao_academica),
    getPlainText: (candidate) => formatEducation(candidate.formacao_academica) || '—',
    renderCell: (candidate) => escapeHtml(formatEducation(candidate.formacao_academica) || '—'),
  },
  {
    key: 'dias_trabalhados_ultimos_2_anos',
    label: 'Dias trabalhados (2 anos)',
    isNumeric: true,
    getSortValue: (candidate) => candidate.dias_trabalhados_ultimos_2_anos,
    getPlainText: (candidate) => formatMissing(candidate.dias_trabalhados_ultimos_2_anos),
    renderCell: (candidate) =>
      isMissing(candidate.dias_trabalhados_ultimos_2_anos)
        ? missingCell()
        : escapeHtml(String(candidate.dias_trabalhados_ultimos_2_anos)),
  },
  {
    key: 'noticias',
    label: 'Notícias',
    isNumeric: true,
    getSortValue: (candidate) => (candidate.noticias || []).length,
    getPlainText: (candidate) => String((candidate.noticias || []).length),
    renderCell: (candidate) => countBadge((candidate.noticias || []).length, 'notícia', 'notícias'),
  },
  {
    key: 'propostas_governo',
    label: 'Propostas',
    isNumeric: true,
    getSortValue: (candidate) => (candidate.propostas_governo || []).length,
    getPlainText: (candidate) => String((candidate.propostas_governo || []).length),
    renderCell: (candidate) => countBadge((candidate.propostas_governo || []).length, 'área', 'áreas'),
  },
  {
    key: 'projetos_aprovados',
    label: 'Projetos aprovados',
    isNumeric: true,
    getSortValue: (candidate) => (candidate.projetos_aprovados || []).length,
    getPlainText: (candidate) => String((candidate.projetos_aprovados || []).length),
    renderCell: (candidate) => countBadge((candidate.projetos_aprovados || []).length, 'projeto', 'projetos'),
  },
]);

export function getColumnByKey(key) {
  return CANDIDATE_COLUMNS.find((column) => column.key === key) ?? null;
}

/** Columns that have at least one filled value for the given candidates. */
export function selectAvailableColumns(candidates) {
  return CANDIDATE_COLUMNS.filter(
    (column) => column.isFixed || candidates.some((candidate) => !isMissing(column.getSortValue(candidate))),
  );
}

/** Columns that should currently be shown, honouring fixed columns. */
export function selectVisibleColumns(columns, visibleKeys) {
  return columns.filter((column) => column.isFixed || visibleKeys.has(column.key));
}
