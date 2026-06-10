export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Simulation loop, movement, playback visuals, and playground tweaks. */
export interface CombatTuningConfig {
  simulation: {
    /** Ms per damage/healing tick in combat. */
    tickMs: number;
    /** Ms between movement simulation steps. */
    stepMs: number;
    /** Max sim ticks before force-ending a round. */
    maxTickCount: number;
  };
  movement: {
    /** Ally separation push strength while advancing. */
    allySeparationStrength: number;
    /** Separation strength while holding at attack range. */
    holdSeparationStrength: number;
    /** Stop advancing within attackRange * this factor. */
    attackHoldRangeFactor: number;
    /** Y weight when closing on an enemy. */
    advanceTowardEnemyYWeight: number;
    /** X weight when closing on an enemy. */
    advanceTowardEnemyXWeight: number;
    /** Y advance scale when no enemy target. */
    defaultAdvanceScale: number;
    /** Divisor converting unit speed stat to step distance. */
    baseSpeedDivisor: number;
    hop: {
      /** Ms between hop advances in sim. */
      intervalMs: number;
      /** Multiplier on base step distance per hop. */
      distanceScale: number;
    };
    float: {
      /** Sine bob period for float units (sim + playback). */
      periodMs: number;
      /** Vertical bob amplitude (field coords). */
      amplitude: number;
    };
    charge: {
      minSpeedMultiplier: number;
      maxSpeedMultiplier: number;
      /** Ms to ramp from min to max while moving toward enemy. */
      rampDurationMs: number;
      /** Decay rate multiplier when not advancing. */
      decayMultiplier: number;
      /** Min charge ratio (of max) required for charge impact. */
      impactThreshold: number;
      /** Damage multiplier on charge impact hits. */
      impactDamageScale: number;
    };
  };
  playback: {
    /** Default flash duration for line attacks. */
    attackLineFlashMs: number;
    hop: {
      /** Vertical arc height during hop playback. */
      visualHeight: number;
      /** Fraction of hop segment spent on ground at start/end. */
      landFraction: number;
    };
    charge: {
      /** Extra icon scale at full charge (added to 1). */
      iconSpeedScale: number;
    };
  };
  playground: {
    /** Idle ms before playground march loop. */
    marchIdleMs: number;
    marchHopIntervalMs: number;
    marchHopDistanceScale: number;
  };
  physics: {
    gravity: number;
    fieldScale: number;
    substepSec: number;
    groundRestitution: number;
    groundFriction: number;
    unitFriction: number;
    unitRestitution: number;
    unitDensity: number;
    linearDamping: number;
    wallHeight: number;
    wallThickness: number;
    spawnLift: number;
    settleMaxMs: number;
    settleSleepThreshold: number;
    playbackSampleMs: number;
    slotSpring: number;
    /** Horizontal acceleration toward enemies (m/s²), scaled by body mass. */
    advanceAccel: number;
    hopImpulseUp: number;
    hopImpulseForward: number;
    chargeForceMax: number;
    chargeSpeedForMaxVisual: number;
    floatBuoyancy: number;
    cameraPitchDeg: number;
    /** Max horizontal speed in m/s. */
    maxLinearSpeed: number;
    /** Max horizontal drive speed during combat pushing (m/s). */
    combatPushSpeed: number;
    /** Blend toward drive velocity each step (0–1); lower preserves collision shove. */
    driveBlend: number;
    /** Drive blend while ranged units hold fire (easier to push). */
    rangedHoldDriveBlend: number;
    /** Melee advance scale while in attack range (field step fraction). */
    meleeAttackPushScale: number;
    /** Relative mass for melee sphere bodies. */
    meleeMassScale: number;
    /** Relative mass for ranged sphere bodies (lighter = pushed easier). */
    rangedMassScale: number;
    /** Sphere-on-sphere friction during combat (lower = slide off). */
    combatUnitFriction: number;
    /** Sphere restitution during combat (higher = roll off contacts). */
    combatUnitRestitution: number;
    /** Max vertical speed in m/s. */
    maxVerticalSpeed: number;
    /** Ms of gravity-only settle before combat forces at fight start. */
    combatWarmupMs: number;
    /** Extra inset (m) from field edge when placing boundary walls. */
    wallInsetPadding: number;
  };
}

