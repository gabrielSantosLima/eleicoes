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
import { createActivity } from './activity.js';
import { createSkillRegistry } from './skills/registry.js';
import { dataSkill } from './skills/dataSkill.js';
import { webSearchSkill } from './skills/webSearchSkill.js';
import { readPageSkill } from './skills/readPageSkill.js';

export { defineSkill } from './skills/defineSkill.js';
export { createSkillRegistry } from './skills/registry.js';
export { dataSkill } from './skills/dataSkill.js';
export { webSearchSkill } from './skills/webSearchSkill.js';
export { readPageSkill } from './skills/readPageSkill.js';
export { createActivity } from './activity.js';
export { listModels, requestCompletion, runAgent } from './agentClient.js';

/** Default skill set: local data + internet search + page reader. */
export function createDefaultSkills() {
  return createSkillRegistry([dataSkill, webSearchSkill, readPageSkill]);
}

export function createAgent({
  provider,
  apiKey,
  model,
  systemContext,
  skills,
  context,
  activity,
  maxIterations,
  temperature,
  maxTokens,
}) {
  return {
    ask: (history) =>
      runAgent({
        provider,
        apiKey,
        model,
        systemContent: systemContext,
        history,
        skills,
        context,
        activity,
        maxIterations,
        temperature,
        maxTokens,
      }),
  };
}
