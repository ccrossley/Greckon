import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createCombatUnit } from '../src/game-data/index.js';
import { loadCombatTuning } from '../src/config/combat-tuning.js';
import { initRapier, createPhysicsWorld } from '../src/combat/physics/index.js';
import { horizontalDistanceField } from '../src/combat/physics/coords.js';
import { resolveAllyOverlaps } from '../src/combat/unit-movement.js';

describe('physics world', () => {
  beforeAll(async () => {
    await initRapier();
  });

  afterEach(() => {
    loadCombatTuning();
  });

  it('snaps units to the ground plane via setFieldPosition', async () => {
    const world = await createPhysicsWorld();
    const unit = createCombatUnit('p1-u1', 'warrior', 'p1', 0.5, 0.88);
    world.ensureBody(unit, { spawnLift: 0.5, wake: true });
    world.setFieldPosition(unit, 0);

    const y = world.getBodyState(unit.unitId)!.body.translation().y;
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(2);
  });

  it('keeps overlapping allies separated on the field plane', () => {
    const a = createCombatUnit('p1-u1', 'warrior', 'p1', 0.5, 0.88);
    const b = createCombatUnit('p1-u2', 'warrior', 'p1', 0.5, 0.88);
    const units = [a, b];

    resolveAllyOverlaps(units, 'p1');

    const dist = horizontalDistanceField(a.x, a.y, b.x, b.y);
    expect(dist).toBeGreaterThan(0.04);
  });
});
