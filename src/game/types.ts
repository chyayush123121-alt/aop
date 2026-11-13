export type GameStateMode = 'title' | 'playing' | 'paused' | 'gameover';

export type DistrictId =
  | 'downtown'
  | 'residential'
  | 'village'
  | 'highway'
  | 'airport'
  | 'mall'
  | 'hospital'
  | 'police_station'
  | 'garage'
  | 'beach'
  | 'mountains'
  | 'bridge'
  | 'underground_parking'
  | 'ocean';

export type VehicleType =
  | 'supercar'
  | 'sports_car'
  | 'suv'
  | 'motorcycle'
  | 'scooter'
  | 'truck'
  | 'bus'
  | 'police_car'
  | 'helicopter'
  | 'boat';

export type WeaponId = 'fists' | 'bat' | 'blaster';

export type WeatherMode = 'clear' | 'rain' | 'storm';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type EnemyPolicy = 'chaser' | 'ranged' | 'charger';

export type MissionType =
  | 'story'
  | 'car_race'
  | 'bike_race'
  | 'delivery'
  | 'rescue'
  | 'driving_challenge'
  | 'gang_territory'
  | 'side';

export interface CharacterPreset {
  id: string;
  name: string;
  title: string;
  skinColor: string;
  shirtColor: string;
  pantsColor: string;
  accentColor: string;
  hairColor: string;
}

export interface OutfitOption {
  id: string;
  name: string;
  shirtColor: string;
  pantsColor: string;
  accentColor: string;
  price: number;
}

export interface VehicleSpec {
  type: VehicleType;
  label: string;
  category: 'land' | 'air' | 'water';
  topSpeed: number; // m/s
  accel: number;
  brakeDecel: number;
  turnRate: number;
  maxHp: number;
  mass: number;
  seatHeight: number;
  length: number;
  width: number;
  defaultColor: string;
  price: number;
}

export interface MissionDef {
  id: string;
  title: string;
  type: MissionType;
  description: string;
  district: DistrictId;
  rewardCash: number;
  rewardRespect: number;
  startPos: { x: number; z: number };
  targetPos: { x: number; z: number };
  checkpoints?: Array<{ x: number; z: number }>;
  requiredVehicle?: VehicleType;
  enemyCount?: number;
  timeLimitSec?: number;
}

export interface ActiveMissionState {
  def: MissionDef;
  stepIndex: number;
  totalSteps: number;
  timeRemaining: number;
  enemiesRemaining: number;
  objectiveText: string;
  waypoint: { x: number; y: number; z: number };
}

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  district: DistrictId;
  label?: string;
}

export interface RoadSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  isHighway?: boolean;
  isBridge?: boolean;
}

export interface DistrictZone {
  id: DistrictId;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  color: string;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  cash: number;
  respect: number;
  wantedStars: number;
  wantedCooldown: number; // 0..1
  districtName: string;
  districtId: DistrictId;
  weapon: WeaponId;
  ammo: number;
  inVehicle: boolean;
  vehicleLabel: string;
  vehicleType: VehicleType | null;
  vehicleHpPct: number;
  speedKmh: number;
  altitude: number;
  isSwimming: boolean;
  nearbyVehicleLabel: string | null;
  nearbyInteractLabel: string | null;
  activeMission: ActiveMissionState | null;
  completedMissionIds: string[];
  timeOfDayHours: number;
  weather: WeatherMode;
  toastText: string | null;
  gameOverReason: 'wasted' | 'busted' | 'victory' | null;
  kills: number;
  missionsDone: number;
}

export interface GameSettings {
  graphics: GraphicsQuality;
  weather: WeatherMode;
  timeOfDayHours: number; // 0..24
  autoCycleTime: boolean;
  touchControls: boolean;
  muted: boolean;
}

export interface SaveGameData {
  version: number;
  characterId: string;
  outfitId: string;
  cash: number;
  respect: number;
  completedMissionIds: string[];
  unlockedOutfits: string[];
  customVehicleColors: Partial<Record<VehicleType, string>>;
  selectedGarageVehicle: VehicleType;
  playerPos: { x: number; y: number; z: number };
  kills: number;
}

export interface InputState {
  moveX: number; // -1..1
  moveY: number; // -1..1 (forward positive)
  lookDeltaX: number;
  lookDeltaY: number;
  sprint: boolean;
  jumpJustPressed: boolean;
  attackJustPressed: boolean;
  attackHeld: boolean;
  interactJustPressed: boolean;
  brakeHeld: boolean;
  weaponSelect: WeaponId | null;
}
