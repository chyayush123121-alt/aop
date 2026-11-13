import type {
  ActiveMissionState,
  CharacterPreset,
  EnemyPolicy,
  MissionDef,
  OutfitOption,
  SaveGameData,
  VehicleSpec,
  VehicleType,
} from './types';
import { groundHeightAt, isWaterAt, resolveCircleWorldCollisions } from './worldData';

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'vikram',
    name: 'Vikram Rathore',
    title: 'Street Sovereign',
    skinColor: '#c68b59',
    shirtColor: '#e63946',
    pantsColor: '#1d2d44',
    accentColor: '#ffb703',
    hairColor: '#18181b',
  },
  {
    id: 'aarav',
    name: 'Aarav Mehta',
    title: 'Drift Syndicate',
    skinColor: '#d49a6a',
    shirtColor: '#2a9d8f',
    pantsColor: '#264653',
    accentColor: '#f4a261',
    hairColor: '#27272a',
  },
  {
    id: 'tara',
    name: 'Tara Singh',
    title: 'Shadow Operative',
    skinColor: '#b97c4c',
    shirtColor: '#6d28d9',
    pantsColor: '#111827',
    accentColor: '#38bdf8',
    hairColor: '#0f172a',
  },
];

export const OUTFIT_OPTIONS: OutfitOption[] = [
  { id: 'crimson_jacket', name: 'Mumbai Crimson Jacket', shirtColor: '#e63946', pantsColor: '#1d2d44', accentColor: '#ffb703', price: 0 },
  { id: 'royal_kurta', name: 'Saffron Royal Kurta', shirtColor: '#f97316', pantsColor: '#f8fafc', accentColor: '#eab308', price: 450 },
  { id: 'neon_racer', name: 'BKC Neon Racer', shirtColor: '#0f172a', pantsColor: '#1e293b', accentColor: '#06b6d4', price: 900 },
  { id: 'tactical_gold', name: 'Kingpin Gold Suit', shirtColor: '#1c1917', pantsColor: '#292524', accentColor: '#f59e0b', price: 1500 },
];

