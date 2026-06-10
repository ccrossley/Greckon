export enum AppPart {
  Api = 'api',
  CombatClient = 'combat-client',
  CombatServer = 'combat-server',
  Web = 'web',
  UnitsEditor = 'units-editor',
}

export interface ServiceLocator {
  register<T>(part: AppPart, token: symbol, factory: () => T): void;
  resolve<T>(part: AppPart, token: symbol): T;
}
