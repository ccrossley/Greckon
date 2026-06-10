export type LobbyCombatServerMessage =
  | RegisterServer
  | ServerRegistered
  | AssignMatch
  | MatchComplete
  | LobbyDisconnected;

export interface RegisterServer {
  type: "RegisterServer";
  serverId: string;
  host: string;
  clientWsPort: number;
  capacity: number;
}
export interface ServerRegistered {
  type: "ServerRegistered";
  ok: true;
}
export interface AssignMatch {
  type: "AssignMatch";
  matchId: string;
  /**
   * @minItems 2
   * @maxItems 2
   */
  players: [PlayerRef, PlayerRef];
}
export interface PlayerRef {
  playerId: string;
  username: string;
  token: string;
}
export interface MatchComplete {
  type: "MatchComplete";
  matchId: string;
  winnerPlayerId: string;
}
export interface LobbyDisconnected {
  type: "LobbyDisconnected";
}
