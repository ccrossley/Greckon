import type { Faction, FactionId } from '../generated/factions.js';
import { FACTIONS, FACTION_CATALOG } from '../generated/factions.js';

export type { Faction, FactionId };

export function listFactions(): readonly Faction[] {
  return FACTIONS;
}

export function listFactionIds(): FactionId[] {
  return FACTIONS.map((faction) => faction.id);
}

export function getFaction(factionId: FactionId): Faction {
  const faction = FACTION_CATALOG[factionId];
  if (!faction) {
    throw new Error(`Unknown faction: ${factionId}`);
  }
  return faction;
}

export function isValidFactionId(value: string): value is FactionId {
  return value in FACTION_CATALOG;
}

export function getFactionDisplayName(factionId: FactionId): string {
  return getFaction(factionId).name;
}
