import type { ColliderBox, DistrictId, DistrictZone, RoadSegment } from './types';

export const WORLD_HALF_EXTENT = 240;
export const BEACH_Z_START = 145;
export const OCEAN_Z_START = 175;
export const MOUNTAIN_Z_END = -175;

export const DISTRICT_ZONES: DistrictZone[] = [
  { id: 'mountains', name: 'Aravalli Ridge', minX: -240, maxX: 240, minZ: -240, maxZ: -165, color: '#6b705c' },
  { id: 'village', name: 'Surya Gaon (Village)', minX: -220, maxX: -75, minZ: -165, maxZ: -35, color: '#d4a373' },
  { id: 'downtown', name: 'Nariman Downtown', minX: -75, maxX: 80, minZ: -165, maxZ: -10, color: '#457b9d' },
  { id: 'police_station', name: 'Central Police HQ', minX: 80, maxX: 170, minZ: -165, maxZ: -40, color: '#2b4c7e' },
  { id: 'residential', name: 'Indira Enclave (Residential)', minX: -220, maxX: -75, minZ: -35, maxZ: 95, color: '#8ab17d' },
  { id: 'underground_parking', name: 'Metro Underground Plaza', minX: -75, maxX: -15, minZ: -10, maxZ: 55, color: '#5c677d' },
  { id: 'mall', name: 'Maharaja Grand Mall', minX: -15, maxX: 60, minZ: -10, maxZ: 60, color: '#e9c46a' },
  { id: 'garage', name: "King's Custom Garage", minX: 60, maxX: 125, minZ: -10, maxZ: 55, color: '#e76f51' },
  { id: 'hospital', name: 'Apollo City Hospital', minX: 125, maxX: 210, minZ: -40, maxZ: 55, color: '#f4f1de' },
  { id: 'highway', name: 'Golden Quadrilateral Express', minX: -220, maxX: 220, minZ: 55, maxZ: 95, color: '#4a4e69' },
  { id: 'bridge', name: 'Sea-Link Suspension Bridge', minX: -45, maxX: 45, minZ: 95, maxZ: 185, color: '#9a8c98' },
  { id: 'airport', name: 'Chhatrapati Airfield', minX: 60, maxX: 230, minZ: 95, maxZ: 170, color: '#6c757d' },
  { id: 'beach', name: 'Juhu Golden Beach', minX: -240, maxX: 60, minZ: 140, maxZ: 175, color: '#f3d58d' },
  { id: 'ocean', name: 'Arabian Sea', minX: -260, maxX: 260, minZ: 175, maxZ: 280, color: '#1d6fa3' },
];

export const ROAD_SEGMENTS: RoadSegment[] = [
  // Main North-South Central Boulevard (x = 0)
  { x1: 0, z1: -165, x2: 0, z2: 185, width: 16, isBridge: true },
  // West Village-Residential Avenue (x = -95)
  { x1: -95, z1: -160, x2: -95, z2: 140, width: 14 },
  // East Hospital-Police Avenue (x = 95)
  { x1: 95, z1: -160, x2: 95, z2: 145, width: 14 },
  // Far East Airport Connector (x = 175)
  { x1: 175, z1: -120, x2: 175, z2: 155, width: 12 },
  // Far West Coastal Road (x = -175)
  { x1: -175, z1: -140, x2: -175, z2: 140, width: 12 },

  // North Mountain Ring Road (z = -150)
  { x1: -185, z1: -150, x2: 185, z2: -150, width: 14 },
  // Downtown Mid Cross Street (z = -75)
  { x1: -185, z1: -75, x2: 185, z2: -75, width: 14 },
  // Central Plaza Street (z = 0)
  { x1: -185, z1: 0, x2: 185, z2: 0, width: 14 },
  // Golden Quadrilateral Express Highway (z = 72)
  { x1: -220, z1: 72, x2: 220, z2: 72, width: 22, isHighway: true },
  // Beachfront Promenade (z = 135)
  { x1: -200, z1: 135, x2: 75, z2: 135, width: 14 },
  // Airport Runway (z = 138, x = 85..220)
  { x1: 85, z1: 138, x2: 225, z2: 138, width: 22 },
];

