export type CombatClientMessage =
  | GameState
  | RequestUnitPick
  | UnitPick
  | RequestAction
  | ActionSubmit
  | TurnOutcome
  | RoundResult
  | MatchResult;
export type CombatPhase =
  | "secret_draft"
  | "draft_reveal"
  | "unit_pick"
  | "fight_playback"
  | "action_selection"
  | "round_end"
  | "match_end";
export type UnitType = string;
export type PlayerId = string;
export type AttackType = "line" | "projectile" | "instant" | "multi";
export type MovementType = "float" | "hop" | "charge";
export type PickPhase = "secret_draft" | "round_deploy";
export type PlaybackEventKind = "spawn" | "move" | "attack" | "heal" | "upgrade" | "death";

export interface GameState {
  type: "GameState";
  matchId: string;
  round: number;
  roundWins: RoundWins;
  phase: CombatPhase;
  aliveUnits: AliveUnit[];
  ownDraft?: UnitType[];
}
export interface RoundWins {
  playerA: number;
  playerB: number;
}
export interface AliveUnit {
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
}
export interface RequestUnitPick {
  type: "RequestUnitPick";
  pickPhase: PickPhase;
  pickIndex: number;
  deadlineMs: number;
  availableUnitTypes: UnitType[];
}
export interface UnitPick {
  type: "UnitPick";
  pickPhase?: PickPhase;
  pickIndex: number;
  unitType: UnitType;
}
export interface RequestAction {
  type: "RequestAction";
  turnIndex: number;
  pickIndex: number;
  deadlineMs: number;
  pickCount: number;
  /**
   * @minItems 1
   * @maxItems 3
   */
  availableActions:
    | [AvailableAction]
    | [AvailableAction, AvailableAction]
    | [AvailableAction, AvailableAction, AvailableAction];
}
export interface AvailableAction {
  unitId: string;
  actionId: string;
  label: string;
}
export interface ActionSubmit {
  type: "ActionSubmit";
  turnIndex: number;
  pickIndex: number;
  /**
   * @minItems 1
   * @maxItems 1
   */
  actions: [ActionInput];
}
export interface ActionInput {
  unitId: string;
  actionId: string;
}
export interface TurnOutcome {
  type: "TurnOutcome";
  turnIndex: number;
  fightStartMs: number;
  playback: PlaybackEvent[];
  roundScore: RoundWins;
  fieldAtFightStart: AliveUnit[];
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
  movementType?: MovementType;
  visualYOffset?: number;
  chargeSpeed?: number;
  height?: number;
}
export interface RoundResult {
  type: "RoundResult";
  round: number;
  winnerPlayerId?: PlayerId;
  roundWins: RoundWins;
}
export interface MatchResult {
  type: "MatchResult";
  winnerPlayerId: PlayerId;
  finalRoundWins: RoundWins;
}
