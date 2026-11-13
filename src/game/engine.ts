import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameAudio } from './audio';
import { buildCityEnvironment, type CityEnvironmentRefs } from './cityBuilder';
import { buildHumanModel, buildVehicleModel, type HumanRig, type VehicleRig } from './models';
import {
  advanceMissionWaypoint,
  CHARACTER_PRESETS,
  createActiveMission,
  MISSION_LIST,
  OUTFIT_OPTIONS,
  registerCrime,
  stepEnemyPolicy,
  stepVehiclePhysics,
  updateWantedState,
  VEHICLE_SPECS,
  type EnemySimActor,
  type VehiclePhysicsState,
  type WantedState,
} from './simulation';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import type {
  ActiveMissionState,
  GameSettings,
  GameStateMode,
  HudSnapshot,
  InputState,
  MissionDef,
  SaveGameData,
  VehicleType,
  WeaponId,
} from './types';
import {
  DISTRICT_ZONES,
  getDistrictAt,
  groundHeightAt,
  INTERACTABLE_SPOTS,
  isWaterAt,
  resolveCircleWorldCollisions,
  ROAD_SEGMENTS,
} from './worldData';

// Pre-allocated scratch math helpers (Zero-GC loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _dummy = new THREE.Object3D();

interface WorldVehicle {
  id: string;
  type: VehicleType;
  color: string;
  rig: VehicleRig;
  phys: VehiclePhysicsState;
  isTraffic: boolean;
  isPolice: boolean;
  trafficDir: 1 | -1;
  trafficAxis: 'x' | 'z';
  trafficLaneCoord: number;
}

interface WorldPedestrian {
  id: string;
  rig: HumanRig;
  x: number;
  z: number;
  yaw: number;
  walkPhase: number;
  speed: number;
  fleeTimer: number;
  isPolice: boolean;
  hp: number;
  koTimer: number;
}

interface WorldEnemy {
  sim: EnemySimActor;
  rig: HumanRig;
  telegraphRing: THREE.Mesh;
  hitFlashTimer: number;
}

interface Projectile {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  fromPlayer: boolean;
  mesh: THREE.Mesh;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onOpenModal: (modal: 'garage' | 'wardrobe' | 'missions') => void;
  onGameOver: (reason: 'wasted' | 'busted' | 'victory', hud: HudSnapshot) => void;
}

