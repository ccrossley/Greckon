import type { GameConfig } from '../types/domain.js';
import { loadCombatTuning } from './combat-tuning.js';

export { DEFAULT_COMBAT_TUNING, getCombatTuning, loadCombatTuning } from './combat-tuning.js';
export type { CombatTuningConfig, DeepPartial } from './combat-tuning.js';
export {
  chargeRampPerMs,
  chargeSpeedRatio,
  floatVisualOffset,
  maxSimMs,
  maxSimTicks,
  simStepMs,
  simTickMs,
} from './combat-tuning.js';

export const DEFAULT_GAME_CONFIG: GameConfig = {
  turnWindowSeconds: 10,
  fightPlaybackSeconds: 12,
  actionSelectionSeconds: 10,
  lobbyReconnectIntervalMs: 3000,
  combatServerLobbyReconnectTimeoutSeconds: 30,
  maxRounds: 10,
  secretDraftPickCount: 4,
  postDraftPauseSeconds: 1,
  roundActionPickCount: 3,
  roundActionOfferCount: 3,
  roundUnitPickCount: 3,
  unitPickCount: 3,
};

export function loadGameConfig(
  overrides: Partial<GameConfig> = {},
): GameConfig {
  const { combatTuning, ...rest } = overrides;
  const config = { ...DEFAULT_GAME_CONFIG, ...rest };
  if (overrides.roundUnitPickCount !== undefined) {
    config.unitPickCount = overrides.roundUnitPickCount;
  } else if (overrides.unitPickCount !== undefined && overrides.roundUnitPickCount === undefined) {
    config.roundUnitPickCount = overrides.unitPickCount;
  }
  loadCombatTuning(combatTuning ?? {});
  return config;
}
