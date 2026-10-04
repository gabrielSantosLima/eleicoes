/**
 * Custom chat view: message log + composer, with `@candidate` mentions.
 * `onSend` is provided by the panel and returns { text, meta }.
 */
import { createElement, replaceContent } from '../../core/dom.js';
import { renderMarkdown } from './markdown.js';

const MENTION_RE = /@([\p{L}\p{N} ]{0,40})$/u;

function normalize(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function createChatView({ host, onSend, placeholder = 'Escreva sua pergunta…' }) {
  const messages = [];
  let candidates = [];
  let busy = false;

  const log = createElement('div', { class: 'chat__log', role: 'log', 'aria-live': 'polite' });

  const input = createElement('textarea', {
    class: 'chat__input',
    rows: '1',
    placeholder,
    'aria-label': 'Mensagem',
  });
  const sendButton = createElement('button', { class: 'chat__send', type: 'submit', 'aria-label': 'Enviar' }, [
    createElement('span', { class: 'material-symbols-outlined', 'aria-hidden': 'true' }, 'send'),
  ]);
  const form = createElement('form', { class: 'chat__form' }, [input, sendButton]);
  const mentions = createElement('div', { class: 'chat__mentions', hidden: true, role: 'listbox' });
  const statusIcon = createElement(
    'span',
    { class: 'material-symbols-outlined chat__status-icon', 'aria-hidden': 'true' },
    'progress_activity',
  );
  const statusText = createElement('span', { class: 'chat__status-text' });
  const statusEl = createElement('div', { class: 'chat__status', hidden: true, role: 'status' }, [statusIcon, statusText]);
  const composer = createElement('div', { class: 'chat__composer' }, [statusEl, mentions, form]);

  replaceContent(host, [log, composer]);

  const mentionState = { items: [], active: 0 };

  /* ------------------------------- messages ------------------------------ */

  function scrollToBottom() {
    log.scrollTop = log.scrollHeight;
  }

  function htmlFragment(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    return template.content;
  }

  function bubbleFor(message) {
    const bubble = createElement('div', { class: `chat__bubble chat__bubble--${message.role}` });
    if (message.role === 'error') {
      bubble.append(createElement('span', { class: 'material-symbols-outlined' }, 'error'));
      bubble.append(createElement('span', {}, message.text));
      return bubble;
    }
    if (message.role === 'assistant') {
      bubble.append(createElement('div', { class: 'chat__content' }, htmlFragment(renderMarkdown(message.text))));
      if (message.meta) bubble.append(createElement('div', { class: 'chat__meta' }, message.meta));
    } else {
      bubble.append(createElement('div', { class: 'chat__content' }, message.text));
    }
    return bubble;
  }

  function addMessage(role, text, meta = null) {
    const message = { role, text, meta };
    messages.push(message);
    log.append(bubbleFor(message));
    scrollToBottom();
    return message;
  }

  function hideStatus() {
    statusEl.hidden = true;
    statusText.textContent = '';
  }

  function setStatus(text) {
    if (!text) {
      hideStatus();
      return;
    }
    statusText.textContent = text;
    statusEl.hidden = false;
  }

  function setBusy(value) {
    busy = value;
    input.disabled = value;
    sendButton.disabled = value;
    form.classList.toggle('is-busy', value);
    if (value) setStatus('Pensando…');
    else hideStatus();
  }

  /* ------------------------------- mentions ------------------------------ */

  function hideMentions() {
    mentions.hidden = true;
    mentionState.items = [];
    mentionState.active = 0;
  }

  function renderMentions(items) {
    mentionState.items = items;
    mentionState.active = 0;
    replaceContent(
      mentions,
      items.map((candidate, index) =>
        createElement(
          'button',
          { class: `chat__mention${index === 0 ? ' is-active' : ''}`, type: 'button', role: 'option' },
          [
            createElement('span', {}, candidate.nome),
            createElement('small', {}, `${candidate.cargo}${candidate.partido ? ` · ${candidate.partido}` : ''}`),
          ],
        ),
      ),
    );
    items.forEach((candidate, index) => {
      mentions.children[index].addEventListener('mousedown', (event) => {
        event.preventDefault();
        selectMention(candidate);
      });
    });
    mentions.hidden = false;
  }

  function updateMentions() {
    if (busy || candidates.length === 0) {
      hideMentions();
      return;
    }
    const caret = input.selectionStart ?? input.value.length;
    const match = input.value.slice(0, caret).match(MENTION_RE);
    if (!match) {
      hideMentions();
      return;
    }
    const query = normalize(match[1].trim());
    const items = candidates
      .filter((candidate) => !query || normalize(candidate.nome).includes(query))
      .slice(0, 6);
    if (items.length === 0) {
      hideMentions();
      return;
    }
    renderMentions(items);
  }

  function selectMention(candidate) {
    const caret = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, caret).replace(MENTION_RE, `@${candidate.nome} `);
    const after = input.value.slice(caret);
    input.value = before + after;
    const position = before.length;
    input.setSelectionRange(position, position);
    hideMentions();
    input.focus();
    autoGrow();
  }

  function moveMention(delta) {
    const total = mentionState.items.length;
    if (total === 0) return;
    mentionState.active = (mentionState.active + delta + total) % total;
    [...mentions.children].forEach((child, index) => child.classList.toggle('is-active', index === mentionState.active));
  }

  /* -------------------------------- compose ------------------------------ */

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  }

  async function runSend(rawText) {
    const text = String(rawText ?? '').trim();
    if (!text || busy) return;
    hideMentions();
    addMessage('user', text);
    setBusy(true);
    try {
      const { text: answer, meta } = await onSend({ history: messages.slice() });
      if (answer) addMessage('assistant', answer, meta);
    } catch (error) {
      addMessage('error', error?.message ?? 'Falha na requisição.');
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  function submit() {
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    autoGrow();
    runSend(text);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });
  input.addEventListener('input', () => {
    autoGrow();
    updateMentions();
  });
  input.addEventListener('click', updateMentions);
  input.addEventListener('blur', () => setTimeout(hideMentions, 120));
  input.addEventListener('keydown', (event) => {
    if (!mentions.hidden) {
      if (event.key === 'ArrowDown') return event.preventDefault(), moveMention(1);
      if (event.key === 'ArrowUp') return event.preventDefault(), moveMention(-1);
      if (event.key === 'Enter') return event.preventDefault(), selectMention(mentionState.items[mentionState.active]);
      if (event.key === 'Escape') return event.preventDefault(), hideMentions();
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });

  return {
    addMessage,
    send: runSend,
    setStatus,
    setCandidates(list) {
      candidates = Array.isArray(list) ? list : [];
    },
    getHistory: () => messages.slice(),
    clear() {
      messages.length = 0;
      replaceContent(log, []);
    },
    focus: () => input.focus(),
  };
}
