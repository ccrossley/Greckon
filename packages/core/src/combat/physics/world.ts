import type { CombatUnit, PlaybackEvent } from '../../types/domain.js';
import { getCombatTuning } from '../../config/combat-tuning.js';
import { FIELD_X_MAX, FIELD_X_MIN } from '../field-layout.js';
import { isMeleeUnit } from '../field-layout.js';
import { floatVisualOffset } from '../unit-movement.js';
import { getUnitDisplayName } from '../../game-data/index.js';
import {
  clampFieldX,
  clampFieldZ,
  fieldXToWorld,
  fieldZToWorld,
  playableWorldBounds,
  worldBodyRadius,
  worldXToField,
  worldZToField,
} from './coords.js';
import { RAPIER } from './init.js';

const FIELD_Z_MIN = FIELD_X_MIN;
const FIELD_Z_MAX = FIELD_X_MAX;

export interface UnitBodyState {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  handle: number;
}

export interface SlotTarget {
  unitId: string;
  fieldX: number;
  fieldZ: number;
}

export interface PhysicsWorldOptions {
  /** Fixed physics substep duration in seconds. */
  substepSec?: number;
}

export class PhysicsWorld {
  readonly world: RAPIER.World;
  private readonly bodies = new Map<string, UnitBodyState>();
  private readonly substepSec: number;
  private readonly slotTargets = new Map<string, SlotTarget>();
  private readonly nextHopAtMs = new Map<string, number>();
  private readonly chargeMultiplier = new Map<string, number>();
  private readonly hopVisualUntilMs = new Map<string, number>();

  getSlotTarget(unitId: string): SlotTarget | undefined {
    return this.slotTargets.get(unitId);
  }

  getNextHopAtMs(unitId: string): number | undefined {
    return this.nextHopAtMs.get(unitId);
  }

  setNextHopAtMs(unitId: string, atMs: number): void {
    this.nextHopAtMs.set(unitId, atMs);
  }

  getHopAtMsMap(): Map<string, number> {
    return this.nextHopAtMs;
  }

  constructor(options: PhysicsWorldOptions = {}) {
    const tuning = getCombatTuning().physics;
    this.substepSec = options.substepSec ?? tuning.substepSec;
    this.world = new RAPIER.World({ x: 0, y: -tuning.gravity, z: 0 });
    this.buildStaticGeometry();
  }

  private buildStaticGeometry(): void {
    const tuning = getCombatTuning().physics;
    const { xMin, xMax, zMin, zMax } = playableWorldBounds();
    const wallHeight = tuning.wallHeight;
    const wallThickness = tuning.wallThickness;
    const groundY = -0.02;

    const groundBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation((xMin + xMax) / 2, groundY, (zMin + zMax) / 2),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid((xMax - xMin) / 2, 0.02, (zMax - zMin) / 2)
        .setRestitution(tuning.groundRestitution)
        .setFriction(tuning.groundFriction),
      groundBody,
    );

    const walls: Array<{ hx: number; hy: number; hz: number; tx: number; ty: number; tz: number }> = [
      {
        hx: wallThickness / 2,
        hy: wallHeight / 2,
        hz: (zMax - zMin) / 2,
        tx: xMin - wallThickness / 2,
        ty: wallHeight / 2,
        tz: (zMin + zMax) / 2,
      },
      {
        hx: wallThickness / 2,
        hy: wallHeight / 2,
        hz: (zMax - zMin) / 2,
        tx: xMax + wallThickness / 2,
        ty: wallHeight / 2,
        tz: (zMin + zMax) / 2,
      },
      {
        hx: (xMax - xMin) / 2,
        hy: wallHeight / 2,
        hz: wallThickness / 2,
        tx: (xMin + xMax) / 2,
        ty: wallHeight / 2,
        tz: zMin - wallThickness / 2,
      },
      {
        hx: (xMax - xMin) / 2,
        hy: wallHeight / 2,
        hz: wallThickness / 2,
        tx: (xMin + xMax) / 2,
        ty: wallHeight / 2,
        tz: zMax + wallThickness / 2,
      },
    ];

