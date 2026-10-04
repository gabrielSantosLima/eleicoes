/**
 * Floating AI assistant: a FAB that opens a chat panel with a custom chat view.
 * The chat is powered by the generic `agent/` module (provider-agnostic, skills).
 */
import { createElement, replaceContent, select } from '../../core/dom.js';
import { PROVIDERS, DEFAULT_PROVIDER, getProvider } from './providerCatalog.js';
import { loadContext, buildSystemContent, formatMetadata } from './assistantClient.js';
import { createAgent, createDefaultSkills, listModels } from '../../agent/index.js';
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

  const skills = createDefaultSkills();
  const chatView = createChatView({ host: chatHost, onSend: handleSend });

  let systemContent = null;
  let dataset = null;
  let sessionTokens = 0;
  let introShown = false;

  const ORIENTATION = [
    'Olá! Sou o assistente de IA deste site. Posso responder sobre os candidatos de 2026 (nomes, números e cargos) e sobre os resumos das propostas de governo.',
    '',
    'Para começar:',
    '- Escolha o provedor e cole sua chave de API no painel.',
    '- Digite @ para mencionar um candidato, ou pergunte: "Quais são os candidatos a presidente?"',
    '',
    'Se a informação não estiver nos dados, posso buscar na internet (fontes citadas).',
  ].join('\n');

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
    replaceContent(
      modelSelect,
      models.map((id) => createElement('option', { value: id }, id.replace(/^models\//, ''))),
    );
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
    try {
      const models = await listModels({ provider, apiKey });
      setModelOptions(models, readStorage(KEYS.model(provider.id)) || provider.model);
      writeStorage(KEYS.model(provider.id), modelSelect.value);
      updateStatus();
      setConfigOpen(false);
    } catch (error) {
      setModelOptions([provider.model], provider.model);
      statusElement.textContent = error?.message ?? 'Falha ao listar os modelos.';
      setConfigOpen(true);
    }
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

    const agent = createAgent({
      provider,
      apiKey,
      model,
      systemContext: systemContent,
      skills,
      context: dataset,
    });
    const result = await agent.ask(history);
    updateTokenIndicator(result.usage);

    let answer = result.text;
    if (result.sources?.length) {
      const sources = result.sources.map((source) => `- [${source.title}](${source.url})`).join('\n');
      answer += `\n\n**Fontes**\n${sources}`;
    }
    return { text: answer, meta: formatMetadata(result.elapsedMs, result.usage) };
  }

  function setConfigOpen(open) {
    configEl.hidden = !open;
    configToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    writeStorage(KEYS.configOpen, open ? '1' : '');
  }

  async function ensureReady() {
    if (!systemContent) {
      statusElement.textContent = 'Carregando dados…';
      dataset = await loadContext();
      systemContent = buildSystemContent(dataset);
      chatView.setCandidates(dataset.map((candidate) => ({ nome: candidate.nome, cargo: candidate.cargo })));
    }
    updateStatus();
  }

  function openPanel() {
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    ensureReady()
      .then(() => {
        chatView.focus();
        if (!introShown && chatView.getHistory().length === 0) {
          introShown = true;
          chatView.addMessage('assistant', ORIENTATION);
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

  /** Open the assistant and send a question (used by "Quem É?"). */
  function ask(text) {
    if (panel.hidden) openPanel();
    ensureReady()
      .then(() => chatView.send(text))
      .catch((error) => {
        statusElement.textContent = error?.message ?? 'Falha ao carregar o assistente.';
      });
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

  return { open: openPanel, ask };
}
