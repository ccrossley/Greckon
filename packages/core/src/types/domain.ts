import type { AttackType, MovementType, UnitType, UpgradeColorMod } from './combat-enums.js';
import type { FactionId } from '../generated/factions.js';

export type { AttackType, MovementType, UnitType, UpgradeColorMod } from './combat-enums.js';
export type { FactionId } from '../generated/factions.js';
export { MELEE_ATTACK_RANGE, RANGED_ATTACK_RANGE } from './combat-enums.js';

export type PlayerId = string;
export type MatchId = string;

export type PlaybackEventKind =
  | 'spawn'
  | 'move'
  | 'attack'
  | 'heal'
  | 'upgrade'
  | 'death';

export type TurnActionKind = 'upgrade' | 'double' | 'add';

export interface UnitDefinition {
  unitType: UnitType;
  name: string;
  maxHp: number;
  ngonSides: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;
  addAmount: number;
  attackType: AttackType;
  attackDelayMs: number;
  travelTimeMs: number;
  movementType: MovementType;
  icon: string;
  damage?: number;
  fillColor?: string;
  upgradeColorMod?: UpgradeColorMod;
  actions: ActionDefinition[];
}

export interface ActionDefinition {
  actionId: string;
  label: string;
  requiresAlive: boolean;
}

export interface StatusEffect {
  kind: string;
  expiresAtMs: number;
  magnitude: number;
  /** Optional source unit for DoT attribution. */
  sourceUnitId?: string;
}

export interface CombatUnit {
  unitId: string;
  unitType: UnitType;
  playerId: PlayerId;
  hp: number;
  maxHp: number;
  level: number;
  priority: number;
  x: number;
  y: number;
  attack: number;
  defense: number;
  speed: number;
  ngonSides: number;
  attackRange: number;
  attackType: AttackType;
  attackDelayMs: number;
  travelTimeMs: number;
  movementType: MovementType;
  damage?: number;
  statusEffects?: StatusEffect[];
}

export interface PlaybackEvent {
  atMs: number;
  description: string;
  kind?: PlaybackEventKind;
  sourceUnitId?: string;
  targetUnitId?: string;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  durationMs?: number;
  attackType?: AttackType;
  travelTimeMs?: number;
  damage?: number;
  healAmount?: number;
  playbackColor?: string;
  playbackBeam?: 'damage' | 'heal';
  movementType?: MovementType;
  /** Display-only vertical offset (negative = hop/float up). */
  visualYOffset?: number;
  /** Charge intensity 0–1 for playback visuals. */
  chargeSpeed?: number;
  /** World vertical height for 3D physics playback (meters). */
  height?: number;
}

import type { CombatTuningConfig, DeepPartial } from '../config/combat-tuning.js';

export interface GameConfig {
  turnWindowSeconds: number;
  fightPlaybackSeconds: number;
  actionSelectionSeconds: number;
  lobbyReconnectIntervalMs: number;
  combatServerLobbyReconnectTimeoutSeconds: number;
  maxRounds: number;
  /** Hidden draft size at match start (defines action pool). */
  secretDraftPickCount: number;
  /** Pause after secret draft before squads deploy and action selection. */
  postDraftPauseSeconds: number;
  /** Squad actions each player may submit before each combat round. */
  roundActionPickCount: number;
  /** Action choices shown on each action selection prompt. */
  roundActionOfferCount: number;
  /** Lockstep field deploy picks before each combat round. */
  roundUnitPickCount: number;
  /** @deprecated use roundUnitPickCount */
  unitPickCount: number;
  /** Partial overrides for combat sim & playback tuning (merged at load). */
  combatTuning?: DeepPartial<CombatTuningConfig>;
}

export interface EncodedMessage {
  type: string;
  payload: unknown;
}

export type PickPhase = 'secret_draft' | 'round_deploy';

export type NetworkMessage =
  | { type: 'QueueUpdate'; queuePosition: number }
  | {
      type: 'MatchFound';
      matchId: string;
      combatWsUrl: string;
      opponent: { playerId: string; username: string; factionId: FactionId };
    }
  | { type: 'ServerShutdown'; reason: string; reconnectAfterMs?: number }
  | { type: 'Ping' }
  | { type: 'Pong' }
  | {
      type: 'GameState';
      matchId: string;
      round: number;
      roundWins: { playerA: number; playerB: number };
      phase: string;
      aliveUnits: CombatUnit[];
      ownDraft?: UnitType[];
    }
  | {
      type: 'RequestUnitPick';
      pickPhase: PickPhase;
      pickIndex: number;
      deadlineMs: number;
      availableUnitTypes: UnitType[];
    }
  | { type: 'UnitPick'; pickPhase?: PickPhase; pickIndex: number; unitType: UnitType }
  | {
      type: 'RequestAction';
      turnIndex: number;
      pickIndex: number;
      deadlineMs: number;
      pickCount: number;
      availableActions: Array<{ unitId: string; actionId: string; label: string }>;
    }
  | {
      type: 'ActionSubmit';
      turnIndex: number;
      pickIndex: number;
      actions: Array<{ unitId: string; actionId: string }>;
    }
  | {
      type: 'TurnOutcome';
      turnIndex: number;
      playback: PlaybackEvent[];
      fightStartMs: number;
      roundScore: { playerA: number; playerB: number };
      fieldAtFightStart: CombatUnit[];
    }
  | {
      type: 'RoundResult';
      round: number;
      winnerPlayerId?: PlayerId;
      roundWins: { playerA: number; playerB: number };
    }
  | {
      type: 'MatchResult';
      winnerPlayerId: PlayerId;
      finalRoundWins: { playerA: number; playerB: number };
    }
  | {
      type: 'RegisterServer';
      serverId: string;
      host: string;
      clientWsPort: number;
      capacity: number;
    }
  | { type: 'ServerRegistered'; ok: true }
  | {
      type: 'AssignMatch';
      matchId: string;
      players: Array<{ playerId: string; username: string; token: string; factionId: FactionId }>;
    }
  | { type: 'MatchComplete'; matchId: string; winnerPlayerId: PlayerId }
  | { type: 'LobbyDisconnected' };