export const VEHICLE_SPECS: Record<VehicleType, VehicleSpec> = {
  supercar: {
    type: 'supercar',
    label: 'Vajra GT Supercar',
    category: 'land',
    topSpeed: 46,
    accel: 26,
    brakeDecel: 34,
    turnRate: 2.3,
    maxHp: 220,
    mass: 1.3,
    seatHeight: 0.7,
    length: 4.5,
    width: 2.0,
    defaultColor: '#e63946',
    price: 0,
  },
  sports_car: {
    type: 'sports_car',
    label: 'Shakti Coupe',
    category: 'land',
    topSpeed: 39,
    accel: 22,
    brakeDecel: 30,
    turnRate: 2.4,
    maxHp: 200,
    mass: 1.2,
    seatHeight: 0.72,
    length: 4.3,
    width: 1.9,
    defaultColor: '#f59e0b',
    price: 0,
  },
  suv: {
    type: 'suv',
    label: 'Maharaja 4x4 SUV',
    category: 'land',
    topSpeed: 31,
    accel: 17,
    brakeDecel: 26,
    turnRate: 1.9,
    maxHp: 340,
    mass: 2.1,
    seatHeight: 1.05,
    length: 4.8,
    width: 2.1,
    defaultColor: '#1e293b',
    price: 0,
  },
  motorcycle: {
    type: 'motorcycle',
    label: 'Agni 1000R Superbike',
    category: 'land',
    topSpeed: 42,
    accel: 28,
    brakeDecel: 32,
    turnRate: 2.9,
    maxHp: 130,
    mass: 0.5,
    seatHeight: 0.8,
    length: 2.3,
    width: 0.85,
    defaultColor: '#dc2626',
    price: 0,
  },
  scooter: {
    type: 'scooter',
    label: 'Desi Glide Scooter',
    category: 'land',
    topSpeed: 24,
    accel: 16,
    brakeDecel: 24,
    turnRate: 3.1,
    maxHp: 110,
    mass: 0.35,
    seatHeight: 0.72,
    length: 1.9,
    width: 0.75,
    defaultColor: '#38bdf8',
    price: 0,
  },
  truck: {
    type: 'truck',
    label: 'Bharat Highway Truck',
    category: 'land',
    topSpeed: 25,
    accel: 11,
    brakeDecel: 20,
    turnRate: 1.35,
    maxHp: 520,
    mass: 4.2,
    seatHeight: 1.5,
    length: 6.4,
    width: 2.4,
    defaultColor: '#f97316',
    price: 0,
  },
  bus: {
    type: 'bus',
    label: 'BEST City Metro Bus',
    category: 'land',
    topSpeed: 23,
    accel: 10,
    brakeDecel: 19,
    turnRate: 1.25,
    maxHp: 560,
    mass: 4.8,
    seatHeight: 1.4,
    length: 7.2,
    width: 2.45,
    defaultColor: '#b91c1c',
    price: 0,
  },
  police_car: {
    type: 'police_car',
    label: 'City Police Interceptor',
    category: 'land',
    topSpeed: 41,
    accel: 24,
    brakeDecel: 32,
    turnRate: 2.35,
    maxHp: 280,
    mass: 1.6,
    seatHeight: 0.8,
    length: 4.5,
    width: 1.95,
    defaultColor: '#f8fafc',
    price: 0,
  },
  helicopter: {
    type: 'helicopter',
    label: 'Garuda Chopper',
    category: 'air',
    topSpeed: 38,
    accel: 18,
    brakeDecel: 16,
    turnRate: 1.9,
    maxHp: 380,
    mass: 2.4,
    seatHeight: 1.2,
    length: 6.2,
    width: 2.6,
    defaultColor: '#0f172a',
    price: 0,
  },
  boat: {
    type: 'boat',
    label: 'Konkan Speedboat',
    category: 'water',
    topSpeed: 34,
    accel: 18,
    brakeDecel: 14,
    turnRate: 2.1,
    maxHp: 260,
    mass: 1.5,
    seatHeight: 0.75,
    length: 5.2,
    width: 2.1,
    defaultColor: '#ffffff',
    price: 0,
  },
};