    for (const wall of walls) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(wall.tx, wall.ty, wall.tz),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(wall.hx, wall.hy, wall.hz)
          .setRestitution(0.05)
          .setFriction(tuning.groundFriction),
        body,
      );
    }
  }

  getBodyState(unitId: string): UnitBodyState | undefined {
    return this.bodies.get(unitId);
  }

  getWorldHeight(unitId: string, atMs = 0, movementType?: CombatUnit['movementType']): number {
    const scale = getCombatTuning().physics.fieldScale;
    const hopUntil = this.hopVisualUntilMs.get(unitId);
    if (hopUntil !== undefined && atMs <= hopUntil) {
      const hopStart = hopUntil - getCombatTuning().movement.hop.intervalMs;
      const t = Math.max(0, Math.min(1, (atMs - hopStart) / Math.max(1, hopUntil - hopStart)));
      const hopHeight = getCombatTuning().playback.hop.visualHeight * scale;
      return hopHeight * Math.sin(Math.PI * t);
    }
    if (movementType === 'float') {
      return floatVisualOffset(atMs) * scale;
    }
    return 0;
  }

  /** Snap body to field XZ and lock on the ground plane. */
  setFieldPosition(
    unit: CombatUnit,
    atMs: number,
    options: { didHop?: boolean } = {},
  ): void {
    const state = this.bodies.get(unit.unitId);
    if (!state) {
      return;
    }
    const radius = worldBodyRadius(unit.level);
    const wx = fieldXToWorld(clampFieldX(unit.x));
    const wz = fieldZToWorld(clampFieldZ(unit.y));
    state.body.setTranslation({ x: wx, y: radius, z: wz }, true);
    state.body.setLinvel({ x: 0, y: 0, z: 0 }, true);

    if (options.didHop) {
      const hopMs = getCombatTuning().movement.hop.intervalMs;
      this.hopVisualUntilMs.set(unit.unitId, atMs + hopMs);
    }
  }

  syncUnitFromBody(unit: CombatUnit): void {
    const state = this.bodies.get(unit.unitId);
    if (!state) {
      return;
    }
    const t = state.body.translation();
    unit.x = clampFieldX(worldXToField(t.x));
    unit.y = clampFieldZ(worldZToField(t.z));
  }

  syncAllUnits(units: CombatUnit[]): void {
    for (const unit of units) {
      this.syncUnitFromBody(unit);
    }
  }

  removeUnit(unitId: string): void {
    const state = this.bodies.get(unitId);
    if (state) {
      this.world.removeRigidBody(state.body);
      this.bodies.delete(unitId);
    }
    this.slotTargets.delete(unitId);
    this.nextHopAtMs.delete(unitId);
    this.chargeMultiplier.delete(unitId);
    this.hopVisualUntilMs.delete(unitId);
  }

  ensureBody(
    unit: CombatUnit,
    options: { spawnLift?: number; wake?: boolean } = {},
  ): UnitBodyState {
    const existing = this.bodies.get(unit.unitId);
    if (existing) {
      this.updateBodyCollider(existing, unit);
      return existing;
    }

    const tuning = getCombatTuning().physics;
    const radius = worldBodyRadius(unit.level);
    const lift = options.spawnLift ?? tuning.spawnLift;
    const wx = fieldXToWorld(clampFieldX(unit.x));
    const wz = fieldZToWorld(clampFieldZ(unit.y));

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(wx, radius + lift, wz)
      .setLinearDamping(tuning.linearDamping)
      .setAngularDamping(1)
      .setCanSleep(true)
      .lockRotations()
      .enabledTranslations(true, false, true);
    const body = this.world.createRigidBody(bodyDesc);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);

    const volume = (4 / 3) * Math.PI * radius ** 3;
    const massScale = isMeleeUnit(unit) ? tuning.meleeMassScale : tuning.rangedMassScale;
    const mass = volume * tuning.unitDensity * (0.8 + unit.level * 0.15) * massScale;

    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setRestitution(tuning.combatUnitRestitution)
      .setFriction(tuning.combatUnitFriction)
      .setDensity(mass / volume);
    const collider = this.world.createCollider(colliderDesc, body);

    const state: UnitBodyState = { body, collider, handle: body.handle };
    this.bodies.set(unit.unitId, state);
    if (options.wake !== false) {
      body.wakeUp();
    }
    return state;
  }

  private updateBodyCollider(_state: UnitBodyState, _unit: CombatUnit): void {
    // Level changes during a round are rare; collider radius is set at spawn.
  }

  syncBodies(units: CombatUnit[]): void {
    const aliveIds = new Set(units.filter((u) => u.hp > 0).map((u) => u.unitId));
    for (const id of [...this.bodies.keys()]) {
      if (!aliveIds.has(id)) {
        this.removeUnit(id);
      }
    }
    for (const unit of units) {
      if (unit.hp <= 0) {
        continue;
      }
      this.ensureBody(unit);
    }
  }

  setSlotTargets(targets: SlotTarget[]): void {
    this.slotTargets.clear();
    for (const target of targets) {
      this.slotTargets.set(target.unitId, target);
    }
  }

  clearSlotTargets(): void {
    this.slotTargets.clear();
  }

  resetCombatState(): void {
    this.nextHopAtMs.clear();
    this.chargeMultiplier.clear();
    this.hopVisualUntilMs.clear();
  }

  getChargeMultiplier(unitId: string): number {
    const { minSpeedMultiplier } = getCombatTuning().movement.charge;
    return this.chargeMultiplier.get(unitId) ?? minSpeedMultiplier;
  }

  setChargeMultiplier(unitId: string, value: number): void {
    this.chargeMultiplier.set(unitId, value);
  }

  /** Blend toward target XZ velocity; collision response from the prior step is preserved. */
  applyMovementDrive(
    unitId: string,
    targetVx: number,
    targetVz: number,
    options: { holdingRanged?: boolean } = {},
  ): void {
    const tuning = getCombatTuning().physics;
    const state = this.bodies.get(unitId);
    if (!state) {
      return;
    }
    const v = state.body.linvel();
    let tx = targetVx;
    let tz = targetVz;
    const targetSpeed = Math.hypot(tx, tz);
    const maxSpeed = tuning.combatPushSpeed;
    if (targetSpeed > maxSpeed) {
      const scale = maxSpeed / targetSpeed;
      tx *= scale;
      tz *= scale;
    }
    const blend = options.holdingRanged ? tuning.rangedHoldDriveBlend : tuning.driveBlend;
    state.body.setLinvel(
      {
        x: v.x * (1 - blend) + tx * blend,
        y: 0,
        z: v.z * (1 - blend) + tz * blend,
      },
      true,
    );
    state.body.wakeUp();
  }

  markHopVisual(unitId: string, atMs: number): void {
    const hopMs = getCombatTuning().movement.hop.intervalMs;
    this.hopVisualUntilMs.set(unitId, atMs + hopMs);
  }

  /** Keep sphere centers on the ground plane after combat steps. */
  clampUnitsToGround(units: CombatUnit[]): void {
    for (const unit of units) {
      if (unit.hp <= 0) {
        continue;
      }
      const state = this.bodies.get(unit.unitId);
      if (!state) {
        continue;
      }
      const radius = worldBodyRadius(unit.level);
      const t = state.body.translation();
      state.body.setTranslation({ x: t.x, y: radius, z: t.z }, true);
      const v = state.body.linvel();
      if (v.y !== 0) {
        state.body.setLinvel({ x: v.x, y: 0, z: v.z }, true);
      }
    }
  }

  getHorizontalSpeed(unitId: string): number {
    const state = this.bodies.get(unitId);
    if (!state) {
      return 0;
    }
    const v = state.body.linvel();
    return Math.hypot(v.x, v.z);
  }

  step(substeps = 1): void {
    for (let i = 0; i < substeps; i++) {
      this.world.timestep = this.substepSec;
      this.world.step();
      this.clampAllVelocities();
    }
  }

  stepForSimMs(simMs: number): void {
    const substepSec = this.substepSec;
    const count = Math.max(1, Math.round(simMs / 1000 / substepSec));
    for (let i = 0; i < count; i++) {
      this.world.timestep = substepSec;
      this.world.step();
      this.clampAllVelocities();
    }
  }

  /** Keep speeds in a stable band so collision correction does not explode. */
  clampAllVelocities(): void {
    const tuning = getCombatTuning().physics;
    for (const state of this.bodies.values()) {
      const v = state.body.linvel();
      let { x, y, z } = v;
      const horizontal = Math.hypot(x, z);
      if (horizontal > tuning.maxLinearSpeed) {
        const scale = tuning.maxLinearSpeed / horizontal;
        x *= scale;
        z *= scale;
      }
      if (y > tuning.maxVerticalSpeed) {
        y = tuning.maxVerticalSpeed;
      } else if (y < -tuning.maxVerticalSpeed) {
        y = -tuning.maxVerticalSpeed;
      }
      if (x !== v.x || y !== v.y || z !== v.z) {
        state.body.setLinvel({ x, y, z }, true);
      }
    }
  }

  /** Snap units to ground before combat; no ballistic warmup. */
  runCombatWarmup(units: CombatUnit[], _durationMs: number): void {
    for (const unit of units) {
      if (unit.hp <= 0) {
        continue;
      }
      this.setFieldPosition(unit, 0);
    }
  }

  allBodiesSleeping(): boolean {
    for (const state of this.bodies.values()) {
      if (state.body.isSleeping()) {
        continue;
      }
      const v = state.body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed > getCombatTuning().physics.settleSleepThreshold) {
        return false;
      }
    }
    return this.bodies.size > 0;
  }

  recordMoveEvent(
    playback: PlaybackEvent[],
    atMs: number,
    unit: CombatUnit,
    prevX: number,
    prevZ: number,
    prevHeight: number,
  ): void {
    const height = this.getWorldHeight(unit.unitId, atMs, unit.movementType);
    const moved =
      Math.abs(unit.x - prevX) > 0.0001 ||
      Math.abs(unit.y - prevZ) > 0.0001 ||
      Math.abs(height - prevHeight) > 0.001;
    if (!moved) {
      return;
    }
    const chargeTuning = getCombatTuning().movement.charge;
    const chargeSpan = chargeTuning.maxSpeedMultiplier - chargeTuning.minSpeedMultiplier;
    playback.push({
      atMs,
      kind: 'move',
      description: `${getUnitDisplayName(unit.unitType)} moves`,
      sourceUnitId: unit.unitId,
      x: unit.x,
      y: unit.y,
      height,
      movementType: unit.movementType,
      chargeSpeed:
        unit.movementType === 'charge' && chargeSpan > 0
          ? Math.min(
              1,
              (this.getChargeMultiplier(unit.unitId) - chargeTuning.minSpeedMultiplier) / chargeSpan,
            )
          : undefined,
    });
  }
}

export async function createPhysicsWorld(
  options?: PhysicsWorldOptions,
): Promise<PhysicsWorld> {
  const { initRapier } = await import('./init.js');
  await initRapier();
  return new PhysicsWorld(options);
}
