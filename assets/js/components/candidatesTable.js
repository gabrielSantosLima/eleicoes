/**
 * Candidates table renderer.
 *
 * Receives data and callbacks from the composition root and knows nothing about
 * the store or the data source.
 */
import { createElement, createFragmentFromHtml, replaceContent } from '../core/dom.js';
import { selectVisibleColumns } from '../domain/candidateColumns.js';
import { sortCandidates } from '../domain/candidates.js';

function buildPhotoCell(candidate, isCompared, handlers) {
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

  const media = candidate.foto
    ? createElement('img', {
        class: 'thumb',
        src: candidate.foto,
        alt: `Foto de ${candidate.nome_urna || candidate.nome_completo}`,
        loading: 'lazy',
      })
    : createElement('span', { class: 'thumb cell-muted', style: 'display:grid;place-items:center' }, '—');

  label.append(checkbox, media);
  return createElement('td', { class: 'cell-photo' }, label);
}

function buildHeaderCell(column, sort, onSortColumn) {
  const attributes = { scope: 'col' };
  if (column.isNumeric) attributes.class = 'num';
  if (column.isFixed) attributes.class = attributes.class ? `${attributes.class} no-sort` : 'no-sort';
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
  const cells = columns.map((column) =>
    column.isFixed ? buildPhotoCell(candidate, isCompared, handlers) : buildDataCell(column, candidate),
  );

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

  const headerRow = createElement(
    'tr',
    {},
    visibleColumns.map((column) => buildHeaderCell(column, sort, handlers.onSortColumn)),
  );
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
