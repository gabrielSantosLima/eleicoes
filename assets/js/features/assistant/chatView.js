/**
 * Custom chat view: message log + composer.
 * `onSend` is provided by the panel and returns { text, meta }.
 */
import { createElement, replaceContent } from '../../core/dom.js';
import { renderMarkdown } from './markdown.js';

export function createChatView({ host, onSend, placeholder = 'Escreva sua pergunta…' }) {
  const messages = [];
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

  replaceContent(host, [log, form]);

  function scrollToBottom() {
    log.scrollTop = log.scrollHeight;
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

  function htmlFragment(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    return template.content;
  }

  function appendMessage(message) {
    log.append(bubbleFor(message));
    scrollToBottom();
  }

  function addMessage(role, text, meta = null) {
    const message = { role, text, meta };
    messages.push(message);
    appendMessage(message);
    return message;
  }

  let typing = null;
  function setBusy(value) {
    busy = value;
    input.disabled = value;
    sendButton.disabled = value;
    form.classList.toggle('is-busy', value);
    if (value) {
      typing = createElement('div', { class: 'chat__bubble chat__bubble--assistant chat__bubble--typing' }, [
        createElement('span', { class: 'chat__dot' }),
        createElement('span', { class: 'chat__dot' }),
        createElement('span', { class: 'chat__dot' }),
      ]);
      log.append(typing);
      scrollToBottom();
    } else if (typing) {
      typing.remove();
      typing = null;
    }
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  }

  async function runSend(rawText) {
    const text = String(rawText ?? '').trim();
    if (!text || busy) return;
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
  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });

  return {
    addMessage,
    send: runSend,
    getHistory: () => messages.slice(),
    clear() {
      messages.length = 0;
      replaceContent(log, []);
    },
    focus: () => input.focus(),
  };
}
