import RAPIER from '@dimforge/rapier3d-compat';

let initPromise: Promise<void> | undefined;

/** One-time Rapier WASM init (Node or browser). */
export function initRapier(): Promise<void> {
  if (initPromise === undefined) {
    initPromise = RAPIER.init();
  }
  return initPromise as Promise<void>;
}

export { RAPIER };
