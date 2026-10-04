/**
 * Skill registry: keeps available skills and exposes them as OpenAI-style tools.
 */
import { defineSkill } from './defineSkill.js';

function toTool(skill) {
  return {
    type: 'function',
    function: {
      name: skill.name,
      description: skill.description,
      parameters: skill.parameters,
    },
  };
}

export function createSkillRegistry(skills = []) {
  const items = new Map();

  const registry = {
    register(skill) {
      const normalized = defineSkill(skill);
      items.set(normalized.name, normalized);
      return registry;
    },
    get: (name) => items.get(name) ?? null,
    all: () => [...items.values()],
    size: () => items.size,
    /** OpenAI-compatible `tools` array. */
    toTools: () => [...items.values()].map(toTool),
    async execute(name, args, context = {}) {
      const skill = items.get(name);
      if (!skill) return { error: `Skill desconhecida: ${name}` };
      try {
        return (await skill.run(args ?? {}, context)) ?? {};
      } catch (error) {
        return { error: error?.message ?? String(error) };
      }
    },
  };

  for (const skill of skills) registry.register(skill);
  return registry;
}
