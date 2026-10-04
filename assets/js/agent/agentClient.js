/**
 * Provider-agnostic agent client.
 *
 * `runAgent` orchestrates a chat with optional tool (skill) calling. It works
 * with any OpenAI-compatible endpoint and degrades gracefully when a provider
 * does not support tools.
 */
const CHAT_PATH = '/chat/completions';
const MODELS_PATH = '/models';

// Heuristic filter to hide non-chat models (embeddings, images, audio, video...).
const NON_CHAT_MODEL =
  /(embed|rerank|whisper|tts|veo|flux|stable-diffusion|sdxl|bge-|clip|image|audio|kling|video|antigravity|computer-use|aqa|imagen|deep-research)/i;

function providerMessage(detail) {
  if (!detail) return '';
  try {
    let data = JSON.parse(detail);
    if (Array.isArray(data)) data = data[0];
    const message = data?.error?.message ?? data?.message ?? data?.error ?? '';
    return String(message).slice(0, 220);
  } catch {
    return detail.slice(0, 220);
  }
}

function describeHttpError(status, detail) {
  const message = providerMessage(detail);
  const suffix = message ? ` — ${message}` : '';
  if (status === 400) return `Requisição inválida (HTTP 400)${suffix}`;
  if (status === 401 || status === 403)
    return `Chave de API inválida ou sem permissão (HTTP ${status}). Confira a chave do provedor.${suffix}`;
  if (status === 404) return `Modelo não encontrado (HTTP 404). Escolha outro modelo.${suffix}`;
  if (status === 429) return 'Limite de uso atingido (HTTP 429). Aguarde alguns instantes e tente novamente.';
  if (status >= 500) return `Erro no provedor (HTTP ${status}). Tente novamente em instantes.${suffix}`;
  return `Erro HTTP ${status}${suffix}`;
}

function connectionError(context) {
  return new Error(
    `Falha de conexão ao ${context}. Verifique sua internet e se o provedor permite chamadas diretas do navegador (CORS).`,
  );
}

function toApiMessages(history) {
  const messages = history
    .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'ai')
    .map((message) => ({
      role: message.role === 'ai' ? 'assistant' : message.role,
      content: message.text ?? '',
    }));
  // Some chat templates require the conversation to start with a user message,
  // so drop any leading assistant messages (e.g. the local orientation text).
  while (messages.length && messages[0].role !== 'user') messages.shift();
  return messages;
}

function parseArgs(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function sumUsage(accumulated, usage) {
  if (!usage) return accumulated;
  if (!accumulated) return { ...usage };
  return {
    prompt_tokens: (accumulated.prompt_tokens ?? 0) + (usage.prompt_tokens ?? 0),
    completion_tokens: (accumulated.completion_tokens ?? 0) + (usage.completion_tokens ?? 0),
    total_tokens: (accumulated.total_tokens ?? 0) + (usage.total_tokens ?? 0),
    estimated_cost: (accumulated.estimated_cost ?? 0) + (usage.estimated_cost ?? 0) || undefined,
  };
}

function dedupeSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    if (!source?.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

export async function listModels({ provider, apiKey }) {
  let response;
  try {
    response = await fetch(`${provider.baseUrl}${MODELS_PATH}`, {
      headers: { Authorization: `Bearer ${apiKey}`, ...provider.extraHeaders },
    });
  } catch {
    throw connectionError('listar os modelos');
  }
  if (response.status === 404 || response.status === 405) {
    return [provider.model];
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(describeHttpError(response.status, detail));
  }
  const data = await response.json().catch(() => null);
  const items = data?.data ?? data?.models ?? [];
  const ids = items
    .map((model) => model.id ?? model.name)
    .filter((id) => id && !NON_CHAT_MODEL.test(id));
  return ids.length ? ids.sort((a, b) => a.localeCompare(b)) : [provider.model];
}

export async function requestCompletion({
  provider,
  apiKey,
  model,
  messages,
  tools,
  temperature = 0.2,
  maxTokens = 1024,
}) {
  let response;
  try {
    response = await fetch(`${provider.baseUrl}${CHAT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...provider.extraHeaders,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
        ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
      }),
    });
  } catch {
    throw connectionError('consultar o modelo');
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(describeHttpError(response.status, detail));
  }

  const data = await response.json().catch(() => null);
  if (!data) throw new Error('Resposta inválida do provedor (não foi possível ler o JSON).');
  const message = data.choices?.[0]?.message ?? {};
  return {
    text: message.content ?? '',
    toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : null,
    usage: data.usage ?? null,
  };
}

export async function runAgent({
  provider,
  apiKey,
  model,
  systemContent,
  history,
  skills,
  context,
  activity,
  maxIterations = 3,
  temperature,
  maxTokens,
}) {
  const startedAt = performance.now();
  const messages = [{ role: 'system', content: systemContent }, ...toApiMessages(history)];
  const tools = skills && skills.size() ? skills.toTools() : null;
  let useTools = Boolean(tools);
  const sources = [];
  let usage = null;
  let text = '';

  for (let iteration = 0; iteration <= maxIterations; iteration += 1) {
    activity?.thinking();
    let result;
    try {
      result = await requestCompletion({
        provider,
        apiKey,
        model,
        messages,
        tools: useTools ? tools : undefined,
        temperature,
        maxTokens,
      });
    } catch (error) {
      // Provider may not support tool calling: retry once without tools.
      if (useTools) {
        useTools = false;
        result = await requestCompletion({ provider, apiKey, model, messages, temperature, maxTokens });
      } else {
        throw error;
      }
    }

    usage = sumUsage(usage, result.usage);
    const toolCalls = useTools ? result.toolCalls : null;

    if (toolCalls && toolCalls.length && iteration < maxIterations) {
      messages.push({ role: 'assistant', content: result.text || null, tool_calls: toolCalls });
      for (const call of toolCalls) {
        const name = call.function?.name;
        activity?.tool(name);
        const report = (message, meta) => activity?.message(message, { skill: name, ...(meta ?? {}) });
        const outcome = await skills.execute(name, parseArgs(call.function?.arguments), { data: context, report });
        if (Array.isArray(outcome?.sources)) sources.push(...outcome.sources);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ text: outcome?.text ?? '', error: outcome?.error ?? null }),
        });
      }
      activity?.message('Analisando resultados…', { phase: 'thinking' });
      continue;
    }

    text = result.text;
    break;
  }

  activity?.clear();
  return {
    text: text || 'Não foi possível gerar uma resposta.',
    usage,
    elapsedMs: performance.now() - startedAt,
    sources: dedupeSources(sources),
  };
}
