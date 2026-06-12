import { pickBotTurnAction } from '@greckon/core';

export function runActionPhase(
  availableActions: Array<{ unitId: string; actionId: string; label: string }>,
  _deadlineMs: number,
  turnIndex: number,
  playerId: string,
  pickIndex: number,
): Promise<Array<{ unitId: string; actionId: string }>> {
  const pick = pickBotTurnAction(availableActions, turnIndex, `${playerId}:${pickIndex}`);
  if (!pick) {
    return Promise.resolve([]);
  }
  return Promise.resolve([{ unitId: pick.unitId, actionId: pick.actionId }]);
}