export const INTERACTABLE_SPOTS = [
  { id: 'garage_bay', label: "King's Custom Garage [F/E]", x: 82, z: 22, radius: 7, action: 'garage' as const },
  { id: 'mall_shop', label: 'Maharaja Boutique & Gear [F/E]', x: 24, z: 24, radius: 7, action: 'wardrobe' as const },
  { id: 'mission_hub', label: 'City King Mission Board [F/E]', x: 42, z: -20, radius: 7, action: 'missions' as const },
  { id: 'hospital_heal', label: 'Apollo ER Heal & Armor [F/E]', x: 150, z: 12, radius: 7, action: 'heal' as const },
  { id: 'police_bribe', label: 'Clear Wanted Fine [F/E]', x: 118, z: -85, radius: 7, action: 'clear_wanted' as const },
];

// Deterministic building/structure colliders across all districts
// Carefully avoids road corridors (x = -175, -95, 0, 95, 175 and z = -150, -75, 0, 72, 135)
export const BUILDING_COLLIDERS: ColliderBox[] = [
  // Downtown Skyscrapers (around x: -65..70, z: -140..-15, keeping x=0 clear for +/-12 and z=-75 clear for +/-10)
  { id: 'sky_1', minX: -58, maxX: -28, minZ: -135, maxZ: -100, height: 58, district: 'downtown', label: 'Indus Tower' },
  { id: 'sky_2', minX: 24, maxX: 58, minZ: -135, maxZ: -98, height: 72, district: 'downtown', label: 'Kohinoor Spire' },
  { id: 'sky_3', minX: -62, maxX: -26, minZ: -55, maxZ: -20, height: 46, district: 'downtown', label: 'BKC Commerce' },
  { id: 'sky_4', minX: 24, maxX: 56, minZ: -56, maxZ: -22, height: 52, district: 'downtown', label: 'Lotus Financial' },

  // Police Station (Central-East)
  { id: 'police_hq', minX: 115, maxX: 155, minZ: -120, maxZ: -90, height: 14, district: 'police_station', label: 'Police HQ' },

  // Shopping Mall (Central-South of z=0, east of x=0)
  { id: 'mall_main', minX: 18, maxX: 54, minZ: 18, maxZ: 48, height: 15, district: 'mall', label: 'Maharaja Mall' },

  // Car Garage
  { id: 'garage_bldg', minX: 68, maxX: 88, minZ: 28, maxZ: 48, height: 9, district: 'garage', label: "King's Garage" },

  // Hospital
  { id: 'hospital_main', minX: 128, maxX: 164, minZ: -22, maxZ: 8, height: 22, district: 'hospital', label: 'Apollo Hospital' },

  // Underground Parking Structure Roof/Entrance frame
  { id: 'parking_deck', minX: -62, maxX: -24, minZ: 16, maxZ: 48, height: 6, district: 'underground_parking', label: 'Underground Parking' },

  // Residential Houses (West, avoiding x=-95 and x=-175)
  { id: 'res_1', minX: -158, maxX: -120, minZ: -20, maxZ: -6, height: 11, district: 'residential', label: 'Enclave Villa A' },
  { id: 'res_2', minX: -158, maxX: -120, minZ: 16, maxZ: 44, height: 13, district: 'residential', label: 'Enclave Villa B' },
  { id: 'res_3', minX: -76, maxX: -32, minZ: 100, maxZ: 122, height: 9, district: 'residential', label: 'Coastal Condo' },

  // Indian Village Huts & Temple (Northwest)
  { id: 'village_temple', minX: -154, maxX: -124, minZ: -132, maxZ: -102, height: 20, district: 'village', label: 'Surya Mandir' },
  { id: 'village_hut_1', minX: -155, maxX: -135, minZ: -62, maxZ: -44, height: 6, district: 'village', label: 'Panchayat Bhavan' },
  { id: 'village_hut_2', minX: -72, maxX: -52, minZ: -130, maxZ: -112, height: 5.5, district: 'village', label: 'Village Market' },

  // Airport Control Tower & Hangar (Southeast, north of runway z=138)
  { id: 'airport_hangar', minX: 112, maxX: 156, minZ: 96, maxZ: 118, height: 12, district: 'airport', label: 'Airfield Hangar' },
  { id: 'airport_tower', minX: 184, maxX: 198, minZ: 96, maxZ: 110, height: 26, district: 'airport', label: 'ATC Tower' },
];