export const DEFAULT_COMBAT_TUNING: CombatTuningConfig = {
  simulation: {
    tickMs: 50,
    stepMs: 250,
    maxTickCount: 1800,
  },
  movement: {
    allySeparationStrength: 1.15,
    holdSeparationStrength: 0.85,
    attackHoldRangeFactor: 0.92,
    advanceTowardEnemyYWeight: 0.75,
    advanceTowardEnemyXWeight: 0.35,
    defaultAdvanceScale: 0.5,
    baseSpeedDivisor: 5000,
    hop: {
      intervalMs: 450,
      distanceScale: 3.6,
    },
    float: {
      periodMs: 2600,
      amplitude: 0.011,
    },
    charge: {
      minSpeedMultiplier: 0.3,
      maxSpeedMultiplier: 2.85,
      rampDurationMs: 1600,
      decayMultiplier: 2,
      impactThreshold: 0.88,
      impactDamageScale: 1.2,
    },
  },
  playback: {
    attackLineFlashMs: 120,
    hop: {
      visualHeight: 0.052,
      landFraction: 0.12,
    },
    charge: {
      iconSpeedScale: 0.12,
    },
  },
  playground: {
    marchIdleMs: 3000,
    marchHopIntervalMs: 720,
    marchHopDistanceScale: 1.85,
  },
  physics: {
    gravity: 4.5,
    fieldScale: 100,
    substepSec: 1 / 60,
    groundRestitution: 0.02,
    groundFriction: 1.2,
    unitFriction: 0.85,
    unitRestitution: 0.04,
    unitDensity: 0.35,
    linearDamping: 1.05,
    wallHeight: 2,
    wallThickness: 0.35,
    spawnLift: 0.015,
    settleMaxMs: 2000,
    settleSleepThreshold: 0.08,
    playbackSampleMs: 50,
    slotSpring: 2.5,
    advanceAccel: 0.55,
    hopImpulseUp: 0.35,
    hopImpulseForward: 0.25,
    chargeForceMax: 1.8,
    chargeSpeedForMaxVisual: 1.2,
    floatBuoyancy: 3.8,
    cameraPitchDeg: 20,
    maxLinearSpeed: 0.85,
    combatPushSpeed: 0.42,
    driveBlend: 0.36,
    rangedHoldDriveBlend: 0.1,
    meleeAttackPushScale: 0.5,
    meleeMassScale: 1.05,
    rangedMassScale: 0.68,
    combatUnitFriction: 0.28,
    combatUnitRestitution: 0.2,
    maxVerticalSpeed: 0.9,
    combatWarmupMs: 600,
    wallInsetPadding: 0.15,
  },
};

let activeTuning: CombatTuningConfig = structuredClone(DEFAULT_COMBAT_TUNING);

function deepMerge<T extends object>(base: T, overrides: DeepPartial<T>): T {
  const result = { ...base } as T;
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const overrideValue = overrides[key];
    if (overrideValue === undefined) {
      continue;
    }
    const baseValue = base[key];
    if (
      baseValue !== null &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue) &&
      overrideValue !== null &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue)
    ) {
      result[key] = deepMerge(baseValue, overrideValue as DeepPartial<typeof baseValue>);
    } else {
      result[key] = overrideValue as T[typeof key];
    }
  }
  return result;
}

export function getCombatTuning(): Readonly<CombatTuningConfig> {
  return activeTuning;
}

export function loadCombatTuning(
  overrides: DeepPartial<CombatTuningConfig> = {},
): CombatTuningConfig {
  activeTuning = deepMerge(structuredClone(DEFAULT_COMBAT_TUNING), overrides);
  return activeTuning;
}

export function simTickMs(tuning: Readonly<CombatTuningConfig> = getCombatTuning()): number {
  return tuning.simulation.tickMs;
}

export function simStepMs(tuning: Readonly<CombatTuningConfig> = getCombatTuning()): number {
  return tuning.simulation.stepMs;
}

export function maxSimMs(tuning: Readonly<CombatTuningConfig> = getCombatTuning()): number {
  return tuning.simulation.tickMs * tuning.simulation.maxTickCount;
}

export function maxSimTicks(tuning: Readonly<CombatTuningConfig> = getCombatTuning()): number {
  return Math.ceil(maxSimMs(tuning) / tuning.simulation.stepMs);
}

export function chargeRampPerMs(tuning: Readonly<CombatTuningConfig> = getCombatTuning()): number {
  const charge = tuning.movement.charge;
  return (charge.maxSpeedMultiplier - charge.minSpeedMultiplier) / charge.rampDurationMs;
}

export function chargeSpeedRatio(
  multiplier: number,
  tuning: Readonly<CombatTuningConfig> = getCombatTuning(),
): number {
  const charge = tuning.movement.charge;
  return Math.max(
    0,
    Math.min(
      1,
      (multiplier - charge.minSpeedMultiplier) /
        (charge.maxSpeedMultiplier - charge.minSpeedMultiplier),
    ),
  );
}

export function floatVisualOffset(
  atMs: number,
  tuning: Readonly<CombatTuningConfig> = getCombatTuning(),
): number {
  const { periodMs, amplitude } = tuning.movement.float;
  return amplitude * Math.sin((atMs / periodMs) * Math.PI * 2);
}
