/**
 * Candidate detail drawer.
 */
import { createElement, replaceContent } from '../core/dom.js';
import { isMissing, formatBoolean, formatEducation } from '../core/format.js';

function sectionWithHeading(label, content) {
  const section = createElement('div');
  section.append(createElement('h3', {}, label), content);
  return section;
}

function emptyMessage() {
  return createElement('p', { class: 'detail__empty' }, 'Não encontrado.');
}

function linkedListSection(label, items, buildLine) {
  if (!items || items.length === 0) return sectionWithHeading(label, emptyMessage());
  return sectionWithHeading(label, createElement('ul', {}, items.map(buildLine)));
}

function plainListSection(label, texts) {
  if (!texts || texts.length === 0) return sectionWithHeading(label, emptyMessage());
  return sectionWithHeading(label, createElement('ul', {}, texts.map((text) => createElement('li', {}, text))));
}

function externalLink(url, text) {
  return createElement('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, text);
}

function buildNewsLine(item) {
  const line = createElement('li');
  line.append(item.url ? externalLink(item.url, item.titulo || item.url) : item.titulo || '');
  if (item.veiculo || item.data) {
    const separator = item.veiculo && item.data ? ', ' : '';
    line.append(createElement('span', { class: 'detail__party' }, ` — ${item.veiculo || ''}${separator}${item.data || ''}`));
  }
  return line;
}

function buildProjectLine(item) {
  const line = createElement('li');
  line.append(item.url ? externalLink(item.url, item.titulo || item.url) : item.titulo || '');
  if (item.descricao) line.append(` — ${item.descricao}`);
  return line;
}

function infoRow(label, value) {
  if (isMissing(value)) return null;
  return sectionWithHeading(label, createElement('p', {}, String(value)));
}

function proposalsSection(propostas) {
  const section = createElement('div');
  section.append(createElement('h3', {}, 'Propostas de governo'));
  if (!propostas || propostas.length === 0) {
    section.append(emptyMessage());
    return section;
  }
  for (const proposta of propostas) {
    section.append(createElement('h4', { class: 'detail__area' }, proposta.area));
    if (proposta.resumo) section.append(createElement('p', { class: 'detail__summary' }, proposta.resumo));
    if (proposta.texto) section.append(createElement('p', {}, proposta.texto));
  }
  return section;
}

function newsByYearSection(noticias) {
  const section = createElement('div');
  section.append(createElement('h3', {}, 'Principais notícias'));
  if (!noticias || noticias.length === 0) {
    section.append(emptyMessage());
    return section;
  }
  const byYear = new Map();
  for (const noticia of noticias) {
    const year = String(noticia.data || '').slice(0, 4) || '—';
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(noticia);
  }
  const years = [...byYear.keys()].sort((first, second) => second.localeCompare(first));
  for (const year of years) {
    section.append(createElement('h4', { class: 'detail__year' }, year));
    section.append(createElement('ul', {}, byYear.get(year).map(buildNewsLine)));
  }
  return section;
}

function buildHeader(candidate) {
  const name = candidate.nome_urna || candidate.nome_completo;
  const header = createElement('div', { class: 'detail__head' });
  if (candidate.foto) header.append(createElement('img', { class: 'detail__photo', src: candidate.foto, alt: `Foto de ${name}` }));
  header.append(
    createElement('div', {}, [
      createElement('div', { class: 'detail__name' }, name),
      createElement('div', { class: 'detail__party' }, candidate.partido || ''),
    ]),
  );
  return header;
}

export function renderCandidateDetail(drawerElement, candidate, onClose) {
  const closeButton = createElement('button', { class: 'close', type: 'button', 'aria-label': 'Fechar' }, '×');
  closeButton.addEventListener('click', onClose);

  replaceContent(drawerElement, [
    closeButton,
    buildHeader(candidate),
    infoRow('Nome completo', candidate.nome_completo),
    infoRow('Número', isMissing(candidate.numero) ? null : candidate.numero),
    infoRow('Coligação', candidate.coligacao),
    infoRow('Reeleição', formatBoolean(candidate.eh_reeleicao)),
    infoRow('Escolaridade (TSE)', candidate.grau_instrucao),
    infoRow('Ocupação (TSE)', candidate.ocupacao),
    infoRow('Dias trabalhados (últimos 2 anos)', candidate.dias_trabalhados_ultimos_2_anos),
    plainListSection(
      'Formação acadêmica',
      (candidate.formacao_academica || []).map((entry) => formatEducation([entry])),
    ),
    proposalsSection(candidate.propostas_governo),
    newsByYearSection(candidate.noticias),
    linkedListSection('Projetos aprovados', candidate.projetos_aprovados, buildProjectLine),
    linkedListSection('Fontes', candidate.fontes, (url) => createElement('li', {}, externalLink(url, url))),
    infoRow('Atualizado em', candidate.atualizado_em),
  ]);

  drawerElement.hidden = false;
}
