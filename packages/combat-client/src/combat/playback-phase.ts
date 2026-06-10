import type { NetworkMessage } from '@greckon/core';

export function runPlaybackPhase(
  outcome: Extract<NetworkMessage, { type: 'TurnOutcome' }>,
  durationSeconds: number,
): Promise<void> {
  console.log(
    `[playback] ${outcome.playback.map((event) => event.description).join(', ') || 'fighting...'}`,
  );
  return new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));
}
