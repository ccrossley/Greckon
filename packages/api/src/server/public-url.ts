export function resolvePublicWsBase(httpPort: number): string {
  const explicit = process.env.GRECKON_PUBLIC_URL;
  if (explicit) {
    const url = new URL(explicit);
    return `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}`;
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return `wss://${new URL(process.env.RENDER_EXTERNAL_URL).host}`;
  }
  const host = process.env.GRECKON_HOST ?? 'localhost';
  return `ws://${host}:${httpPort}`;
}

export function useEmbeddedCombat(): boolean {
  if (process.env.GRECKON_EMBEDDED_COMBAT === '1') {
    return true;
  }
  if (process.env.GRECKON_EMBEDDED_COMBAT === '0') {
    return false;
  }
  return process.env.RENDER === 'true';
}
