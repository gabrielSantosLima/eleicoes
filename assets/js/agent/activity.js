/**
 * Live activity channel for the agent.
 *
 * The agent core and any skill can emit a short status message ("Pensando…",
 * 'Buscando por "X" no Bing', ...). The UI subscribes to render a live label.
 */
export function createActivity() {
  const listeners = new Set();
  let current = null;

  function emit(message, meta = {}) {
    current = message ? { message, ...meta, at: Date.now() } : null;
    for (const listener of listeners) {
      try {
        listener(current);
      } catch {
        /* a faulty listener must not break the agent */
      }
    }
    return current;
  }

  return {
    emit,
    message: (text, meta) => emit(text, meta),
    thinking: () => emit('Pensando…', { phase: 'thinking' }),
    tool: (skill, label) => emit(label ?? `Executando ${skill}…`, { phase: 'tool', skill }),
    clear: () => emit(null),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    current: () => current,
  };
}
