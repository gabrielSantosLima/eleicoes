/**
 * Candidates table renderer.
 *
 * Receives data and callbacks from the composition root and knows nothing about
 * the store or the data source.
 */
import { createElement, createFragmentFromHtml, replaceContent } from '../core/dom.js';
import { isMissing } from '../core/format.js';
import { selectVisibleColumns } from '../domain/candidateColumns.js';
import { sortCandidates } from '../domain/candidates.js';

function buildSelectionControl(candidate, isCompared, handlers) {
  const label = createElement('label', { class: 'pick', title: 'Selecionar para comparar' });
  const checkbox = createElement('input', {
    type: 'checkbox',
    'aria-label': `Selecionar ${candidate.nome_urna || candidate.nome_completo} para comparar`,
  });
  checkbox.checked = isCompared;
  checkbox.addEventListener('click', (event) => event.stopPropagation());
  checkbox.addEventListener('change', () => {
    if (!handlers.onToggleCompare(candidate.id, checkbox.checked)) checkbox.checked = false;
  });
  label.append(checkbox);
  return label;
}

function buildPhotoMedia(candidate, className = 'thumb') {
  return candidate.foto
    ? createElement('img', {
        class: className,
        src: candidate.foto,
        alt: `Foto de ${candidate.nome_urna || candidate.nome_completo}`,
        loading: 'lazy',
      })
    : createElement('span', { class: `${className} cell-muted`, style: 'display:grid;place-items:center' }, '—');
}

function buildSelectionCell(candidate, isCompared, handlers) {
  return createElement('td', { class: 'cell-select' }, buildSelectionControl(candidate, isCompared, handlers));
}

function buildPhotoCell(candidate) {
  return createElement('td', { class: 'cell-photo' }, buildPhotoMedia(candidate));
}

function buildHeaderCell(column, sort, onSortColumn) {
  const attributes = { scope: 'col' };
  if (column.isNumeric) attributes.class = 'num';
  if (column.isFixed) attributes.class = attributes.class ? `${attributes.class} no-sort cell-photo-head` : 'no-sort cell-photo-head';
  if (sort.key === column.key) {
    attributes['aria-sort'] = sort.direction === 1 ? 'ascending' : 'descending';
  }

  const headerCell = createElement('th', attributes, column.label);
  if (!column.isFixed) headerCell.addEventListener('click', () => onSortColumn(column.key));
  return headerCell;
}

function buildDataCell(column, candidate) {
  const attributes = { 'data-column': column.key };
  if (column.isNumeric) attributes.class = 'num';
  return createElement('td', attributes, createFragmentFromHtml(column.renderCell(candidate)));
}

function buildCandidateRow(candidate, columns, isCompared, handlers) {
  const cells = [
    buildSelectionCell(candidate, isCompared, handlers),
    ...columns.map((column) =>
      column.isFixed ? buildPhotoCell(candidate) : buildDataCell(column, candidate),
    ),
  ];

  const row = createElement(
    'tr',
    { tabindex: '0', 'aria-label': `Ver detalhes de ${candidate.nome_urna || candidate.nome_completo}` },
    cells,
  );
  row.addEventListener('click', () => handlers.onOpenCandidate(candidate));
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlers.onOpenCandidate(candidate);
    }
  });
  return row;
}

export function renderCandidatesTable({ tableElement, columns, visibleKeys, candidates, sort, comparedIds, handlers }) {
  const visibleColumns = selectVisibleColumns(columns, visibleKeys);
  const sortColumn = columns.find((column) => column.key === sort.key);
  const orderedCandidates = sortCandidates(candidates, sortColumn, sort.direction);

  const headerRow = createElement('tr', {}, [
    createElement(
      'th',
      { class: 'cell-select no-sort', scope: 'col' },
      createElement('span', { class: 'sr-only' }, 'Selecionar'),
    ),
    ...visibleColumns.map((column) => buildHeaderCell(column, sort, handlers.onSortColumn)),
  ]);
  const bodyRows = orderedCandidates.map((candidate) =>
    buildCandidateRow(candidate, visibleColumns, comparedIds.has(candidate.id), handlers),
  );

  const caption = tableElement.querySelector('caption');
  replaceContent(tableElement, [
    caption,
    createElement('thead', {}, headerRow),
    createElement('tbody', {}, bodyRows),
  ]);
}

const CARD_HEADER_KEYS = new Set(['foto', 'nome_urna', 'numero', 'partido']);

function buildCandidateCard(candidate, columns, isCompared, handlers) {
  const identifier =
    `${candidate.partido || ''}${isMissing(candidate.numero) ? '' : ` · nº ${candidate.numero}`}`.trim();

  const head = createElement('header', { class: 'candidate-card__head' }, [
    buildSelectionControl(candidate, isCompared, handlers),
    buildPhotoMedia(candidate, 'candidate-card__photo'),
    createElement('div', { class: 'candidate-card__id' }, [
      createElement('div', { class: 'cell-name' }, candidate.nome_urna || candidate.nome_completo || '—'),
      createElement('div', { class: 'detail__party' }, identifier || '—'),
    ]),
  ]);

  const fields = columns
    .filter((column) => !CARD_HEADER_KEYS.has(column.key))
    .map((column) =>
      createElement('div', { class: 'candidate-card__field' }, [
        createElement('dt', {}, column.label),
        createElement('dd', {}, createFragmentFromHtml(column.renderCell(candidate))),
      ]),
    );

  const card = createElement(
    'article',
    {
      class: 'candidate-card',
      tabindex: '0',
      'aria-label': `Ver detalhes de ${candidate.nome_urna || candidate.nome_completo}`,
    },
    [head, createElement('dl', { class: 'candidate-card__fields' }, fields)],
  );
  card.addEventListener('click', () => handlers.onOpenCandidate(candidate));
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlers.onOpenCandidate(candidate);
    }
  });
  return card;
}

export function renderCandidatesCards({ container, columns, visibleKeys, candidates, sort, comparedIds, handlers }) {
  const visibleColumns = selectVisibleColumns(columns, visibleKeys);
  const sortColumn = columns.find((column) => column.key === sort.key);
  const orderedCandidates = sortCandidates(candidates, sortColumn, sort.direction);

  replaceContent(
    container,
    orderedCandidates.map((candidate) =>
      buildCandidateCard(candidate, visibleColumns, comparedIds.has(candidate.id), handlers),
    ),
  );
}
