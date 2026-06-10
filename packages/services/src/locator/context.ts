import type { AppPart, ServiceLocator } from './types.js';

let activeLocator: ServiceLocator | null = null;
let activePart: AppPart | null = null;

/** Called once from the app composition root after services are registered. */
export function setAppServices(locator: ServiceLocator, part: AppPart): void {
  activeLocator = locator;
  activePart = part;
}

export function getAppServices(): { locator: ServiceLocator; part: AppPart } {
  if (!activeLocator || activePart === null) {
    throw new Error('Services not initialized — call setAppServices() from the app entry point');
  }
  return { locator: activeLocator, part: activePart };
}

/** Resolve a service registered for the active app part. */
export function resolveService<T>(token: symbol): T {
  const { locator, part } = getAppServices();
  return locator.resolve<T>(part, token);
}
