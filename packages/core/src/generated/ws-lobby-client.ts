export type LobbyClientMessage = QueueUpdate | MatchFound | ServerShutdown | Ping | Pong;

export interface QueueUpdate {
  type: "QueueUpdate";
  queuePosition: number;
}
export interface MatchFound {
  type: "MatchFound";
  matchId: string;
  combatWsUrl: string;
  opponent: Opponent;
}
export interface Opponent {
  playerId: string;
  username: string;
}
export interface ServerShutdown {
  type: "ServerShutdown";
  reason: string;
  reconnectAfterMs?: number;
}
export interface Ping {
  type: "Ping";
}
export interface Pong {
  type: "Pong";
}
