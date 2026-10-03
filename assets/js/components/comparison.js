/**
 * Side-by-side comparison: floating bar + modal table.
 */
import { createElement, replaceContent } from '../core/dom.js';

export function renderCompareBar(barElement, countElement, selectedCount, maxSelection) {
  if (selectedCount === 0) {
    barElement.hidden = true;
    return;
  }
  barElement.hidden = false;
  countElement.textContent = `${selectedCount} de ${maxSelection} selecionado${selectedCount === 1 ? '' : 's'}`;
}

function buildHeaderRow(candidates) {
  const headerRow = createElement('tr', {}, [createElement('th', { class: 'attr' }, 'Atributo')]);
  for (const candidate of candidates) {
    const cell = createElement('th');
    if (candidate.foto) {
      cell.append(createElement('img', { class: 'compare-photo', src: candidate.foto, alt: `Foto de ${candidate.nome_urna || ''}` }));
    }
    cell.append(
      createElement('div', { class: 'cell-name' }, candidate.nome_urna || candidate.nome_completo),
      createElement('div', { class: 'detail__party' }, candidate.partido || ''),
    );
    headerRow.append(cell);
  }
  return headerRow;
}

function buildAttributeRow(column, candidates) {
  const values = candidates.map((candidate) => column.getPlainText(candidate));
  const differs = new Set(values).size > 1;
  const row = createElement('tr', {}, [createElement('th', { class: 'attr' }, column.label)]);
  values.forEach((value) => row.append(createElement('td', { class: differs ? 'diff' : null }, value)));
  return row;
}

export function renderComparisonModal(modalElement, { candidates, columns, cargoLabel }, onClose) {
  const attributeColumns = columns.filter((column) => column.key !== 'foto');

  const table = createElement('table', {}, [
    createElement('thead', {}, buildHeaderRow(candidates)),
    createElement('tbody', {}, attributeColumns.map((column) => buildAttributeRow(column, candidates))),
  ]);

  const closeButton = createElement('button', { class: 'close', type: 'button', 'aria-label': 'Fechar comparação' }, '×');
  closeButton.addEventListener('click', onClose);

  replaceContent(modalElement, [
    closeButton,
    createElement('div', { class: 'compare' }, [
      createElement('h2', {}, `Comparação de candidatos — ${cargoLabel}`),
      table,
    ]),
  ]);
  modalElement.hidden = false;
}
