import type { EncodedMessage, NetworkMessage } from '../types/domain.js';

export function encodeNetworkMessage(_message: NetworkMessage): EncodedMessage {
  throw new Error('Not implemented');
}

export function decodeNetworkMessage<T extends NetworkMessage['type']>(
  _type: T,
  _payload: unknown,
): Extract<NetworkMessage, { type: T }> {
  throw new Error('Not implemented');
}
