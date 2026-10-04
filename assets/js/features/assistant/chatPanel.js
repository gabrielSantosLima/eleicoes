/**
 * Floating AI assistant: a FAB that opens a chat panel with a custom chat view.
 * The conversation is grounded on the single context file and calls the chosen
 * provider directly from the browser (BYO key).
 */
import { createElement, replaceContent, select } from '../../core/dom.js';
import { PROVIDERS, DEFAULT_PROVIDER, getProvider } from './providerCatalog.js';
import {
  loadContext,
  buildSystemContent,
  requestChatCompletion,
  listModels,
  formatMetadata,
} from './assistantClient.js';
import { createChatView } from './chatView.js';

const KEYS = {
  provider: 'eleicoes:ai:provider',
  model: (id) => `eleicoes:ai:model:${id}`,
  key: (id) => `eleicoes:ai:key:${id}`,
  configOpen: 'eleicoes:ai:configOpen',
};

const CONTEXT_BUDGET = 128000;
const tokenFormatter = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

function readStorage(key, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function createAssistant() {
  const fab = select('#ai-fab');
  const panel = select('#ai-panel');
  const configEl = select('#ai-config');
  const configToggle = select('#ai-config-toggle');
  const providerSelect = select('#ai-provider');
  const modelSelect = select('#ai-model');
  const keyInput = select('#ai-key');
  const helpButton = select('#ai-help');
  const statusElement = select('#ai-status');
  const closeButton = select('#ai-close');
  const clearButton = select('#ai-clear');
  const tokenFill = select('#ai-tokens-fill');
  const tokenLabel = select('#ai-tokens-label');
  const chatHost = select('#ai-chat');

  let systemContent = null;
  let sessionTokens = 0;
  let autoSummaryDone = false;

  const chatView = createChatView({ host: chatHost, onSend: handleSend });

  replaceContent(
    providerSelect,
    PROVIDERS.map((provider) => createElement('option', { value: provider.id }, provider.label)),
  );

  function currentProvider() {
    return getProvider(providerSelect.value);
  }

  function updateStatus(message) {
    if (message) {
      statusElement.textContent = message;
      return;
    }
    const provider = currentProvider();
    if (!keyInput.value.trim()) {
      statusElement.textContent = 'Informe a chave da API (fica só no seu navegador).';
      return;
    }
    statusElement.textContent = `Pronto — ${provider.label} · ${modelSelect.value || provider.model}.`;
  }

  function setModelOptions(models, selected) {
    replaceContent(modelSelect, models.map((id) => createElement('option', { value: id }, id)));
    if (selected && models.includes(selected)) modelSelect.value = selected;
    modelSelect.disabled = models.length === 0;
  }

  async function refreshModels() {
    const provider = currentProvider();
    const apiKey = keyInput.value.trim();
    if (!apiKey) {
      setModelOptions([], null);
      updateStatus();
      return;
    }
    updateStatus('Listando modelos…');
    const models = await listModels({ provider, apiKey });
    setModelOptions(models, readStorage(KEYS.model(provider.id)) || provider.model);
    writeStorage(KEYS.model(provider.id), modelSelect.value);
    updateStatus();
    setConfigOpen(false);
  }

  function applyProvider(providerId) {
    const provider = getProvider(providerId);
    providerSelect.value = provider.id;
    keyInput.value = readStorage(KEYS.key(provider.id));
    setModelOptions([], null);
    updateStatus();
    if (keyInput.value.trim()) refreshModels();
  }

  function updateTokenIndicator(usage) {
    if (!usage) return;
    const promptTokens = usage.prompt_tokens ?? 0;
    const completionTokens = usage.completion_tokens ?? 0;
    sessionTokens += usage.total_tokens ?? promptTokens + completionTokens;

    const percent = Math.min(100, Math.round((promptTokens / CONTEXT_BUDGET) * 100));
    tokenFill.style.width = `${percent}%`;
    tokenFill.classList.toggle('is-high', percent >= 80);

    let label = `Contexto ${tokenFormatter.format(promptTokens)}/${tokenFormatter.format(CONTEXT_BUDGET)} (${percent}%) · Sessão ${tokenFormatter.format(sessionTokens)} tokens`;
    if (usage.estimated_cost) label += ` · US$ ${usage.estimated_cost.toFixed(4)}`;
    tokenLabel.textContent = label;
  }

  async function handleSend({ history }) {
    const provider = currentProvider();
    const apiKey = keyInput.value.trim();
    const model = modelSelect.value || provider.model;
    if (!apiKey) throw new Error(`Informe a chave da API do ${provider.label}.`);
    if (!model) throw new Error('Selecione um modelo.');

    const result = await requestChatCompletion({ provider, apiKey, model, systemContent, history });
    updateTokenIndicator(result.usage);
    return { text: result.text, meta: formatMetadata(result.elapsedMs, result.usage) };
  }

  function setConfigOpen(open) {
    configEl.hidden = !open;
    configToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    configEl.dataset.open = open ? 'true' : 'false';
    writeStorage(KEYS.configOpen, open ? '1' : '');
  }

  async function ensureReady() {
    if (!systemContent) {
      statusElement.textContent = 'Carregando dados…';
      systemContent = buildSystemContent(await loadContext());
    }
    updateStatus();
  }

  function openPanel() {
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    ensureReady()
      .then(() => {
        chatView.focus();
        if (!autoSummaryDone && keyInput.value.trim() && chatView.getHistory().length === 0) {
          autoSummaryDone = true;
          chatView.send(
            'Faça um breve resumo geral dos dados: quais cargos existem, quantos candidatos há em cada um e as principais propostas, em tópicos.',
          );
        }
      })
      .catch((error) => {
        statusElement.textContent = error?.message ?? 'Falha ao carregar o assistente.';
      });
  }

  function closePanel() {
    panel.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
  }

  fab.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
  closeButton.addEventListener('click', closePanel);
  configToggle.addEventListener('click', () => setConfigOpen(configEl.hidden));
  clearButton.addEventListener('click', () => {
    chatView.clear();
    sessionTokens = 0;
    tokenFill.style.width = '0%';
    tokenFill.classList.remove('is-high');
    tokenLabel.textContent = 'Uso de tokens aparecerá aqui.';
  });

  providerSelect.addEventListener('change', () => {
    writeStorage(KEYS.provider, providerSelect.value);
    applyProvider(providerSelect.value);
  });
  keyInput.addEventListener('change', () => {
    writeStorage(KEYS.key(currentProvider().id), keyInput.value.trim());
    refreshModels();
  });
  modelSelect.addEventListener('change', () => {
    writeStorage(KEYS.model(currentProvider().id), modelSelect.value);
    updateStatus();
  });
  helpButton.addEventListener('click', () => {
    window.open(currentProvider().helpUrl, '_blank', 'noopener');
  });

  applyProvider(readStorage(KEYS.provider) || DEFAULT_PROVIDER);
  // Entra colapsado se já houver uma chave configurada para o provedor atual.
  setConfigOpen(!keyInput.value.trim());
}