export function groundHeightAt(x: number, z: number): number {
  // Mountains along the far north (z < -170)
  if (z < -170) {
    const t = Math.min(1, (-170 - z) / 60);
    const ridge =
      Math.sin(x * 0.045) * 4.5 +
      Math.cos(x * 0.11 + z * 0.08) * 3.0 +
      6.0;
    return Math.max(0, t * t * (16 + ridge));
  }

  // Sea-Link Bridge arch over the highway/beach/ocean channel (x between -10 and 10, z between 90 and 185)
  if (Math.abs(x) <= 10 && z >= 95 && z <= 185) {
    const u = (z - 95) / 90; // 0..1
    return Math.sin(u * Math.PI) * 5.2;
  }

  // Underground parking recessed bay (x between -56 and -30, z between 18 and 46)
  if (x >= -56 && x <= -30 && z >= 18 && z <= 46) {
    // Gentle ramp from z=18 (y=0) down to z=30 (y=-3.2)
    const ramp = Math.min(1, Math.max(0, (z - 18) / 14));
    return -3.2 * ramp;
  }

  // Beach slope into Arabian Sea
  if (z > BEACH_Z_START && z <= OCEAN_Z_START) {
    const t = (z - BEACH_Z_START) / (OCEAN_Z_START - BEACH_Z_START);
    return -0.8 * t;
  }

  if (z > OCEAN_Z_START) {
    return -1.4;
  }

  return 0;
}

export function isWaterAt(x: number, z: number): boolean {
  // On the bridge deck you are above the water, not in it!
  if (Math.abs(x) <= 10 && z >= 95 && z <= 185) return false;
  return z > OCEAN_Z_START - 6;
}

export function getDistrictAt(x: number, z: number): DistrictZone {
  if (z > OCEAN_Z_START) {
    return DISTRICT_ZONES.find((d) => d.id === 'ocean')!;
  }
  for (const zone of DISTRICT_ZONES) {
    if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) {
      return zone;
    }
  }
  return DISTRICT_ZONES[2]; // default downtown
}

export function getDistrictName(id: DistrictId): string {
  return DISTRICT_ZONES.find((d) => d.id === id)?.name ?? 'Indian City';
}

export function resolveCircleWorldCollisions(
  x: number,
  z: number,
  radius: number,
  y: number
): { x: number; z: number; collided: boolean } {
  let rx = x;
  let rz = z;
  let collided = false;

  // Keep within outer playable boundary
  const maxB = WORLD_HALF_EXTENT - 4;
  if (rx < -maxB) {
    rx = -maxB;
    collided = true;
  } else if (rx > maxB) {
    rx = maxB;
    collided = true;
  }
  if (rz < -maxB) {
    rz = -maxB;
    collided = true;
  } else if (rz > WORLD_HALF_EXTENT + 35) {
    rz = WORLD_HALF_EXTENT + 35;
    collided = true;
  }

  // Skip building colliders if flying high overhead
  if (y > 28) {
    return { x: rx, z: rz, collided };
  }

  for (const b of BUILDING_COLLIDERS) {
    // Allow entering underground parking ramp area (parking_deck is the roof frame above y=3)
    if (b.id === 'parking_deck' && y < 1.5) continue;
    if (y > b.height) continue;

    const closestX = Math.max(b.minX, Math.min(rx, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(rz, b.maxZ));
    const dx = rx - closestX;
    const dz = rz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      collided = true;
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        rx += (dx / dist) * push;
        rz += (dz / dist) * push;
      } else {
        // Inside box center fallback: push to nearest edge
        const dLeft = Math.abs(rx - b.minX);
        const dRight = Math.abs(b.maxX - rx);
        const dTop = Math.abs(rz - b.minZ);
        const dBottom = Math.abs(b.maxZ - rz);
        const minEdge = Math.min(dLeft, dRight, dTop, dBottom);
        if (minEdge === dLeft) rx = b.minX - radius;
        else if (minEdge === dRight) rx = b.maxX + radius;
        else if (minEdge === dTop) rz = b.minZ - radius;
        else rz = b.maxZ + radius;
      }
    }
  }

  return { x: rx, z: rz, collided };
}
