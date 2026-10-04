/**
 * Generic, extensible AI agent.
 *
 * The core (`agentClient`) is provider-agnostic and skill-agnostic. New
 * capabilities are added as skills and registered in a `SkillRegistry` — no
 * change to the agent core is required.
 *
 * Example:
 *   const skills = createDefaultSkills();
 *   const agent = createAgent({ provider, apiKey, model, systemContext, skills, context });
 *   const { text, sources } = await agent.ask(history);
 */
import { runAgent } from './agentClient.js';
import { createSkillRegistry } from './skills/registry.js';
import { dataSkill } from './skills/dataSkill.js';
import { webSearchSkill } from './skills/webSearchSkill.js';

export { defineSkill } from './skills/defineSkill.js';
export { createSkillRegistry } from './skills/registry.js';
export { dataSkill } from './skills/dataSkill.js';
export { webSearchSkill } from './skills/webSearchSkill.js';
export { listModels, requestCompletion, runAgent } from './agentClient.js';

/** Default skill set: local data + internet search. */
export function createDefaultSkills() {
  return createSkillRegistry([dataSkill, webSearchSkill]);
}

export function createAgent({
  provider,
  apiKey,
  model,
  systemContext,
  skills,
  context,
  maxIterations,
  temperature,
  maxTokens,
}) {
  return {
    ask: (history) =>
      runAgent({ provider, apiKey, model, systemContent: systemContext, history, skills, context, maxIterations, temperature, maxTokens }),
  };
}
