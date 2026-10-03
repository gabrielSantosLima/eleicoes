/**
 * Low-level DOM helpers shared by every component.
 * Keeps DOM manipulation in one place so components stay declarative.
 */

export function select(selector, root = document) {
  return root.querySelector(selector);
}

export function selectAll(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function applyAttributes(element, attributes) {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) continue;
    if (name === 'class') element.className = value;
    else if (name === 'dataset') Object.assign(element.dataset, value);
    else element.setAttribute(name, value);
  }
}

function appendChildren(element, children) {
  for (const child of flatten(children)) {
    if (child === null || child === undefined) continue;
    element.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
}

/**
 * Create an element from a tag name, an attribute map and children.
 * Children may be nodes, fragments or plain strings.
 */
export function createElement(tagName, attributes = {}, children = []) {
  const element = document.createElement(tagName);
  applyAttributes(element, attributes);
  appendChildren(element, children);
  return element;
}

/** Replace all children of `element`, ignoring nullish entries (flattens arrays). */
export function replaceContent(element, children) {
  element.replaceChildren(...flatten(children).filter(Boolean));
}

function flatten(value) {
  return Array.isArray(value) ? value.flatMap(flatten) : [value];
}

/** Build a document fragment from an HTML string. */
export function createFragmentFromHtml(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup ?? '').trim();
  return template.content;
}
