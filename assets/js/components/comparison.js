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

function buildProposalsTable(candidates) {
  const areas = [];
  const seen = new Set();
  for (const candidate of candidates) {
    for (const proposta of candidate.propostas_governo || []) {
      if (!seen.has(proposta.area)) {
        seen.add(proposta.area);
        areas.push(proposta.area);
      }
    }
  }
  if (areas.length === 0) return null;

  const headerRow = createElement('tr', {}, [
    createElement('th', { class: 'attr' }, 'Propostas por área'),
    ...candidates.map((candidate) => createElement('th', {}, candidate.nome_urna || candidate.nome_completo)),
  ]);
  const rows = areas.map((area) => {
    const row = createElement('tr', {}, [createElement('th', { class: 'attr' }, area)]);
    for (const candidate of candidates) {
      const proposta = (candidate.propostas_governo || []).find((item) => item.area === area);
      row.append(createElement('td', {}, proposta?.resumo || '—'));
    }
    return row;
  });

  return createElement('table', { class: 'compare__proposals' }, [
    createElement('thead', {}, headerRow),
    createElement('tbody', {}, rows),
  ]);
}

export function renderComparisonModal(modalElement, { candidates, columns, cargoLabel }, onClose) {
  const attributeColumns = columns.filter((column) => column.key !== 'foto');

  const attributesTable = createElement('table', {}, [
    createElement('thead', {}, buildHeaderRow(candidates)),
    createElement('tbody', {}, attributeColumns.map((column) => buildAttributeRow(column, candidates))),
  ]);

  const closeButton = createElement('button', { class: 'close', type: 'button', 'aria-label': 'Fechar comparação' }, '×');
  closeButton.addEventListener('click', onClose);

  const content = [
    createElement('h2', {}, `Comparação de candidatos — ${cargoLabel}`),
    attributesTable,
  ];

  const proposalsTable = buildProposalsTable(candidates);
  if (proposalsTable) {
    content.push(createElement('h3', { class: 'compare__heading' }, 'Propostas de governo (resumo por área)'));
    content.push(proposalsTable);
  }

  replaceContent(modalElement, [closeButton, createElement('div', { class: 'compare' }, content)]);
  modalElement.hidden = false;
}
