import { pickBotTurnActions } from '@greckon/core';

export function runActionPhase(
  availableActions: Array<{ unitId: string; actionId: string; label: string }>,
  _deadlineMs: number,
  turnIndex: number,
  playerId: string,
  pickCount = 3,
): Promise<Array<{ unitId: string; actionId: string }>> {
  const picks = pickBotTurnActions(availableActions, turnIndex, playerId, pickCount);
  return Promise.resolve(
    picks.map((pick) => ({ unitId: pick.unitId, actionId: pick.actionId })),
  );
}
