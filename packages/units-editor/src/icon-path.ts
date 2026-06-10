import type { UnitType } from '@greckon/core';
import { getIconPathBySlug, getUnitIconPath } from '@greckon/core';
import type { EditorUnit } from './types.js';

export function resolveIconPath(unit: Pick<EditorUnit, 'id' | 'icon'>): string | null {
  const bySlug = getIconPathBySlug(unit.icon);
  if (bySlug) {
    return bySlug;
  }
  try {
    return getUnitIconPath(unit.id as UnitType);
  } catch {
    return null;
  }
}
