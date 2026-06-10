import type { NetworkMessage, PlayerId, UnitType } from '@greckon/core';

export function promptUnitPick(
  _playerId: PlayerId,
  _pickIndex: number,
): Promise<UnitType> {
  throw new Error('Not implemented');
}

export function promptActions(
  _playerId: PlayerId,
  _availableActions: Array<{ unitId: string; actionId: string; label: string }>,
  _deadlineMs: number,
): Promise<Array<{ unitId: string; actionId: string }>> {
  throw new Error('Not implemented');
}

export function handleClientMessage(
  _playerId: PlayerId,
  _message: NetworkMessage,
): void {
  throw new Error('Not implemented');
}

export { startClientGateway } from './client-gateway-server.js';