export const MISSION_LIST: MissionDef[] = [
  {
    id: 'story_crown',
    title: 'Crown of Nariman Point',
    type: 'story',
    description: 'Reclaim the stolen syndicate briefcase at the Sea-Link Pier and bring it back to King Garage.',
    district: 'downtown',
    rewardCash: 1500,
    rewardRespect: 250,
    startPos: { x: 12, z: -14 },
    targetPos: { x: 0, z: 160 },
    checkpoints: [
      { x: 0, z: 160 },
      { x: 82, z: 22 },
    ],
    enemyCount: 3,
  },
  {
    id: 'car_race_gp',
    title: 'Golden Quadrilateral GP',
    type: 'car_race',
    description: 'Blast through 4 high-speed highway and coastal checkpoints before the clock expires.',
    district: 'highway',
    rewardCash: 1800,
    rewardRespect: 300,
    startPos: { x: -160, z: 72 },
    targetPos: { x: 160, z: 72 },
    checkpoints: [
      { x: -140, z: 72 },
      { x: 140, z: 72 },
      { x: 95, z: -75 },
      { x: -95, z: -75 },
    ],
    requiredVehicle: 'supercar',
    timeLimitSec: 95,
  },
  {
    id: 'bike_race_village',
    title: 'Surya Gaon Moto Dash',
    type: 'bike_race',
    description: 'Race your superbike through the village curves and residential avenue.',
    district: 'village',
    rewardCash: 1200,
    rewardRespect: 220,
    startPos: { x: -95, z: -130 },
    targetPos: { x: -95, z: 120 },
    checkpoints: [
      { x: -175, z: -75 },
      { x: -175, z: 72 },
      { x: -95, z: 120 },
    ],
    requiredVehicle: 'motorcycle',
    timeLimitSec: 80,
  },
  {
    id: 'delivery_tiffin',
    title: 'Express Tiffin & Cargo Run',
    type: 'delivery',
    description: 'Deliver urgent supplies from Maharaja Mall to Surya Mandir in the village.',
    district: 'mall',
    rewardCash: 850,
    rewardRespect: 150,
    startPos: { x: 18, z: 10 },
    targetPos: { x: -135, z: -90 },
    checkpoints: [{ x: -135, z: -90 }],
    timeLimitSec: 75,
  },
  {
    id: 'rescue_ambulance',
    title: 'Apollo Emergency Rescue',
    type: 'rescue',
    description: 'Pick up an injured stunt driver at the Airfield Runway and race to Apollo Hospital.',
    district: 'hospital',
    rewardCash: 1400,
    rewardRespect: 260,
    startPos: { x: 150, z: 12 },
    targetPos: { x: 160, z: 138 },
    checkpoints: [
      { x: 160, z: 138 },
      { x: 150, z: 12 },
    ],
    timeLimitSec: 85,
  },
  {
    id: 'driving_stunt',
    title: 'Underground to Airfield Challenge',
    type: 'driving_challenge',
    description: 'Clear the underground parking exit and hit top speed down the Chhatrapati Airfield runway.',
    district: 'underground_parking',
    rewardCash: 1100,
    rewardRespect: 190,
    startPos: { x: -42, z: 22 },
    targetPos: { x: 210, z: 138 },
    checkpoints: [
      { x: 0, z: 72 },
      { x: 210, z: 138 },
    ],
    timeLimitSec: 70,
  },
  {
    id: 'gang_turf',
    title: 'Dockside Syndicate Takedown',
    type: 'gang_territory',
    description: 'Defeat the rival syndicate squad holding the coastal warehouse near Juhu Beach.',
    district: 'beach',
    rewardCash: 2000,
    rewardRespect: 380,
    startPos: { x: -65, z: 135 },
    targetPos: { x: -120, z: 142 },
    enemyCount: 5,
  },
  {
    id: 'side_chopper',
    title: 'Aravalli Sky Patrol',
    type: 'side',
    description: 'Take the Garuda Chopper from the Airfield and inspect the Aravalli Ridge peaks.',
    district: 'airport',
    rewardCash: 1600,
    rewardRespect: 280,
    startPos: { x: 135, z: 130 },
    targetPos: { x: 0, z: -195 },
    checkpoints: [
      { x: 0, z: -195 },
      { x: 135, z: 130 },
    ],
    requiredVehicle: 'helicopter',
    timeLimitSec: 110,
  },
];

export interface VehiclePhysicsState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  vy: number;
  steerAngle: number;
  hp: number;
}

