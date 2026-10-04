/**
 * Contract helper for declaring an agent skill.
 *
 * A skill is a self-contained capability the agent can call. To add a new one,
 * create a module that exports `defineSkill({ name, description, parameters, run })`
 * and register it in the skill registry.
 */
export function defineSkill({ name, description = '', parameters = { type: 'object', properties: {} }, run }) {
  if (!name || typeof run !== 'function') {
    throw new Error('defineSkill: "name" e "run()" são obrigatórios.');
  }
  return Object.freeze({ name, description, parameters, run });
}
