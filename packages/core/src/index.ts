export {
  computeAttackDamage,
  createCombatUnit,
  generateBaseStats,
  getActionsForUnit,
  getAttackCooldownMs,
  getMaxDamagePerTick,
  getStatBudget,
  getTurnUnitTypes,
  getUnitDefinition,
  getUnitDisplayName,
  getUnitIndex,
  getUnitRowPriority,
  listUnitTypes,
  scaleStatsForLevel,
  unitTypeFromIndex,
} from './game-data/index.js';
export type { UnitCombatStats } from './game-data/index.js';

export {
  applyTurnAction,
  createUnitId,
  playerIsBottom,
  resetUnitIdCounter,
} from './combat/apply-turn-action.js';

export {
  ACTION_KIND_OFFER_WEIGHT,
  buildPlayerTurnActions,
  buildTurnActions,
  formatTurnActionId,
  isTurnActionValid,
  parseTurnActionId,
} from './combat/turn-actions.js';
export type { ParsedTurnAction } from './combat/turn-actions.js';
export {
  availableDraftUnitTypes,
  isDraftUnitTypeAvailable,
} from './combat/draft-pool.js';

export {
  DEFAULT_FILL_COLOR,
  DEFAULT_UPGRADE_COLOR_MOD,
  getHealthBorderColor,
  getUpgradeFillColor,
  getUnitVisualScale,
  isCriticalHealth,
  MAX_UNIT_LEVEL,
  MAX_UPGRADE_FILL_COLOR,
  ngonPoints,
  normalizeUnitAppearance,
  resolveUnitFillColor,
  UNIT_STROKE_WIDTH,
  UNIT_VISUAL_RADIUS,
} from './combat/visual.js';
export type { UnitAppearance, UpgradeColorMod } from './combat/visual.js';

export {
  getIconPathBySlug,
  getUnitIconPath,
  getUnitIconScale,
  ICON_SLUG_PATHS,
  listIconSlugs,
  UNIT_ICON_PATHS,
  UNIT_ICON_SIZE,
  UNIT_ICON_STROKE_WIDTH,
} from './combat/unit-icon.js';

export {
  chunkUnitsIntoRows,
  getAttackRange,
  getMinUnitGap,
  getUnitBodyRadius,
  getUnitCombatPower,
  isMeleeUnit,
  isRangedUnit,
  layoutAllFormations,
  layoutPlayerFormation,
  MELEE_ATTACK_RANGE,
  MIN_UNIT_GAP,
  RANGED_ATTACK_RANGE,
  rowFitsInField,
  rowXPositionsForUnits,
  FIELD_X_MAX,
  FIELD_X_MIN,
  ENEMY_BACK_Y,
  PLAYER_BACK_Y,
  UNIT_DIAMETER,
  UNIT_X_SPACING,
} from './combat/field-layout.js';

export { relayoutPlayerFormation } from './combat/formation-relayout.js';

export {
  createPhysicsWorld,
  initRapier,
  projectWorldToScreen,
  runPhysicsSimulation,
  type PhysicsWorld,
  type ScreenPoint,
} from './combat/physics/index.js';

export {
  createMovementState,
  resetMovementState,
  SIM_STEP_MS,
  TICK_MS,
  clampFieldCoordinate,
  computeMovement,
  computeSeparation,
  movementStepScale,
  pushMoveEvent,
  recordUnitMoveEvent,
  resolveAllyOverlaps,
  simStepMs,
  simTickMs,
  unitBaseStep,
} from './combat/unit-movement.js';
export type { MovementState, MovementStep, ComputeMovementOptions } from './combat/unit-movement.js';

export {
  PLAYGROUND_MARCH_END_Y,
  PLAYGROUND_MARCH_IDLE_MS,
  playgroundMarchIdleMs,
  runPlaygroundMarchStep,
} from './combat/playground-march.js';

export {
  pickBotTurnAction,
  pickBotTurnActions,
  pickBotUnitType,
  pickRandomTurnAction,
  pickRandomUnitType,
} from './combat/random-choice.js';

export {
  DEFAULT_COMBAT_TUNING,
  DEFAULT_GAME_CONFIG,
  chargeRampPerMs,
  chargeSpeedRatio,
  floatVisualOffset,
  getCombatTuning,
  loadCombatTuning,
  loadGameConfig,
  maxSimMs,
  maxSimTicks,
} from './config/index.js';
export type { CombatTuningConfig, DeepPartial } from './config/index.js';

export { decodeNetworkMessage, encodeNetworkMessage } from './messages/index.js';

export type {
  ActionDefinition,
  AttackType,
  CombatUnit,
  EncodedMessage,
  GameConfig,
  MatchId,
  MovementType,
  NetworkMessage,
  PlaybackEvent,
  PlaybackEventKind,
  PickPhase,
  PlayerId,
  TurnActionKind,
  UnitDefinition,
  UnitType,
} from './types/domain.js';

export type { Unit } from './generated/units.js';

export type { paths, components } from './generated/openapi.js';
export type { LobbyClientMessage } from './generated/ws-lobby-client.js';
export type { CombatClientMessage } from './generated/ws-combat-client.js';
export type { LobbyCombatServerMessage } from './generated/ws-lobby-combat-server.js';