export function stepVehiclePhysics(
  state: VehiclePhysicsState,
  spec: VehicleSpec,
  input: { throttle: number; steer: number; brake: boolean; liftUp?: boolean; liftDown?: boolean },
  dt: number
): VehiclePhysicsState {
  let { x, y, z, yaw, speed, vy, steerAngle, hp } = state;
  const clampedDt = Math.min(dt, 0.05);

  if (spec.category === 'air') {
    // Helicopter flight physics
    const targetSteer = -input.steer * spec.turnRate;
    yaw += targetSteer * clampedDt;

    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);

    if (input.throttle > 0) {
      speed += input.throttle * spec.accel * clampedDt;
    } else if (input.throttle < 0) {
      speed += input.throttle * spec.accel * 0.7 * clampedDt;
    } else {
      speed *= Math.exp(-1.8 * clampedDt);
    }
    speed = Math.max(-spec.topSpeed * 0.4, Math.min(spec.topSpeed, speed));

    if (input.liftUp) vy += 18 * clampedDt;
    else if (input.liftDown) vy -= 18 * clampedDt;
    else vy *= Math.exp(-3.5 * clampedDt);
    vy = Math.max(-14, Math.min(16, vy));

    x += fwdX * speed * clampedDt;
    z += fwdZ * speed * clampedDt;
    y += vy * clampedDt;

    const floorY = groundHeightAt(x, z);
    if (y < floorY) {
      y = floorY;
      vy = Math.max(0, vy);
    }
    if (y > 68) {
      y = 68;
      vy = Math.min(0, vy);
    }

    const col = resolveCircleWorldCollisions(x, z, spec.width * 0.7, y);
    x = col.x;
    z = col.z;
    if (col.collided) {
      speed *= 0.4;
    }

    return { x, y, z, yaw, speed, vy, steerAngle: -input.steer * 0.4, hp };
  }

  // Land & Boat vehicles
  if (input.brake) {
    const sign = speed >= 0 ? -1 : 1;
    const decel = spec.brakeDecel * clampedDt;
    if (Math.abs(speed) <= decel) speed = 0;
    else speed += sign * decel;
  } else if (Math.abs(input.throttle) > 0.01) {
    const accelRate = input.throttle > 0 ? spec.accel : spec.accel * 0.65;
    speed += input.throttle * accelRate * clampedDt;
  } else {
    speed *= Math.exp(-1.9 * clampedDt);
    if (Math.abs(speed) < 0.15) speed = 0;
  }

  const maxReverse = -spec.topSpeed * 0.35;
  speed = Math.max(maxReverse, Math.min(spec.topSpeed, speed));

  // Steering scales smoothly with speed (zero turn when stationary)
  const speedFactor = Math.min(1, Math.abs(speed) / 6);
  const reverseFlip = speed >= -0.2 ? 1 : -1;
  steerAngle = -input.steer * 0.55;
  yaw += -input.steer * spec.turnRate * speedFactor * reverseFlip * clampedDt;

  const nextX = x + Math.sin(yaw) * speed * clampedDt;
  const nextZ = z + Math.cos(yaw) * speed * clampedDt;

  if (spec.category === 'water') {
    // Boats must stay in water / near shore
    if (isWaterAt(nextX, nextZ) || nextZ > 158) {
      x = nextX;
      z = nextZ;
    } else {
      speed *= -0.25;
    }
    y = -0.3;
  } else {
    // Land vehicles slow in deep ocean water
    const col = resolveCircleWorldCollisions(nextX, nextZ, spec.width * 0.55, y);
    x = col.x;
    z = col.z;
    if (col.collided && Math.abs(speed) > 12) {
      hp = Math.max(10, hp - Math.abs(speed) * 0.45);
      speed *= 0.35;
    } else if (col.collided) {
      speed *= 0.5;
    }

    const groundY = groundHeightAt(x, z);
    if (isWaterAt(x, z)) {
      speed *= Math.exp(-4.5 * clampedDt);
    }
    if (y > groundY + 0.05) {
      vy -= 22 * clampedDt;
      y += vy * clampedDt;
      if (y <= groundY) {
        y = groundY;
        vy = 0;
      }
    } else {
      y = groundY;
      vy = 0;
    }
  }

  return { x, y, z, yaw, speed, vy, steerAngle, hp };
}

export interface WantedState {
  stars: number; // 0..5
  heat: number; // 0..500
  cooldownTimer: number; // seconds until decay starts
}

export function registerCrime(state: WantedState, severity: number): WantedState {
  const heat = Math.min(500, state.heat + severity);
  const stars = Math.min(5, Math.max(state.stars, Math.ceil(heat / 90)));
  return {
    stars,
    heat,
    cooldownTimer: 16,
  };
}

export function updateWantedState(
  state: WantedState,
  isVisibleToPolice: boolean,
  dt: number
): WantedState {
  if (state.stars === 0) return state;

  if (isVisibleToPolice) {
    return {
      ...state,
      cooldownTimer: Math.max(state.cooldownTimer, 10),
    };
  }

  const nextCooldown = Math.max(0, state.cooldownTimer - dt);
  if (nextCooldown > 0) {
    return { ...state, cooldownTimer: nextCooldown };
  }

  const nextHeat = Math.max(0, state.heat - 32 * dt);
  const nextStars = nextHeat <= 1 ? 0 : Math.min(5, Math.ceil(nextHeat / 90));
  return {
    stars: nextStars,
    heat: nextHeat,
    cooldownTimer: 0,
  };
}

