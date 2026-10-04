/**
 * Catalog of supported AI providers (OpenAI-compatible Chat Completions).
 * The user brings their own key (BYO key) and can override url/model.
 */
export const PROVIDERS = Object.freeze([
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    extraHeaders: {},
    helpUrl: 'https://platform.openai.com/api-keys',
    helpTip: 'Acesse platform.openai.com → API keys → Create new secret key.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    extraHeaders: {},
    helpUrl: 'https://aistudio.google.com/app/apikey',
    helpTip: 'Acesse o Google AI Studio → Get API key.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-latest',
    extraHeaders: {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpTip: 'Acesse o Console da Anthropic → Settings → API keys → Create key.',
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    extraHeaders: {},
    helpUrl: 'https://deepinfra.com/dash/api_keys',
    helpTip: 'Acesse o DeepInfra → Dashboard → API keys.',
  },
]);

export const DEFAULT_PROVIDER = 'openai';
export const DEFAULT_TEMPERATURE = 0.2;
export const DEFAULT_MAX_TOKENS = 1024;
export const CHAT_COMPLETIONS_PATH = '/chat/completions';
export const MODELS_PATH = '/models';

export function getProvider(id) {
  return PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[0];
}
