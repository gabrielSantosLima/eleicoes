/**
 * Cargo selector (<select>).
 */
import { createElement, replaceContent } from '../core/dom.js';

export function renderCargoSelector(selectElement, entries, selectedCargoName) {
  const options = entries.map((entry) => createElement('option', { value: entry.cargo }, entry.cargo));
  replaceContent(selectElement, options);
  selectElement.value = selectedCargoName;
}