export interface EnemySimActor {
  id: string;
  policy: EnemyPolicy;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  state: 'idle' | 'approach' | 'windup' | 'attack' | 'recover' | 'ko';
  stateTimer: number;
  strafeDir: number;
  hasAttackToken: boolean;
}

export function stepEnemyPolicy(
  enemy: EnemySimActor,
  playerX: number,
  playerZ: number,
  dt: number,
  activeTokens: number,
  maxTokens: number
): { enemy: EnemySimActor; dealtDamage: number; firedProjectile: boolean } {
  let dealtDamage = 0;
  let firedProjectile = false;
  const e = { ...enemy };

  if (e.state === 'ko') {
    e.stateTimer -= dt;
    return { enemy: e, dealtDamage: 0, firedProjectile: false };
  }

  if (e.hp <= 0) {
    e.state = 'ko';
    e.stateTimer = 0.45;
    e.hasAttackToken = false;
    return { enemy: e, dealtDamage: 0, firedProjectile: false };
  }

  const dx = playerX - e.x;
  const dz = playerZ - e.z;
  const dist = Math.hypot(dx, dz);
  const dirX = dist > 0.001 ? dx / dist : 0;
  const dirZ = dist > 0.001 ? dz / dist : 1;
  e.yaw = Math.atan2(dirX, dirZ);

  if (e.state === 'windup') {
    e.stateTimer -= dt;
    if (e.stateTimer <= 0) {
      e.state = 'attack';
      e.stateTimer = e.policy === 'charger' ? 0.35 : 0.15;
    }
    return { enemy: e, dealtDamage: 0, firedProjectile: false };
  }

  if (e.state === 'attack') {
    e.stateTimer -= dt;
    if (e.policy === 'charger') {
      // Dash forward aggressively
      const nx = e.x + dirX * 14 * dt;
      const nz = e.z + dirZ * 14 * dt;
      const col = resolveCircleWorldCollisions(nx, nz, 0.5, 0);
      e.x = col.x;
      e.z = col.z;
      if (dist < 2.2) {
        dealtDamage = 18;
        e.state = 'recover';
        e.stateTimer = 0.9;
        e.hasAttackToken = false;
      }
    } else if (e.policy === 'ranged') {
      firedProjectile = true;
      e.state = 'recover';
      e.stateTimer = 1.1;
      e.hasAttackToken = false;
    } else {
      // Chaser melee hit
      if (dist < 2.4) dealtDamage = 12;
      e.state = 'recover';
      e.stateTimer = 0.75;
      e.hasAttackToken = false;
    }

    if (e.stateTimer <= 0 && e.state === 'attack') {
      e.state = 'recover';
      e.stateTimer = 0.75;
      e.hasAttackToken = false;
    }
    return { enemy: e, dealtDamage, firedProjectile };
  }

  if (e.state === 'recover') {
    e.stateTimer -= dt;
    if (e.stateTimer <= 0) {
      e.state = 'approach';
    }
    return { enemy: e, dealtDamage: 0, firedProjectile: false };
  }

  // Movement policies when approaching/engaging
  if (dist > 45) {
    e.state = 'idle';
    return { enemy: e, dealtDamage: 0, firedProjectile: false };
  }

  e.state = 'approach';
  const speed = e.policy === 'chaser' ? 5.8 : e.policy === 'charger' ? 4.4 : 3.8;

  if (e.policy === 'ranged') {
    // Kiter/Ranged maintains 10-16m spacing and strafes laterally
    let moveX = 0;
    let moveZ = 0;
    if (dist > 16) {
      moveX = dirX * speed;
      moveZ = dirZ * speed;
    } else if (dist < 9) {
      moveX = -dirX * speed * 0.85;
      moveZ = -dirZ * speed * 0.85;
    } else {
      // Strafe perpendicular
      moveX = -dirZ * e.strafeDir * speed * 0.7;
      moveZ = dirX * e.strafeDir * speed * 0.7;
    }
    const col = resolveCircleWorldCollisions(e.x + moveX * dt, e.z + moveZ * dt, 0.45, 0);
    e.x = col.x;
    e.z = col.z;

    if (dist <= 20 && activeTokens < maxTokens) {
      e.hasAttackToken = true;
      e.state = 'windup';
      e.stateTimer = 0.45;
    }
  } else if (e.policy === 'charger') {
    // Line-of-sight heavy charger closes to 8-10m then telegraphs a charge
    const col = resolveCircleWorldCollisions(e.x + dirX * speed * dt, e.z + dirZ * speed * dt, 0.5, 0);
    e.x = col.x;
    e.z = col.z;

    if (dist <= 10 && dist >= 3 && activeTokens < maxTokens) {
      e.hasAttackToken = true;
      e.state = 'windup';
      e.stateTimer = 0.6;
    } else if (dist < 2.2 && activeTokens < maxTokens) {
      e.hasAttackToken = true;
      e.state = 'windup';
      e.stateTimer = 0.35;
    }
  } else {
    // Chaser: closes directly to melee range
    if (dist > 1.8) {
      const col = resolveCircleWorldCollisions(e.x + dirX * speed * dt, e.z + dirZ * speed * dt, 0.45, 0);
      e.x = col.x;
      e.z = col.z;
    }
    if (dist <= 2.3 && activeTokens < maxTokens) {
      e.hasAttackToken = true;
      e.state = 'windup';
      e.stateTimer = 0.32;
    }
  }

  return { enemy: e, dealtDamage: 0, firedProjectile: false };
}