export class OpenWorldEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private textures: ProceduralTextureSet;
  private cityRefs: CityEnvironmentRefs;
  public audio = new GameAudio();

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private hudEmitAccum = 0;
  private mode: GameStateMode = 'title';
  private titleFlyAngle = 0;

  // Player State
  private playerRig: HumanRig;
  private playerPos = new THREE.Vector3(8, 0, -4);
  private playerVelY = 0;
  private playerYaw = Math.PI; // Facing north toward downtown skyline vista
  private playerWalkDist = 0;
  private playerOnGround = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private attackCooldown = 0;
  private attackAnimTimer = 0;
  private playerScaleY = 1;
  private playerScaleXZ = 1;
  private hp = 100;
  private maxHp = 100;
  private armor = 50;
  private maxArmor = 100;
  private cash = 1200;
  private respect = 100;
  private kills = 0;
  private weapon: WeaponId = 'fists';
  private ammo = 60;
  private characterId = 'vikram';
  private outfitId = 'crimson_jacket';
  private unlockedOutfits: string[] = ['crimson_jacket'];
  private customVehicleColors: Partial<Record<VehicleType, string>> = {};
  private selectedGarageVehicle: VehicleType = 'supercar';
  private completedMissionIds: string[] = [];

  // Camera & Feel
  private camYaw = 0; // Camera sits +Z behind north-facing (playerYaw=PI) character
  private camPitch = 0.26;
  private camDist = 7.4;
  private trauma = 0;
  private hitstopTimer = 0;
  private footstepAccum = 0;
  private toastText: string | null = null;
  private toastTimer = 0;

  // Entities & Pools
  private vehicles: WorldVehicle[] = [];
  private currentVehicle: WorldVehicle | null = null;
  private peds: WorldPedestrian[] = [];
  private enemies: WorldEnemy[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private particleInst: THREE.InstancedMesh;
  private rainInst: THREE.InstancedMesh;
  private rainDrops: Array<{ x: number; y: number; z: number; speed: number }> = [];
  private lightningTimer = 6;
  private lightningFlash = 0;

  // Police & Missions
  private wanted: WantedState = { stars: 0, heat: 0, cooldownTimer: 0 };
  private policeChopper: WorldVehicle | null = null;
  private activeMission: ActiveMissionState | null = null;
  private waypointBeam: THREE.Group;

  // Settings & Input
  private settings: GameSettings = {
    graphics: 'medium',
    weather: 'clear',
    timeOfDayHours: 16.5, // Golden late afternoon
    autoCycleTime: true,
    touchControls: false,
    muted: false,
  };

  private keys = new Set<string>();
  private pointerLocked = false;
  private touchInput: InputState = {
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    sprint: false,
    jumpJustPressed: false,
    attackJustPressed: false,
    attackHeld: false,
    interactJustPressed: false,
    brakeHeld: false,
    weaponSelect: null,
  };
  private keyJumpQueued = false;
  private keyAttackQueued = false;
  private keyInteractQueued = false;
  private mouseDown = false;
  private isDraggingCamera = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Detect Software WebGL
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // 2. Scene, Camera & Studio Environment Reflection
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#8ecae6');
    this.scene.fog = new THREE.FogExp2('#8ecae6', 0.0028);

    this.camera = new THREE.PerspectiveCamera(
      62,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.2,
      580
    );

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 3. Warm/Cool 3-Point Outdoor Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x57534e, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    this.sunLight.position.set(80, 120, 60);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const d = 75;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 260;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // 4. Textures & City Environment
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.cityRefs = buildCityEnvironment(this.scene, this.textures);

    // 5. Player Rig
    const preset = CHARACTER_PRESETS[0];
    this.playerRig = buildHumanModel({
      ...preset,
      contactShadowTex: this.textures.contactShadowTex,
      withWeapons: true,
    });
    this.playerRig.group.position.copy(this.playerPos);
    this.playerRig.group.rotation.y = this.playerYaw;
    this.scene.add(this.playerRig.group);

    // 6. Pooled Particle InstancedMesh (Zero-GC)
    const maxParticles = 140;
    this.particleInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      maxParticles
    );
    this.particleInst.frustumCulled = false;
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0, y: -999, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 1,
        color: new THREE.Color(0xfbbf24),
      });
      _dummy.position.set(0, -999, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleInst.setMatrixAt(i, _dummy.matrix);
      this.particleInst.setColorAt(i, this.particles[i].color);
    }
    this.scene.add(this.particleInst);

    // 7. Pooled Rain Streaks InstancedMesh
    const rainCount = 260;
    this.rainInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.03, 1.35, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.55 }),
      rainCount
    );
    this.rainInst.frustumCulled = false;
    this.rainInst.visible = false;
    for (let i = 0; i < rainCount; i++) {
      this.rainDrops.push({
        x: (Math.random() - 0.5) * 70,
        y: Math.random() * 35,
        z: (Math.random() - 0.5) * 70,
        speed: 28 + Math.random() * 12,
      });
    }
    this.scene.add(this.rainInst);

    // 8. Projectile Pool
    const projGeo = new THREE.SphereGeometry(0.16, 8, 8);
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const mesh = new THREE.Mesh(projGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({
        active: false,
        x: 0, y: -99, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0,
        fromPlayer: true,
        mesh,
      });
    }

    // 9. Mission Waypoint Beacon
    this.waypointBeam = new THREE.Group();
    const beamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 45, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    beamMesh.position.y = 22.5;
    const beamRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.2, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 1.8 })
    );
    beamRing.rotation.x = Math.PI / 2;
    beamRing.position.y = 0.3;
    this.waypointBeam.add(beamMesh, beamRing);
    this.waypointBeam.visible = false;
    this.scene.add(this.waypointBeam);

    // 10. Spawn Initial Vehicles, Traffic, Pedestrians & Patrol Police
    this.spawnInitialWorldActors();

    // 11. Pre-warm shaders on GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 12. Bind Window & Canvas Listeners
    this.bindEvents();
    this.applyLightingAndAtmosphere();

    // 13. Start Loop
    this.lastTime = performance.now();
    this.scheduleNextTick();
  }

  private spawnInitialWorldActors(): void {
    // Parked Signature Vehicles right near player spawn + across city landmarks
    const parkedSpecs: Array<{ type: VehicleType; x: number; z: number; yaw: number; police?: boolean }> = [
      { type: 'supercar', x: 13, z: -10, yaw: Math.PI },
      { type: 'scooter', x: -7, z: 4, yaw: Math.PI },
      { type: 'motorcycle', x: 75, z: 16, yaw: -Math.PI / 2 },
      { type: 'sports_car', x: 35, z: -8, yaw: Math.PI / 2 },
      { type: 'suv', x: -110, z: 4, yaw: 0 },
      { type: 'truck', x: -45, z: 65, yaw: Math.PI / 2 },
      { type: 'bus', x: 25, z: 65, yaw: -Math.PI / 2 },
      { type: 'police_car', x: 105, z: -85, yaw: -Math.PI / 2, police: true },
      { type: 'police_car', x: 105, z: -105, yaw: -Math.PI / 2, police: true },
      { type: 'helicopter', x: 135, z: 128, yaw: 0 },
      { type: 'boat', x: -24, z: 184, yaw: Math.PI / 2 },
      { type: 'supercar', x: -42, z: 32, yaw: 0 }, // Underground parking car!
    ];

    parkedSpecs.forEach((p, idx) => {
      this.createVehicle(`veh_${idx}`, p.type, p.x, p.z, p.yaw, false, !!p.police);
    });

    // Roaming Traffic Vehicles
    const trafficSpecs: Array<{ type: VehicleType; axis: 'x' | 'z'; lane: number; pos: number; dir: 1 | -1 }> = [
      { type: 'sports_car', axis: 'z', lane: 4, pos: -120, dir: 1 },
      { type: 'suv', axis: 'z', lane: -4, pos: 50, dir: -1 },
      { type: 'bus', axis: 'x', lane: 76, pos: -130, dir: 1 },
      { type: 'truck', axis: 'x', lane: 68, pos: 140, dir: -1 },
      { type: 'scooter', axis: 'x', lane: -4, pos: -70, dir: 1 },
      { type: 'police_car', axis: 'z', lane: 99, pos: -50, dir: 1 },
    ];
    trafficSpecs.forEach((t, idx) => {
      const x = t.axis === 'z' ? t.lane : t.pos;
      const z = t.axis === 'z' ? t.pos : t.lane;
      const yaw = t.axis === 'z' ? (t.dir === 1 ? 0 : Math.PI) : t.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      const v = this.createVehicle(`traffic_${idx}`, t.type, x, z, yaw, true, t.type === 'police_car');
      v.trafficAxis = t.axis;
      v.trafficLaneCoord = t.lane;
      v.trafficDir = t.dir;
    });

    // Ambient Pedestrians & Beat Police
    const pedColors = ['#f59e0b', '#10b981', '#ec4899', '#6366f1', '#f97316', '#14b8a6'];
    for (let i = 0; i < 18; i++) {
      const isPolice = i >= 15;
      const road = ROAD_SEGMENTS[i % 6];
      const t = ((i * 37) % 100) / 100;
      const x = road.x1 + (road.x2 - road.x1) * t + (i % 2 === 0 ? 7 : -7);
      const z = road.z1 + (road.z2 - road.z1) * t;
      const rig = buildHumanModel({
        skinColor: i % 2 === 0 ? '#c68b59' : '#a86f42',
        shirtColor: isPolice ? '#1e3a8a' : pedColors[i % pedColors.length],
        pantsColor: isPolice ? '#1e293b' : '#334155',
        accentColor: isPolice ? '#facc15' : '#cbd5e1',
        hairColor: '#18181b',
        contactShadowTex: this.textures.contactShadowTex,
        isPolice,
      });
      rig.group.position.set(x, groundHeightAt(x, z), z);
      this.scene.add(rig.group);
      this.peds.push({
        id: `ped_${i}`,
        rig,
        x,
        z,
        yaw: i * 0.9,
        walkPhase: i,
        speed: isPolice ? 2.1 : 1.7 + (i % 3) * 0.35,
        fleeTimer: 0,
        isPolice,
        hp: isPolice ? 75 : 40,
        koTimer: 0,
      });
    }
  }

  private createVehicle(
    id: string,
    type: VehicleType,
    x: number,
    z: number,
    yaw: number,
    isTraffic: boolean,
    isPolice: boolean
  ): WorldVehicle {
    const spec = VEHICLE_SPECS[type];
    const color = this.customVehicleColors[type] ?? spec.defaultColor;
    const rig = buildVehicleModel(type, color, this.textures.contactShadowTex);
    const y = type === 'boat' ? -0.3 : groundHeightAt(x, z);
    rig.group.position.set(x, y, z);
    rig.group.rotation.y = yaw;
    this.scene.add(rig.group);
    const veh: WorldVehicle = {
      id,
      type,
      color,
      rig,
      phys: { x, y, z, yaw, speed: 0, vy: 0, steerAngle: 0, hp: spec.maxHp },
      isTraffic,
      isPolice,
      trafficDir: 1,
      trafficAxis: 'z',
      trafficLaneCoord: 0,
    };
    this.vehicles.push(veh);
    return veh;
  }

  // --- Public API for React UI ---
  public setGameState(next: GameStateMode): void {
    this.mode = next;
    document.body.dataset.state = next;
    if (next === 'playing') {
      this.audio.unlock();
      this.keys.clear();
      this.mouseDown = false;
      this.emitHud();
    } else {
      this.audio.stopLoops();
      this.keys.clear();
      this.mouseDown = false;
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
  }

  public startNewOrContinue(save?: SaveGameData | null): void {
    if (save) {
      this.characterId = save.characterId;
      this.outfitId = save.outfitId;
      this.cash = save.cash;
      this.respect = save.respect;
      this.completedMissionIds = [...save.completedMissionIds];
      this.unlockedOutfits = [...save.unlockedOutfits];
      this.customVehicleColors = { ...save.customVehicleColors };
      this.selectedGarageVehicle = save.selectedGarageVehicle;
      this.kills = save.kills;
      this.playerPos.set(save.playerPos.x, save.playerPos.y, save.playerPos.z);
    } else {
      this.hp = this.maxHp;
      this.armor = 50;
      this.wanted = { stars: 0, heat: 0, cooldownTimer: 0 };
      this.playerPos.set(8, 0, 8);
      this.playerYaw = Math.PI;
      this.camYaw = 0;
    }
    this.applyAppearance();
    this.setGameState('playing');
  }

  public selectCharacter(characterId: string): void {
    this.characterId = characterId;
    this.applyAppearance();
    this.emitHud();
  }

  public selectOrBuyOutfit(outfitId: string): boolean {
    const opt = OUTFIT_OPTIONS.find((o) => o.id === outfitId);
    if (!opt) return false;
    if (!this.unlockedOutfits.includes(outfitId)) {
      if (this.cash < opt.price) {
        this.showToast(`Need ₹${opt.price} for ${opt.name}`);
        return false;
      }
      this.cash -= opt.price;
      this.unlockedOutfits.push(outfitId);
    }
    this.outfitId = outfitId;
    this.applyAppearance();
    this.showToast(`Equipped ${opt.name}`);
    this.emitHud();
    return true;
  }

  private applyAppearance(): void {
    const preset = CHARACTER_PRESETS.find((c) => c.id === this.characterId) ?? CHARACTER_PRESETS[0];
    const outfit = OUTFIT_OPTIONS.find((o) => o.id === this.outfitId);
    this.playerRig.shirtMat.color.set(outfit ? outfit.shirtColor : preset.shirtColor);
    this.playerRig.pantsMat.color.set(outfit ? outfit.pantsColor : preset.pantsColor);
    this.playerRig.accentMat.color.set(outfit ? outfit.accentColor : preset.accentColor);
  }

  public spawnOrCustomizeVehicle(type: VehicleType, colorHex: string): void {
    this.selectedGarageVehicle = type;
    this.customVehicleColors[type] = colorHex;
    // Update existing matching vehicles or spawn right beside player
    if (this.currentVehicle && this.currentVehicle.type === type) {
      this.currentVehicle.color = colorHex;
      this.currentVehicle.rig.bodyMat.color.set(colorHex);
      this.currentVehicle.phys.hp = VEHICLE_SPECS[type].maxHp;
      this.showToast(`Customized ${VEHICLE_SPECS[type].label}!`);
      this.emitHud();
      return;
    }

    // Spawn a fresh customized ride 5m ahead/beside player (or in water if boat)
    const spawnX = type === 'boat' ? -18 : this.playerPos.x + Math.sin(this.playerYaw + 0.5) * 5.5;
    const spawnZ = type === 'boat' ? 186 : this.playerPos.z + Math.cos(this.playerYaw + 0.5) * 5.5;
    const col = type === 'boat' ? { x: spawnX, z: spawnZ } : resolveCircleWorldCollisions(spawnX, spawnZ, 2.5, 0);
    const veh = this.createVehicle(`custom_${Date.now()}`, type, col.x, col.z, this.playerYaw, false, type === 'police_car');
    veh.color = colorHex;
    veh.rig.bodyMat.color.set(colorHex);
    this.showToast(`Delivered ${VEHICLE_SPECS[type].label} nearby!`);
    this.emitHud();
  }

  public startMission(missionId: string): void {
    const def = MISSION_LIST.find((m) => m.id === missionId);
    if (!def) return;
    this.clearEnemies();
    this.activeMission = createActiveMission(def);

    // If mission requires a special vehicle and player isn't in one, spawn it nearby
    if (def.requiredVehicle && (!this.currentVehicle || this.currentVehicle.type !== def.requiredVehicle)) {
      const sx = this.playerPos.x + 4.5;
      const sz = this.playerPos.z + 2;
      const col = resolveCircleWorldCollisions(sx, sz, 2.5, 0);
      this.createVehicle(`mission_veh_${Date.now()}`, def.requiredVehicle, col.x, col.z, this.playerYaw, false, false);
    }

    if (def.enemyCount && def.enemyCount > 0) {
      this.spawnMissionEnemies(def);
    }

    this.waypointBeam.visible = true;
    this.waypointBeam.position.set(
      this.activeMission.waypoint.x,
      groundHeightAt(this.activeMission.waypoint.x, this.activeMission.waypoint.z),
      this.activeMission.waypoint.z
    );
    this.showToast(`Mission Started: ${def.title}`);
    this.emitHud();
  }

  private spawnMissionEnemies(def: MissionDef): void {
    const policies: Array<'chaser' | 'ranged' | 'charger'> = ['chaser', 'ranged', 'charger'];
    const count = def.enemyCount ?? 3;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const ex = def.targetPos.x + Math.cos(angle) * 7;
      const ez = def.targetPos.z + Math.sin(angle) * 7;
      const policy = policies[i % policies.length];
      const rig = buildHumanModel({
        skinColor: '#b97c4c',
        shirtColor: policy === 'charger' ? '#7f1d1d' : policy === 'ranged' ? '#312e81' : '#3f3f46',
        pantsColor: '#18181b',
        accentColor: policy === 'charger' ? '#ef4444' : policy === 'ranged' ? '#38bdf8' : '#f59e0b',
        hairColor: '#09090b',
        contactShadowTex: this.textures.contactShadowTex,
        scale: policy === 'charger' ? 1.18 : 1.0,
        withWeapons: true,
      });
      if (policy === 'ranged') rig.blasterMesh.visible = true;
      else if (policy === 'chaser') rig.batMesh.visible = true;

      rig.group.position.set(ex, groundHeightAt(ex, ez), ez);
      this.scene.add(rig.group);

      const telegraphRing = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.9, 20),
        new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      telegraphRing.rotation.x = -Math.PI / 2;
      telegraphRing.position.set(ex, groundHeightAt(ex, ez) + 0.08, ez);
      telegraphRing.visible = false;
      this.scene.add(telegraphRing);

      this.enemies.push({
        sim: {
          id: `enemy_${i}_${Date.now()}`,
          policy,
          x: ex,
          z: ez,
          yaw: 0,
          hp: policy === 'charger' ? 95 : 55,
          maxHp: policy === 'charger' ? 95 : 55,
          state: 'approach',
          stateTimer: 0,
          strafeDir: i % 2 === 0 ? 1 : -1,
          hasAttackToken: false,
        },
        rig,
        telegraphRing,
        hitFlashTimer: 0,
      });
    }
  }

  private clearEnemies(): void {
    for (const e of this.enemies) {
      this.scene.remove(e.rig.group);
      this.scene.remove(e.telegraphRing);
    }
    this.enemies = [];
  }

  public updateSettings(partial: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.audio.setMuted(this.settings.muted);
    if (partial.graphics) {
      if (this.isSoftwareGl) {
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
      } else if (partial.graphics === 'low') {
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
      } else if (partial.graphics === 'medium') {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
      } else {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
      }
    }
    this.rainInst.visible = this.settings.weather !== 'clear';
    this.applyLightingAndAtmosphere();
    this.emitHud();
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public getSaveSnapshot(): SaveGameData {
    return {
      version: 1,
      characterId: this.characterId,
      outfitId: this.outfitId,
      cash: Math.round(this.cash),
      respect: Math.round(this.respect),
      completedMissionIds: [...this.completedMissionIds],
      unlockedOutfits: [...this.unlockedOutfits],
      customVehicleColors: { ...this.customVehicleColors },
      selectedGarageVehicle: this.selectedGarageVehicle,
      playerPos: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
      kills: this.kills,
    };
  }

  public setWeapon(w: WeaponId): void {
    this.weapon = w;
    this.playerRig.batMesh.visible = w === 'bat';
    this.playerRig.blasterMesh.visible = w === 'blaster';
    this.emitHud();
  }

  public setTouchControlsInput(partial: Partial<InputState>): void {
    Object.assign(this.touchInput, partial);
  }

  public respawnAfterDefeat(): void {
    this.hp = this.maxHp;
    this.armor = 50;
    this.wanted = { stars: 0, heat: 0, cooldownTimer: 0 };
    if (this.currentVehicle) {
      this.exitVehicle();
    }
    // Respawn outside Apollo City Hospital
    this.playerPos.set(148, 0, 14);
    this.playerVelY = 0;
    this.playerYaw = -Math.PI / 2;
    this.camYaw = -Math.PI / 2;
    this.setGameState('playing');
    this.showToast('Discharged from Apollo City Hospital');
  }

  public showToast(text: string): void {
    this.toastText = text;
    this.toastTimer = 3.2;
  }

  // --- Minimap Direct Canvas Renderer ---
  public drawMinimap(ctx: CanvasRenderingContext2D, size: number): void {
    const cx = size / 2;
    const cy = size / 2;
    const scale = size / 190; // Shows ~95m radius around player
    const px = this.currentVehicle ? this.currentVehicle.phys.x : this.playerPos.x;
    const pz = this.currentVehicle ? this.currentVehicle.phys.z : this.playerPos.z;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.47, 0, Math.PI * 2);
    ctx.clip();

    // District tint blocks
    for (const z of DISTRICT_ZONES) {
      const rx = cx + (z.minX - px) * scale;
      const ry = cy + (z.minZ - pz) * scale;
      const rw = (z.maxX - z.minX) * scale;
      const rh = (z.maxZ - z.minZ) * scale;
      ctx.fillStyle = z.color;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.globalAlpha = 1;

    // Road network
    ctx.strokeStyle = '#64748b';
    for (const r of ROAD_SEGMENTS) {
      ctx.lineWidth = Math.max(2, r.width * scale * 0.7);
      ctx.beginPath();
      ctx.moveTo(cx + (r.x1 - px) * scale, cy + (r.z1 - pz) * scale);
      ctx.lineTo(cx + (r.x2 - px) * scale, cy + (r.z2 - pz) * scale);
      ctx.stroke();
    }

    // Interactable icons
    for (const spot of INTERACTABLE_SPOTS) {
      const sx = cx + (spot.x - px) * scale;
      const sy = cy + (spot.z - pz) * scale;
      ctx.fillStyle = spot.action === 'garage' ? '#f97316' : spot.action === 'heal' ? '#22c55e' : '#38bdf8';
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }

    // Vehicles
    for (const v of this.vehicles) {
      if (v === this.currentVehicle) continue;
      const vx = cx + (v.phys.x - px) * scale;
      const vy = cy + (v.phys.z - pz) * scale;
      ctx.fillStyle = v.isPolice ? (Math.floor(performance.now() / 220) % 2 === 0 ? '#ef4444' : '#3b82f6') : '#cbd5e1';
      ctx.beginPath();
      ctx.arc(vx, vy, v.isPolice ? 3.2 : 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hostile enemies
    for (const e of this.enemies) {
      if (e.sim.state === 'ko') continue;
      const ex = cx + (e.sim.x - px) * scale;
      const ey = cy + (e.sim.z - pz) * scale;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(ex, ey, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mission Waypoint
    if (this.activeMission) {
      const wx = cx + (this.activeMission.waypoint.x - px) * scale;
      const wy = cy + (this.activeMission.waypoint.z - pz) * scale;
      // Clamp to minimap edge if distant
      const dx = wx - cx;
      const dy = wy - cy;
      const d = Math.hypot(dx, dy);
      const maxR = size * 0.41;
      const mx = d > maxR ? cx + (dx / d) * maxR : wx;
      const my = d > maxR ? cy + (dy / d) * maxR : wy;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(mx, my, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player heading arrow at center
    ctx.save();
    ctx.translate(cx, cy);
    const heading = this.currentVehicle ? this.currentVehicle.phys.yaw : this.playerYaw;
    ctx.rotate(-heading + Math.PI);
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // --- Event Listeners ---
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const code = e.code;
    this.keys.add(code);

    if (this.mode === 'playing') {
      if (code === 'Space') this.keyJumpQueued = true;
      if (code === 'KeyJ') this.keyAttackQueued = true;
      if (code === 'KeyF' || code === 'KeyE') this.keyInteractQueued = true;
      if (code === 'Digit1') this.setWeapon('fists');
      if (code === 'Digit2') this.setWeapon('bat');
      if (code === 'Digit3') this.setWeapon('blaster');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onWindowBlur = () => {
    this.keys.clear();
    this.mouseDown = false;
    this.isDraggingCamera = false;
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.keys.clear();
      this.mouseDown = false;
      this.isDraggingCamera = false;
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'playing') return;
    if (e.target !== this.renderer.domElement) return;
    this.audio.unlock();
    if (e.button === 0) {
      this.mouseDown = true;
      this.isDraggingCamera = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      // Left click also fires/attacks if not inside a drag
      this.keyAttackQueued = true;
    } else if (e.button === 2) {
      this.isDraggingCamera = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.mode !== 'playing') return;
    if (this.pointerLocked) {
      this.camYaw -= e.movementX * 0.0032;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.0025, -0.15, 0.92);
    } else if (this.isDraggingCamera) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.camYaw -= dx * 0.0055;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, -0.15, 0.92);
    }
  };

  private onPointerUp = () => {
    this.mouseDown = false;
    this.isDraggingCamera = false;
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  // --- Game Loop & Software-WebGL Pacing ---
  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.mode === 'title') {
      this.updateTitleFlyover(dt);
    } else if (this.mode === 'playing') {
      this.updatePlaying(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private updateTitleFlyover(dt: number): void {
    this.titleFlyAngle += dt * 0.12;
    // Elevated panoramic sweep from the southern bay/bridge looking north across the downtown skyscrapers
    const cx = -38 + Math.sin(this.titleFlyAngle) * 32;
    const cz = 112 + Math.cos(this.titleFlyAngle) * 24;
    this.camera.position.set(cx, 54 + Math.sin(this.titleFlyAngle * 1.3) * 4, cz);
    this.camera.lookAt(14, 18, -65);
    this.animateWorldProps(dt);
  }

  private updatePlaying(dt: number): void {
    // 1. Toast & Hitstop timers
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastText = null;
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.9);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateCamera(dt);
      return;
    }

    // 2. Day/Night & Weather
    if (this.settings.autoCycleTime) {
      this.settings.timeOfDayHours = (this.settings.timeOfDayHours + dt * 0.18) % 24;
    }
    this.applyLightingAndAtmosphere(dt);
    this.animateWorldProps(dt);
    this.updateWeatherParticles(dt);

    // 3. Consume Touch + Keyboard Inputs
    const moveX =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.touchInput.moveX;
    const moveY =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
      this.touchInput.moveY;
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchInput.sprint;
    const jumpPressed = this.keyJumpQueued || this.touchInput.jumpJustPressed;
    const attackPressed = this.keyAttackQueued || this.touchInput.attackJustPressed;
    const interactPressed = this.keyInteractQueued || this.touchInput.interactJustPressed;
    const brakeHeld = this.keys.has('Space') || this.touchInput.brakeHeld;

    this.keyJumpQueued = false;
    this.keyAttackQueued = false;
    this.keyInteractQueued = false;
    this.touchInput.jumpJustPressed = false;
    this.touchInput.attackJustPressed = false;
    this.touchInput.interactJustPressed = false;

    if (Math.abs(this.touchInput.lookDeltaX) > 0.01 || Math.abs(this.touchInput.lookDeltaY) > 0.01) {
      this.camYaw -= this.touchInput.lookDeltaX * 0.006;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + this.touchInput.lookDeltaY * 0.005, -0.15, 0.92);
      this.touchInput.lookDeltaX = 0;
      this.touchInput.lookDeltaY = 0;
    }

    // 4. Interaction / Enter-Exit Vehicle
    if (interactPressed) {
      this.handleInteract();
    }

    // 5. Player or Driven Vehicle Movement
    if (this.currentVehicle) {
      const spec = VEHICLE_SPECS[this.currentVehicle.type];
      const liftUp = this.keys.has('Space') || this.keys.has('KeyE') || this.touchInput.jumpJustPressed;
      const liftDown = this.keys.has('ShiftLeft') || this.keys.has('KeyC');
      this.currentVehicle.phys = stepVehiclePhysics(
        this.currentVehicle.phys,
        spec,
        {
          throttle: THREE.MathUtils.clamp(moveY, -1, 1),
          steer: THREE.MathUtils.clamp(moveX, -1, 1),
          brake: brakeHeld && spec.category !== 'air',
          liftUp,
          liftDown,
        },
        dt
      );
      const p = this.currentVehicle.phys;
      this.currentVehicle.rig.group.position.set(p.x, p.y, p.z);
      this.currentVehicle.rig.group.rotation.y = p.yaw;
      this.playerPos.set(p.x, p.y, p.z);

      // Spin wheels / rotors
      this.currentVehicle.rig.wheels.forEach((w) => {
        w.rotation.x += (p.speed / 0.38) * dt;
      });
      if (this.currentVehicle.rig.rotor) {
        this.currentVehicle.rig.rotor.rotation.y += dt * 24;
      }
      if (this.currentVehicle.rig.tailRotor) {
        this.currentVehicle.rig.tailRotor.rotation.x += dt * 28;
      }

      // Gently align chase camera behind moving vehicle unless user is dragging
      if (!this.isDraggingCamera && Math.abs(p.speed) > 2) {
        const desiredYaw = p.yaw + Math.PI;
        let diff = desiredYaw - this.camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.camYaw += diff * (1 - Math.exp(-3.2 * dt));
      }
    } else {
      this.updateOnFootPlayer(moveX, moveY, sprint, jumpPressed, attackPressed, dt);
    }

    // 6. Traffic AI, Pedestrians, Police & Wanted System
    this.updateTrafficVehicles(dt);
    this.updatePedestriansAndPolice(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateMissionProgress(dt);

    // 7. Continuous Audio Loops
    const speedNorm = this.currentVehicle
      ? this.currentVehicle.phys.speed / VEHICLE_SPECS[this.currentVehicle.type].topSpeed
      : 0;
    this.audio.updateContinuous(
      !!this.currentVehicle,
      speedNorm,
      this.currentVehicle?.type === 'helicopter',
      this.wanted.stars,
      this.settings.weather !== 'clear',
      dt
    );

    // 8. Smooth Follow Camera + Wall Pull-In
    this.updateCamera(dt);

    // 9. Throttled HUD Snapshot (<= 10Hz)
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.1) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateOnFootPlayer(
    moveX: number,
    moveY: number,
    sprint: boolean,
    jumpPressed: boolean,
    attackPressed: boolean,
    dt: number
  ): void {
    const inWater = isWaterAt(this.playerPos.x, this.playerPos.z);
    const speed = inWater ? 4.4 : sprint ? 11.2 : 6.4;

    // Camera-relative movement direction on XZ
    const camFwdX = -Math.sin(this.camYaw);
    const camFwdZ = -Math.cos(this.camYaw);
    const camRightX = Math.cos(this.camYaw);
    const camRightZ = -Math.sin(this.camYaw);

    let dirX = camFwdX * moveY + camRightX * moveX;
    let dirZ = camFwdZ * moveY + camRightZ * moveX;
    const mag = Math.hypot(dirX, dirZ);
    if (mag > 0.01) {
      dirX /= mag;
      dirZ /= mag;
      const moveAmt = Math.min(1, mag) * speed * dt;
      const nextX = this.playerPos.x + dirX * moveAmt;
      const nextZ = this.playerPos.z + dirZ * moveAmt;
      const col = resolveCircleWorldCollisions(nextX, nextZ, 0.45, this.playerPos.y);
      this.playerPos.x = col.x;
      this.playerPos.z = col.z;

      const targetYaw = Math.atan2(dirX, dirZ);
      let dYaw = targetYaw - this.playerYaw;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      this.playerYaw += dYaw * (1 - Math.exp(-14 * dt));

      this.playerWalkDist += moveAmt;
      if (this.playerOnGround && !inWater) {
        this.footstepAccum += moveAmt;
        if (this.footstepAccum > (sprint ? 2.4 : 1.9)) {
          this.footstepAccum = 0;
          this.audio.playFootstep();
        }
      }
    }

    // Jump & Gravity with Coyote Time + Input Buffering
    if (this.playerOnGround) this.coyoteTimer = 0.11;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    if (jumpPressed) this.jumpBufferTimer = 0.12;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !inWater) {
      this.playerVelY = 8.8;
      this.playerOnGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.playerScaleY = 1.18;
      this.playerScaleXZ = 0.86;
      this.audio.playJump();
    }

    const groundY = inWater ? -0.55 : groundHeightAt(this.playerPos.x, this.playerPos.z);
    if (!this.playerOnGround || this.playerPos.y > groundY + 0.02) {
      this.playerVelY -= 22 * dt;
      this.playerPos.y += this.playerVelY * dt;
      if (this.playerPos.y <= groundY) {
        this.playerPos.y = groundY;
        if (this.playerVelY < -3) {
          this.playerScaleY = 0.8;
          this.playerScaleXZ = 1.18;
        }
        this.playerVelY = 0;
        this.playerOnGround = true;
      }
    } else {
      this.playerPos.y = groundY;
      this.playerOnGround = true;
    }

    // Combat Attack
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackAnimTimer = Math.max(0, this.attackAnimTimer - dt);
    if (attackPressed && this.attackCooldown <= 0) {
      this.performPlayerAttack();
    }

    // Squash & Stretch Damping + Limb Gait Sync
    this.playerScaleY = THREE.MathUtils.damp(this.playerScaleY, 1, 12, dt);
    this.playerScaleXZ = THREE.MathUtils.damp(this.playerScaleXZ, 1, 12, dt);
    this.playerRig.group.position.copy(this.playerPos);
    this.playerRig.group.rotation.y = this.playerYaw;
    this.playerRig.group.scale.set(this.playerScaleXZ, this.playerScaleY, this.playerScaleXZ);

    const swing = mag > 0.05 ? Math.sin(this.playerWalkDist * 2.1) * 0.72 : 0;
    this.playerRig.leftLeg.rotation.x = swing;
    this.playerRig.rightLeg.rotation.x = -swing;
    this.playerRig.leftArm.rotation.x = inWater ? Math.sin(performance.now() * 0.008) * 0.8 : -swing * 0.7;
    if (this.attackAnimTimer > 0) {
      this.playerRig.rightArm.rotation.x = -1.65;
    } else {
      this.playerRig.rightArm.rotation.x = inWater ? -Math.sin(performance.now() * 0.008) * 0.8 : swing * 0.7;
    }
  }

  private performPlayerAttack(): void {
    if (this.weapon === 'blaster') {
      this.attackCooldown = 0.24;
      this.attackAnimTimer = 0.16;
      this.audio.playBlaster();
      const fwdX = Math.sin(this.playerYaw);
      const fwdZ = Math.cos(this.playerYaw);
      this.spawnProjectile(
        this.playerPos.x + fwdX * 0.8,
        this.playerPos.y + 1.25,
        this.playerPos.z + fwdZ * 0.8,
        fwdX * 38,
        0,
        fwdZ * 38,
        true
      );
      this.trauma = Math.min(1, this.trauma + 0.12);
      // Firing weapon in public adds minor heat if near police
      this.wanted = registerCrime(this.wanted, 30);
      return;
    }

    // Melee Fist or Lathi/Bat
    const isBat = this.weapon === 'bat';
    this.attackCooldown = isBat ? 0.36 : 0.28;
    this.attackAnimTimer = 0.22;
    this.audio.playMelee(isBat);
    const reach = isBat ? 3.2 : 2.5;
    const dmg = isBat ? 34 : 22;

    let hitSomething = false;
    for (const e of this.enemies) {
      if (e.sim.state === 'ko') continue;
      const dist = Math.hypot(e.sim.x - this.playerPos.x, e.sim.z - this.playerPos.z);
      if (dist <= reach) {
        this.damageEnemy(e, dmg);
        hitSomething = true;
      }
    }
    for (const p of this.peds) {
      if (p.koTimer > 0) continue;
      const dist = Math.hypot(p.x - this.playerPos.x, p.z - this.playerPos.z);
      if (dist <= reach) {
        p.hp -= dmg;
        this.spawnBurst(p.x, groundHeightAt(p.x, p.z) + 1.1, p.z, 0xfef08a, 8);
        this.wanted = registerCrime(this.wanted, p.isPolice ? 120 : 65);
        if (p.hp <= 0) {
          p.koTimer = 12;
          p.rig.group.rotation.x = Math.PI / 2;
          this.cash += 65;
          this.kills += 1;
        } else {
          p.fleeTimer = 8;
        }
        hitSomething = true;
      }
    }
    if (hitSomething) {
      this.hitstopTimer = 0.045;
      this.trauma = Math.min(1, this.trauma + 0.28);
      this.audio.playImpact();
    }
  }

  private damageEnemy(e: WorldEnemy, dmg: number): void {
    e.sim.hp -= dmg;
    e.hitFlashTimer = 0.08;
    this.spawnBurst(e.sim.x, groundHeightAt(e.sim.x, e.sim.z) + 1.1, e.sim.z, 0xf97316, 10);
    if (e.sim.hp <= 0 && e.sim.state !== 'ko') {
      e.sim.state = 'ko';
      e.sim.stateTimer = 0.6;
      e.telegraphRing.visible = false;
      this.kills += 1;
      this.cash += 120;
      this.respect += 25;
      if (this.activeMission && this.activeMission.enemiesRemaining > 0) {
        this.activeMission.enemiesRemaining -= 1;
        if (this.activeMission.enemiesRemaining === 0) {
          this.activeMission.objectiveText = `${this.activeMission.def.title}: Reach extraction point`;
        }
      }
    }
  }

  private handleInteract(): void {
    if (this.currentVehicle) {
      this.exitVehicle();
      return;
    }

    // 1. Check nearby vehicle to enter
    let closestVeh: WorldVehicle | null = null;
    let closestDist = 5.4;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.phys.x - this.playerPos.x, v.phys.z - this.playerPos.z);
      if (d < closestDist) {
        closestDist = d;
        closestVeh = v;
      }
    }
    if (closestVeh) {
      this.enterVehicle(closestVeh);
      return;
    }

    // 2. Check world interactable spots (Garage, Boutique, Mission Board, Hospital, Police Station)
    for (const spot of INTERACTABLE_SPOTS) {
      const d = Math.hypot(spot.x - this.playerPos.x, spot.z - this.playerPos.z);
      if (d <= spot.radius) {
        if (spot.action === 'heal') {
          if (this.cash >= 100) {
            this.cash -= 100;
            this.hp = this.maxHp;
            this.armor = this.maxArmor;
            this.showToast('Full Health & Armor Restored (-₹100)');
            this.audio.playMissionChime(true);
          } else {
            this.hp = this.maxHp;
            this.showToast('Apollo ER Free First Aid Applied');
          }
          this.emitHud();
        } else if (spot.action === 'clear_wanted') {
          if (this.wanted.stars > 0 && this.cash >= 250) {
            this.cash -= 250;
            this.wanted = { stars: 0, heat: 0, cooldownTimer: 0 };
            this.showToast('Wanted Record Cleared (-₹250)');
            this.emitHud();
          } else if (this.wanted.stars === 0) {
            this.showToast('No Active Wanted Stars');
          } else {
            this.showToast('Need ₹250 to Clear Wanted Record');
          }
        } else {
          this.callbacks.onOpenModal(spot.action);
        }
        return;
      }
    }
  }

  private enterVehicle(veh: WorldVehicle): void {
    this.currentVehicle = veh;
    veh.isTraffic = false;
    this.playerRig.group.visible = false;
    if (veh.isPolice) {
      this.wanted = registerCrime(this.wanted, 95);
    }
    this.showToast(`Entered ${VEHICLE_SPECS[veh.type].label}`);
    this.emitHud();
  }

  private exitVehicle(): void {
    if (!this.currentVehicle) return;
    const p = this.currentVehicle.phys;
    const exitX = p.x - Math.cos(p.yaw) * 2.4;
    const exitZ = p.z + Math.sin(p.yaw) * 2.4;
    const col = resolveCircleWorldCollisions(exitX, exitZ, 0.5, p.y);
    this.playerPos.set(col.x, Math.max(groundHeightAt(col.x, col.z), p.y), col.z);
    this.playerVelY = 0;
    this.currentVehicle.phys.speed *= 0.25;
    this.currentVehicle = null;
    this.playerRig.group.visible = true;
    this.playerRig.group.position.copy(this.playerPos);
    this.emitHud();
  }

  private updateTrafficVehicles(dt: number): void {
    for (const v of this.vehicles) {
      if (v === this.currentVehicle) continue;

      if (v.isPolice && this.wanted.stars > 0) {
        // Active Police Pursuit!
        const targetX = this.playerPos.x;
        const targetZ = this.playerPos.z;
        const dx = targetX - v.phys.x;
        const dz = targetZ - v.phys.z;
        const dist = Math.hypot(dx, dz);
        if (v.type === 'helicopter') {
          const desiredYaw = Math.atan2(dx, dz);
          let dYaw = desiredYaw - v.phys.yaw;
          while (dYaw > Math.PI) dYaw -= Math.PI * 2;
          while (dYaw < -Math.PI) dYaw += Math.PI * 2;
          v.phys.yaw += dYaw * Math.min(1, dt * 2.5);
          v.phys.x += Math.sin(v.phys.yaw) * 22 * dt;
          v.phys.z += Math.cos(v.phys.yaw) * 22 * dt;
          v.phys.y = 26 + Math.sin(performance.now() * 0.002) * 2;
          v.rig.group.position.set(v.phys.x, v.phys.y, v.phys.z);
          v.rig.group.rotation.y = v.phys.yaw;
          if (v.rig.rotor) v.rig.rotor.rotation.y += dt * 24;
          if (v.rig.tailRotor) v.rig.tailRotor.rotation.x += dt * 28;
        } else if (dist > 6.5) {
          const desiredYaw = Math.atan2(dx, dz);
          let dYaw = desiredYaw - v.phys.yaw;
          while (dYaw > Math.PI) dYaw -= Math.PI * 2;
          while (dYaw < -Math.PI) dYaw += Math.PI * 2;
          const steer = THREE.MathUtils.clamp(-dYaw * 1.4, -1, 1);
          v.phys = stepVehiclePhysics(
            v.phys,
            VEHICLE_SPECS.police_car,
            { throttle: 0.78, steer, brake: false },
            dt
          );
          v.rig.group.position.set(v.phys.x, v.phys.y, v.phys.z);
          v.rig.group.rotation.y = v.phys.yaw;
          v.rig.wheels.forEach((w) => (w.rotation.x += (v.phys.speed / 0.38) * dt));
        }
        if (v.rig.sirenBar) {
          const flash = Math.floor(performance.now() / 160) % 2 === 0;
          (v.rig.sirenBar.material as THREE.MeshStandardMaterial).emissive.setHex(flash ? 0xef4444 : 0x2563eb);
        }
        continue;
      }

      if (!v.isTraffic) continue;

      // Cruise along straight avenue and wrap cleanly
      const cruiseSpeed = 11;
      if (v.trafficAxis === 'z') {
        v.phys.z += v.trafficDir * cruiseSpeed * dt;
        if (v.phys.z > 130) v.phys.z = -145;
        if (v.phys.z < -145) v.phys.z = 130;
      } else {
        v.phys.x += v.trafficDir * cruiseSpeed * dt;
        if (v.phys.x > 180) v.phys.x = -180;
        if (v.phys.x < -180) v.phys.x = 180;
      }
      v.phys.y = groundHeightAt(v.phys.x, v.phys.z);
      v.rig.group.position.set(v.phys.x, v.phys.y, v.phys.z);
      v.rig.wheels.forEach((w) => (w.rotation.x += (cruiseSpeed / 0.38) * dt));
    }

    // Spawn police chopper at 3+ stars if not already deployed
    if (this.wanted.stars >= 3 && !this.policeChopper) {
      const heli = this.createVehicle('police_heli', 'helicopter', this.playerPos.x + 45, this.playerPos.z - 45, 0, false, true);
      heli.phys.y = 28;
      this.policeChopper = heli;
    } else if (this.wanted.stars < 3 && this.policeChopper) {
      this.scene.remove(this.policeChopper.rig.group);
      this.vehicles = this.vehicles.filter((v) => v !== this.policeChopper);
      this.policeChopper = null;
    }
  }

  private updatePedestriansAndPolice(dt: number): void {
    let policeSeesPlayer = false;

    for (const p of this.peds) {
      if (p.koTimer > 0) {
        p.koTimer -= dt;
        if (p.koTimer <= 0) {
          p.hp = p.isPolice ? 75 : 40;
          p.rig.group.rotation.x = 0;
        }
        continue;
      }

      const distToPlayer = Math.hypot(this.playerPos.x - p.x, this.playerPos.z - p.z);

      if (p.isPolice && this.wanted.stars > 0) {
        if (distToPlayer < 46) policeSeesPlayer = true;
        if (distToPlayer > 3.2 && distToPlayer < 65) {
          const dx = this.playerPos.x - p.x;
          const dz = this.playerPos.z - p.z;
          p.yaw = Math.atan2(dx, dz);
          const col = resolveCircleWorldCollisions(
            p.x + Math.sin(p.yaw) * 4.5 * dt,
            p.z + Math.cos(p.yaw) * 4.5 * dt,
            0.4,
            0
          );
          p.x = col.x;
          p.z = col.z;
          p.walkPhase += 4.5 * dt;
        }
        // Police shoots periodically if close on foot
        if (distToPlayer < 22 && Math.random() < dt * 0.85) {
          const dirX = (this.playerPos.x - p.x) / Math.max(0.1, distToPlayer);
          const dirZ = (this.playerPos.z - p.z) / Math.max(0.1, distToPlayer);
          this.spawnProjectile(p.x, groundHeightAt(p.x, p.z) + 1.2, p.z, dirX * 22, 0, dirZ * 22, false);
        }
      } else {
        // Normal patrol / stroll / flee
        const spd = p.fleeTimer > 0 ? p.speed * 2.2 : p.speed;
        if (p.fleeTimer > 0) {
          p.fleeTimer -= dt;
          p.yaw = Math.atan2(p.x - this.playerPos.x, p.z - this.playerPos.z);
        }
        const nx = p.x + Math.sin(p.yaw) * spd * dt;
        const nz = p.z + Math.cos(p.yaw) * spd * dt;
        const col = resolveCircleWorldCollisions(nx, nz, 0.4, 0);
        if (col.collided || isWaterAt(col.x, col.z)) {
          p.yaw += Math.PI * 0.72;
        } else {
          p.x = col.x;
          p.z = col.z;
        }
        p.walkPhase += spd * dt;
      }

      p.rig.group.position.set(p.x, groundHeightAt(p.x, p.z), p.z);
      p.rig.group.rotation.y = p.yaw;
      const swing = Math.sin(p.walkPhase * 2) * 0.55;
      p.rig.leftLeg.rotation.x = swing;
      p.rig.rightLeg.rotation.x = -swing;
      p.rig.leftArm.rotation.x = -swing * 0.6;
      p.rig.rightArm.rotation.x = swing * 0.6;
    }

    // Check police vehicles sight
    if (this.wanted.stars > 0) {
      for (const v of this.vehicles) {
        if (v.isPolice && Math.hypot(v.phys.x - this.playerPos.x, v.phys.z - this.playerPos.z) < 52) {
          policeSeesPlayer = true;
          break;
        }
      }
      this.wanted = updateWantedState(this.wanted, policeSeesPlayer, dt);
    }
  }

  private updateEnemies(dt: number): void {
    let activeTokens = this.enemies.filter((e) => e.sim.hasAttackToken).length;
    const maxTokens = 2;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.sim.state === 'ko') {
        e.sim.stateTimer -= dt;
        e.rig.group.rotation.x = THREE.MathUtils.damp(e.rig.group.rotation.x, Math.PI / 2, 12, dt);
        e.rig.group.scale.y = Math.max(0.05, e.sim.stateTimer * 1.6);
        if (e.sim.stateTimer <= 0) {
          this.scene.remove(e.rig.group);
          this.scene.remove(e.telegraphRing);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      const prevX = e.sim.x;
      const prevZ = e.sim.z;
      const step = stepEnemyPolicy(e.sim, this.playerPos.x, this.playerPos.z, dt, activeTokens, maxTokens);
      e.sim = step.enemy;
      if (e.sim.hasAttackToken) activeTokens = Math.min(maxTokens, activeTokens + 1);

      if (step.dealtDamage > 0) {
        this.damagePlayer(step.dealtDamage);
      }
      if (step.firedProjectile) {
        const dx = this.playerPos.x - e.sim.x;
        const dz = this.playerPos.z - e.sim.z;
        const d = Math.max(0.1, Math.hypot(dx, dz));
        this.spawnProjectile(
          e.sim.x,
          groundHeightAt(e.sim.x, e.sim.z) + 1.25,
          e.sim.z,
          (dx / d) * 24,
          0,
          (dz / d) * 24,
          false
        );
      }

      const gy = groundHeightAt(e.sim.x, e.sim.z);
      e.rig.group.position.set(e.sim.x, gy, e.sim.z);
      e.rig.group.rotation.y = e.sim.yaw;

      const moved = Math.hypot(e.sim.x - prevX, e.sim.z - prevZ);
      const swing = moved > 0.005 ? Math.sin(performance.now() * 0.012) * 0.65 : 0;
      e.rig.leftLeg.rotation.x = swing;
      e.rig.rightLeg.rotation.x = -swing;

      // Hit flash visual feedback
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        e.rig.shirtMat.emissive.setHex(0xffffff);
        e.rig.shirtMat.emissiveIntensity = 0.9;
      } else {
        e.rig.shirtMat.emissive.setHex(0x000000);
        e.rig.shirtMat.emissiveIntensity = 0;
      }

      // Windup Telegraph Ring visibility
      if (e.sim.state === 'windup') {
        e.telegraphRing.visible = true;
        e.telegraphRing.position.set(e.sim.x, gy + 0.08, e.sim.z);
        const pulse = 1 + Math.sin(performance.now() * 0.025) * 0.2;
        e.telegraphRing.scale.setScalar(pulse);
      } else {
        e.telegraphRing.visible = false;
      }
    }
  }

  private damagePlayer(amount: number): void {
    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, remaining * 0.65);
      this.armor -= absorbed;
      remaining -= absorbed;
    }
    this.hp = Math.max(0, this.hp - remaining);
    this.trauma = Math.min(1, this.trauma + 0.35);
    this.audio.playImpact();

    if (this.hp <= 0) {
      this.setGameState('gameover');
      const reason = this.wanted.stars > 0 ? 'busted' : 'wasted';
      this.audio.playMissionChime(false);
      this.callbacks.onGameOver(reason, this.buildHudSnapshot(reason));
    }
  }

  private spawnProjectile(x: number, y: number, z: number, vx: number, vy: number, vz: number, fromPlayer: boolean): void {
    const slot = this.projectiles.find((p) => !p.active);
    if (!slot) return;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.life = 1.6;
    slot.fromPlayer = fromPlayer;
    (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(fromPlayer ? 0x38bdf8 : 0xef4444);
    slot.mesh.position.set(x, y, z);
    slot.mesh.visible = true;
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);

      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      if (p.fromPlayer) {
        for (const e of this.enemies) {
          if (e.sim.state === 'ko') continue;
          if (Math.hypot(e.sim.x - p.x, e.sim.z - p.z) < 1.1) {
            this.damageEnemy(e, 28);
            p.active = false;
            p.mesh.visible = false;
            this.hitstopTimer = 0.032;
            break;
          }
        }
        if (!p.active) continue;
        for (const ped of this.peds) {
          if (ped.koTimer > 0) continue;
          if (Math.hypot(ped.x - p.x, ped.z - p.z) < 1.0) {
            ped.hp -= 35;
            this.spawnBurst(p.x, p.y, p.z, 0x38bdf8, 8);
            this.wanted = registerCrime(this.wanted, ped.isPolice ? 120 : 65);
            if (ped.hp <= 0) {
              ped.koTimer = 12;
              ped.rig.group.rotation.x = Math.PI / 2;
              this.kills += 1;
              this.cash += 65;
            } else {
              ped.fleeTimer = 8;
            }
            p.active = false;
            p.mesh.visible = false;
            break;
          }
        }
      } else {
        if (Math.hypot(this.playerPos.x - p.x, this.playerPos.z - p.z) < 1.05) {
          this.damagePlayer(10);
          p.active = false;
          p.mesh.visible = false;
        }
      }
    }
  }

  private spawnBurst(x: number, y: number, z: number, colorHex: number, count: number): void {
    let spawned = 0;
    for (const pt of this.particles) {
      if (!pt.active) {
        pt.active = true;
        pt.x = x;
        pt.y = y;
        pt.z = z;
        pt.vx = (Math.random() - 0.5) * 7;
        pt.vy = 2 + Math.random() * 5;
        pt.vz = (Math.random() - 0.5) * 7;
        pt.maxLife = 0.4 + Math.random() * 0.25;
        pt.life = pt.maxLife;
        pt.size = 0.7 + Math.random() * 0.7;
        pt.color.setHex(colorHex);
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private updateParticles(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.particles.length; i++) {
      const pt = this.particles[i];
      if (!pt.active) continue;
      dirty = true;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        _dummy.position.set(0, -999, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particleInst.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      pt.vy -= 14 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      const s = (pt.life / pt.maxLife) * pt.size;
      _dummy.position.set(pt.x, pt.y, pt.z);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.particleInst.setMatrixAt(i, _dummy.matrix);
      this.particleInst.setColorAt(i, pt.color);
    }
    if (dirty) {
      this.particleInst.instanceMatrix.needsUpdate = true;
      if (this.particleInst.instanceColor) this.particleInst.instanceColor.needsUpdate = true;
    }
  }

  private updateMissionProgress(dt: number): void {
    if (!this.activeMission) {
      this.waypointBeam.visible = false;
      return;
    }

    if (this.activeMission.def.timeLimitSec && this.activeMission.timeRemaining > 0) {
      this.activeMission.timeRemaining -= dt;
      if (this.activeMission.timeRemaining <= 0) {
        this.showToast(`Mission Failed: Time Expired`);
        this.audio.playMissionChime(false);
        this.activeMission = null;
        this.clearEnemies();
        this.waypointBeam.visible = false;
        this.emitHud();
        return;
      }
    }

    const wp = this.activeMission.waypoint;
    const dist = Math.hypot(this.playerPos.x - wp.x, this.playerPos.z - wp.z);
    if (dist < 6.5 && this.activeMission.enemiesRemaining <= 0) {
      const res = advanceMissionWaypoint(this.activeMission);
      if (res.completed) {
        const def = this.activeMission.def;
        this.cash += def.rewardCash;
        this.respect += def.rewardRespect;
        if (!this.completedMissionIds.includes(def.id)) {
          this.completedMissionIds.push(def.id);
        }
        this.audio.playMissionChime(true);
        this.showToast(`Mission Complete! +₹${def.rewardCash} · +${def.rewardRespect} Respect`);
        this.activeMission = null;
        this.waypointBeam.visible = false;
        this.emitHud();
      } else {
        this.activeMission = res.next;
        this.waypointBeam.position.set(
          res.next.waypoint.x,
          groundHeightAt(res.next.waypoint.x, res.next.waypoint.z),
          res.next.waypoint.z
        );
        this.audio.playMissionChime(true);
        this.emitHud();
      }
    }
  }

  private updateCamera(dt: number): void {
    const targetPos = this.currentVehicle ? this.currentVehicle.rig.group.position : this.playerPos;
    const lookH = this.currentVehicle ? 1.55 : 1.48;
    _camTarget.set(targetPos.x, targetPos.y + lookH, targetPos.z);

    const dist = this.currentVehicle
      ? this.currentVehicle.type === 'helicopter'
        ? 13.5
        : this.currentVehicle.type === 'bus' || this.currentVehicle.type === 'truck'
          ? 11.5
          : 8.6
      : this.camDist;

    const horiz = Math.cos(this.camPitch) * dist;
    const vert = Math.sin(this.camPitch) * dist;

    _camDesired.set(
      _camTarget.x + Math.sin(this.camYaw) * horiz,
      Math.max(groundHeightAt(_camTarget.x, _camTarget.z) + 0.8, _camTarget.y + vert),
      _camTarget.z + Math.cos(this.camYaw) * horiz
    );

    const alpha = 1 - Math.exp(-12 * dt);
    this.camera.position.lerp(_camDesired, alpha);

    // Trauma Shake
    if (this.trauma > 0.005) {
      const shake = this.trauma * this.trauma * 0.45;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
    }

    this.camera.lookAt(_camTarget);

    // Keep Sun shadow frustum centered near player
    this.sunLight.target.position.set(targetPos.x, 0, targetPos.z);
    this.sunLight.position.set(targetPos.x + 65, 110, targetPos.z + 45);
  }

  private animateWorldProps(dt: number): void {
    // Shimmer water UV
    this.textures.waterBump.offset.x += dt * 0.03;
    this.textures.waterBump.offset.y += dt * 0.02;

    // Pulse beacons & rotate world interact rings
    const t = performance.now() * 0.003;
    for (const m of this.cityRefs.interactMarkers) {
      m.rotation.z += dt * 1.4;
      m.position.y = 0.24 + Math.sin(t) * 0.06;
    }
    if (this.waypointBeam.visible) {
      this.waypointBeam.rotation.y += dt * 1.8;
    }
  }

  private updateWeatherParticles(dt: number): void {
    if (this.settings.weather === 'clear') return;
    const px = this.playerPos.x;
    const py = this.playerPos.y;
    const pz = this.playerPos.z;
    for (let i = 0; i < this.rainDrops.length; i++) {
      const r = this.rainDrops[i];
      r.y -= r.speed * dt;
      if (r.y < 0) {
        r.y = 32;
        r.x = (Math.random() - 0.5) * 65;
        r.z = (Math.random() - 0.5) * 65;
      }
      _dummy.position.set(px + r.x, py + r.y, pz + r.z);
      _dummy.rotation.set(0, 0, 0.12);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this.rainInst.setMatrixAt(i, _dummy.matrix);
    }
    this.rainInst.instanceMatrix.needsUpdate = true;

    if (this.settings.weather === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 7 + Math.random() * 9;
        this.lightningFlash = 0.25;
        this.audio.playThunder();
      }
    }
  }

  private applyLightingAndAtmosphere(dt = 0): void {
    const h = this.settings.timeOfDayHours;
    // Day factor: 0 at midnight, 1 at noon
    const sunRad = ((h - 6) / 24) * Math.PI * 2;
    const dayFactor = THREE.MathUtils.clamp(Math.sin(sunRad) * 0.75 + 0.55, 0.12, 1);

    const isRain = this.settings.weather !== 'clear';
    const skyDay = new THREE.Color('#7ec8e3');
    const skyDusk = new THREE.Color('#f4a261');
    const skyNight = new THREE.Color('#0f172a');
    const skyStorm = new THREE.Color('#334155');

    const skyCol = new THREE.Color();
    if (h >= 17 && h <= 19.5) {
      skyCol.copy(skyDusk).lerp(skyNight, (h - 17) / 2.5);
    } else if (h >= 5 && h <= 7.5) {
      skyCol.copy(skyNight).lerp(skyDay, (h - 5) / 2.5);
    } else if (h > 7.5 && h < 17) {
      skyCol.copy(skyDay);
    } else {
      skyCol.copy(skyNight);
    }

    if (isRain) {
      skyCol.lerp(skyStorm, 0.65);
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt);
      skyCol.lerp(new THREE.Color('#f8fafc'), 0.85);
    }

    this.scene.background = skyCol;
    (this.scene.fog as THREE.FogExp2).color.copy(skyCol);
    (this.scene.fog as THREE.FogExp2).density = isRain ? 0.0052 : 0.0026;

    this.sunLight.intensity = isRain ? dayFactor * 0.9 : 0.45 + dayFactor * 1.65;
    this.hemiLight.intensity = 0.35 + dayFactor * 0.48;
  }

  private buildHudSnapshot(gameOverReason: 'wasted' | 'busted' | 'victory' | null = null): HudSnapshot {
    const px = this.currentVehicle ? this.currentVehicle.phys.x : this.playerPos.x;
    const pz = this.currentVehicle ? this.currentVehicle.phys.z : this.playerPos.z;
    const district = getDistrictAt(px, pz);

    let nearbyVehicleLabel: string | null = null;
    if (!this.currentVehicle) {
      let best = 5.4;
      for (const v of this.vehicles) {
        const d = Math.hypot(v.phys.x - this.playerPos.x, v.phys.z - this.playerPos.z);
        if (d < best) {
          best = d;
          nearbyVehicleLabel = VEHICLE_SPECS[v.type].label;
        }
      }
    }

    let nearbyInteractLabel: string | null = null;
    if (!this.currentVehicle && !nearbyVehicleLabel) {
      for (const s of INTERACTABLE_SPOTS) {
        if (Math.hypot(s.x - this.playerPos.x, s.z - this.playerPos.z) <= s.radius) {
          nearbyInteractLabel = s.label;
          break;
        }
      }
    }

    const vSpec = this.currentVehicle ? VEHICLE_SPECS[this.currentVehicle.type] : null;
    const speedKmh = this.currentVehicle ? Math.round(Math.abs(this.currentVehicle.phys.speed) * 3.6) : 0;

    return {
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      armor: Math.round(this.armor),
      maxArmor: this.maxArmor,
      cash: Math.round(this.cash),
      respect: Math.round(this.respect),
      wantedStars: this.wanted.stars,
      wantedCooldown: this.wanted.cooldownTimer / 16,
      districtName: district.name,
      districtId: district.id,
      weapon: this.weapon,
      ammo: this.ammo,
      inVehicle: !!this.currentVehicle,
      vehicleLabel: vSpec?.label ?? '',
      vehicleType: this.currentVehicle?.type ?? null,
      vehicleHpPct: this.currentVehicle && vSpec ? Math.round((this.currentVehicle.phys.hp / vSpec.maxHp) * 100) : 100,
      speedKmh,
      altitude: Math.max(0, Math.round(this.playerPos.y)),
      isSwimming: !this.currentVehicle && isWaterAt(this.playerPos.x, this.playerPos.z),
      nearbyVehicleLabel,
      nearbyInteractLabel,
      activeMission: this.activeMission ? { ...this.activeMission } : null,
      completedMissionIds: [...this.completedMissionIds],
      timeOfDayHours: this.settings.timeOfDayHours,
      weather: this.settings.weather,
      toastText: this.toastText,
      gameOverReason,
      kills: this.kills,
      missionsDone: this.completedMissionIds.length,
    };
  }

  private emitHud(): void {
    this.callbacks.onHudUpdate(this.buildHudSnapshot());
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.audio.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
