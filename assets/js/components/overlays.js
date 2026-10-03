/**
 * Loading / error overlays.
 */
import { createElement } from '../core/dom.js';

export function hideLoadingOverlay(element) {
  element.hidden = true;
}

export function showErrorOverlay(message) {
  const overlay = createElement('div', { class: 'error' }, [
    createElement('h2', {}, 'Não foi possível carregar os dados'),
    createElement('p', {}, message),
    createElement(
      'p',
      {},
      'Verifique se o site está sendo servido por um servidor web (ex.: ./serve.sh) e não aberto via file://.',
    ),
  ]);
  document.body.append(overlay);
}
