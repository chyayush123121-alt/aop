import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceMissionWaypoint,
  createActiveMission,
  MISSION_LIST,
  registerCrime,
  stepEnemyPolicy,
  stepVehiclePhysics,
  updateWantedState,
  VEHICLE_SPECS,
  type EnemySimActor,
} from './simulation';
import { getDistrictAt, groundHeightAt, isWaterAt, resolveCircleWorldCollisions } from './worldData';

test('world terrain, water, and districts classify accurately', () => {
  assert.equal(getDistrictAt(0, -80).id, 'downtown');
  assert.equal(getDistrictAt(-140, -100).id, 'village');
  assert.equal(getDistrictAt(0, 72).id, 'highway');
  assert.equal(getDistrictAt(0, 210).id, 'ocean');

  // Mountain elevation rises northward past z = -170
  assert.equal(groundHeightAt(0, 0), 0);
  assert.ok(groundHeightAt(0, -210) > 5);

  // Bridge deck stays dry over water, off-bridge ocean is water
  assert.equal(isWaterAt(0, 175), false);
  assert.equal(isWaterAt(40, 190), true);
  assert.ok(groundHeightAt(0, 140) > 3);
});

test('building collision prevents player from walking inside skyscrapers', () => {
  const res = resolveCircleWorldCollisions(-40, -115, 0.5, 0);
  assert.equal(res.collided, true);
  assert.ok(res.x <= -58 || res.x >= -28 || res.z <= -135 || res.z >= -100);
});

test('vehicle physics handles supercar acceleration, helicopter lift, and boat water constraint', () => {
  const carSpec = VEHICLE_SPECS.supercar;
  let car = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, vy: 0, steerAngle: 0, hp: carSpec.maxHp };
  for (let i = 0; i < 40; i++) {
    car = stepVehiclePhysics(car, carSpec, { throttle: 1, steer: 0, brake: false }, 0.05);
  }
  assert.ok(car.speed > 20, 'supercar should accelerate smoothly');
  assert.ok(car.z > 15, 'supercar should travel forward along +Z');

  const heliSpec = VEHICLE_SPECS.helicopter;
  let heli = { x: 135, y: 0, z: 120, yaw: 0, speed: 0, vy: 0, steerAngle: 0, hp: heliSpec.maxHp };
  for (let i = 0; i < 20; i++) {
    heli = stepVehiclePhysics(heli, heliSpec, { throttle: 0.5, steer: 0, brake: false, liftUp: true }, 0.05);
  }
  assert.ok(heli.y > 4, 'helicopter should gain altitude when liftUp is held');

  const boatSpec = VEHICLE_SPECS.boat;
  let boat = { x: -30, y: -0.3, z: 185, yaw: Math.PI, speed: 12, vy: 0, steerAngle: 0, hp: boatSpec.maxHp };
  // Moving north onto dry beach should clamp/bounce boat back
  for (let i = 0; i < 40; i++) {
    boat = stepVehiclePhysics(boat, boatSpec, { throttle: 1, steer: 0, brake: false }, 0.05);
  }
  assert.ok(boat.z >= 157, 'boat cannot drive onto inland roads');
});

test('wanted system escalates on crimes and decays when out of police sight', () => {
  let wanted = { stars: 0, heat: 0, cooldownTimer: 0 };
  wanted = registerCrime(wanted, 100);
  assert.equal(wanted.stars, 2);

  wanted = registerCrime(wanted, 250);
  assert.equal(wanted.stars, 4);

  // While visible, stars never drop
  for (let i = 0; i < 20; i++) {
    wanted = updateWantedState(wanted, true, 1);
  }
  assert.equal(wanted.stars, 4);

  // Out of sight, cooldown expires and stars decay to 0
  for (let i = 0; i < 35; i++) {
    wanted = updateWantedState(wanted, false, 1);
  }
  assert.equal(wanted.stars, 0);
});

test('three distinct enemy AI policies behave differently and respect attack token limits', () => {
  const chaser: EnemySimActor = {
    id: 'e1',
    policy: 'chaser',
    x: 0,
    z: 10,
    yaw: 0,
    hp: 50,
    maxHp: 50,
    state: 'approach',
    stateTimer: 0,
    strafeDir: 1,
    hasAttackToken: false,
  };
  const ranged: EnemySimActor = {
    ...chaser,
    id: 'e2',
    policy: 'ranged',
    x: 0,
    z: 12,
  };
  const charger: EnemySimActor = {
    ...chaser,
    id: 'e3',
    policy: 'charger',
    x: 0,
    z: 8,
  };

  const cStep = stepEnemyPolicy(chaser, 0, 0, 0.05, 0, 2);
  assert.ok(cStep.enemy.z < chaser.z, 'chaser closes distance');

  const rStep = stepEnemyPolicy(ranged, 0, 0, 0.05, 0, 2);
  assert.equal(rStep.enemy.state, 'windup', 'ranged enemy starts windup from distance');

  // Token cap blocks new windups when activeTokens >= maxTokens
  const blockedCharger = stepEnemyPolicy(charger, 0, 0, 0.05, 2, 2);
  assert.equal(blockedCharger.enemy.state, 'approach', 'charger waits when attack token pool is full');
});

test('mission checkpoints progress cleanly to completion', () => {
  const race = MISSION_LIST[1]; // 4 checkpoints, 0 enemies
  let active = createActiveMission(race);
  assert.equal(active.stepIndex, 0);
  for (let i = 0; i < 3; i++) {
    const res = advanceMissionWaypoint(active);
    assert.equal(res.completed, false);
    active = res.next;
  }
  const finalStep = advanceMissionWaypoint(active);
  assert.equal(finalStep.completed, true);

  // Story mission with enemies requires enemies cleared as well
  const story = MISSION_LIST[0];
  let sActive = createActiveMission(story);
  sActive = advanceMissionWaypoint(sActive).next;
  const blockedByEnemies = advanceMissionWaypoint(sActive);
  assert.equal(blockedByEnemies.completed, false);
  sActive.enemiesRemaining = 0;
  const cleared = advanceMissionWaypoint(sActive);
  assert.equal(cleared.completed, true);
});