export function createActiveMission(def: MissionDef): ActiveMissionState {
  const waypoints = def.checkpoints && def.checkpoints.length > 0 ? def.checkpoints : [def.targetPos];
  const first = waypoints[0];
  return {
    def,
    stepIndex: 0,
    totalSteps: def.enemyCount ? 1 : waypoints.length,
    timeRemaining: def.timeLimitSec ?? 0,
    enemiesRemaining: def.enemyCount ?? 0,
    objectiveText:
      def.enemyCount && def.enemyCount > 0
        ? `${def.title}: Neutralize ${def.enemyCount} hostiles`
        : `${def.title}: Reach waypoint (1/${waypoints.length})`,
    waypoint: { x: first.x, y: groundHeightAt(first.x, first.z) + 1.5, z: first.z },
  };
}

export function advanceMissionWaypoint(mission: ActiveMissionState): {
  completed: boolean;
  next: ActiveMissionState;
} {
  const waypoints =
    mission.def.checkpoints && mission.def.checkpoints.length > 0
      ? mission.def.checkpoints
      : [mission.def.targetPos];
  const nextStep = mission.stepIndex + 1;
  if (nextStep >= waypoints.length && mission.enemiesRemaining <= 0) {
    return { completed: true, next: mission };
  }
  const idx = Math.min(nextStep, waypoints.length - 1);
  const wp = waypoints[idx];
  return {
    completed: false,
    next: {
      ...mission,
      stepIndex: nextStep,
      objectiveText: `${mission.def.title}: Reach waypoint (${nextStep + 1}/${waypoints.length})`,
      waypoint: { x: wp.x, y: groundHeightAt(wp.x, wp.z) + 1.5, z: wp.z },
    },
  };
}

export const SAVE_STORAGE_KEY = 'indian_city_king_save_v1';

export function createDefaultSaveData(): SaveGameData {
  return {
    version: 1,
    characterId: 'vikram',
    outfitId: 'crimson_jacket',
    cash: 1200,
    respect: 100,
    completedMissionIds: [],
    unlockedOutfits: ['crimson_jacket'],
    customVehicleColors: {},
    selectedGarageVehicle: 'supercar',
    playerPos: { x: 8, y: 0, z: 6 },
    kills: 0,
  };
}
