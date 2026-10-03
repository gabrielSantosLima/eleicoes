/**
 * Sources footer.
 */
import { createElement, replaceContent } from '../core/dom.js';

export function renderSourcesFooter(footerElement, { sources, updatedAt }) {
  const grid = createElement('div', { class: 'footer__grid' });
  for (const source of sources ?? []) {
    grid.append(createElement('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.nome));
  }
  grid.append(createElement('span', {}, `Atualizado em ${updatedAt || '—'}`));
  replaceContent(footerElement, grid);
}
