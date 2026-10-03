/**
 * Column cloud: one toggle chip per column.
 */
import { createElement, replaceContent } from '../core/dom.js';

export function renderColumnCloud(container, columns, visibleKeys, onToggleColumn) {
  const chips = columns.map((column) => {
    if (column.isFixed) {
      return createElement(
        'button',
        { class: 'chip chip--fixed', type: 'button', 'aria-pressed': 'true', disabled: 'disabled' },
        column.label,
      );
    }

    const isVisible = visibleKeys.has(column.key);
    const chip = createElement(
      'button',
      { class: 'chip', type: 'button', 'aria-pressed': isVisible ? 'true' : 'false' },
      column.label,
    );
    chip.addEventListener('click', () => onToggleColumn(column.key));
    return chip;
  });

  replaceContent(container, chips);
}
