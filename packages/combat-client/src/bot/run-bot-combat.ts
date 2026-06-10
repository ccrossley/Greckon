import { loadGameConfig } from '@greckon/core';
import { runCombatSession } from '../combat/combat-session.js';

export async function runBotCombat(combatWsUrl: string, token: string): Promise<void> {
  console.log('[bot] joining combat as artificial opponent');
  await runCombatSession(combatWsUrl, token, {
    config: loadGameConfig(),
    logPrefix: '[bot]',
  });
}
