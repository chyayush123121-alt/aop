import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';
import {
  BEACH_Z_START,
  BUILDING_COLLIDERS,
  groundHeightAt,
  OCEAN_Z_START,
  ROAD_SEGMENTS,
} from './worldData';

export interface CityEnvironmentRefs {
  waterMesh: THREE.Mesh;
  beaconMeshes: THREE.Mesh[];
  interactMarkers: THREE.Mesh[];
}

export function buildCityEnvironment(
  scene: THREE.Scene,
  textures: ProceduralTextureSet
): CityEnvironmentRefs {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // 1. Extended Terrain Plane (extends far beyond playable bounds to blend into horizon fog)
  const terrainGeo = new THREE.PlaneGeometry(760, 760, 76, 76);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cGrass = new THREE.Color('#4d6b41');
  const cSand = new THREE.Color('#e2c383');
  const cMountain = new THREE.Color('#6b705c');
  const cRock = new THREE.Color('#8d99ae');

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    // Avoid raising terrain inside the bridge deck corridor; keep water basin low under bridge
    let y = groundHeightAt(x, z);
    if (Math.abs(x) <= 10 && z >= 95 && z <= 185) {
      y = z > OCEAN_Z_START - 12 ? -1.4 : 0;
    }
    posAttr.setY(i, y);

    let col = cGrass;
    if (z > BEACH_Z_START - 4) col = cSand;
    else if (z < -165) col = y > 12 ? cRock : cMountain;
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.terrainGrassMap,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  worldGroup.add(terrain);

  // 2. Arabian Sea Water Plane (animated UV offset in loop)
  const waterGeo = new THREE.PlaneGeometry(760, 280, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e7490,
    roughness: 0.16,
    metalness: 0.25,
    bumpMap: textures.waterBump,
    bumpScale: 0.25,
    clearcoat: 0.85,
    transparent: true,
    opacity: 0.88,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0, -0.35, OCEAN_Z_START + 125);
  waterMesh.receiveShadow = true;
  worldGroup.add(waterMesh);

  // 3. Road Network (offset +0.03m on Y to prevent Z-fighting)
  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.04,
    roughness: 0.84,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  ROAD_SEGMENTS.forEach((seg, idx) => {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const len = Math.hypot(dx, dz);
    const midX = (seg.x1 + seg.x2) / 2;
    const midZ = (seg.z1 + seg.z2) / 2;
    const angle = Math.atan2(dx, dz);

    // Bridge segment has arched deck geometry
    if (seg.isBridge) {
      // Split central road into north flat section (z=-165..95) and arched Sea-Link bridge (z=95..185)
      const flatLen = 260;
      const flatTex = textures.asphaltMap.clone();
      flatTex.needsUpdate = true;
      flatTex.repeat.set(1, Math.max(1, Math.round(flatLen / 16)));
      const flatMat = roadMat.clone();
      flatMat.map = flatTex;
      const flatGeo = new THREE.PlaneGeometry(seg.width, flatLen);
      flatGeo.rotateX(-Math.PI / 2);
      const flatRoad = new THREE.Mesh(flatGeo, flatMat);
      flatRoad.position.set(0, 0.035, -35);
      flatRoad.receiveShadow = true;
      worldGroup.add(flatRoad);

      // Arched Bridge Deck (z = 95..185)
      const bridgeGeo = new THREE.BoxGeometry(16, 0.65, 92, 1, 1, 24);
      const bPos = bridgeGeo.attributes.position;
      for (let i = 0; i < bPos.count; i++) {
        const bz = bPos.getZ(i) + 140; // world z 94..186
        const u = Math.max(0, Math.min(1, (bz - 95) / 90));
        const archY = Math.sin(u * Math.PI) * 5.2;
        bPos.setY(i, bPos.getY(i) + archY);
      }
      bridgeGeo.computeVertexNormals();
      const bridgeDeck = new THREE.Mesh(
        bridgeGeo,
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75, metalness: 0.15 })
      );
      bridgeDeck.position.set(0, -0.26, 140);
      bridgeDeck.castShadow = true;
      bridgeDeck.receiveShadow = true;
      worldGroup.add(bridgeDeck);
    } else {
      const segTex = textures.asphaltMap.clone();
      segTex.needsUpdate = true;
      segTex.repeat.set(seg.isHighway ? 2 : 1, Math.max(1, Math.round(len / 14)));
      const segMat = roadMat.clone();
      segMat.map = segTex;

      const geo = new THREE.PlaneGeometry(seg.width, len);
      geo.rotateX(-Math.PI / 2);
      const roadMesh = new THREE.Mesh(geo, segMat);
      roadMesh.position.set(midX, 0.03 + (idx % 3) * 0.004, midZ);
      roadMesh.rotation.y = angle;
      roadMesh.receiveShadow = true;
      worldGroup.add(roadMesh);
    }
  });

  // Clean asphalt intersection pads so dashed centerlines do not cross abruptly
  const interPadMat = new THREE.MeshStandardMaterial({
    color: 0x252930,
    roughness: 0.86,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const intersections = [
    [0, 0], [0, -75], [0, -150], [0, 72],
    [-95, 0], [-95, -75], [-95, 72],
    [95, 0], [95, -75], [95, 72],
  ];
  for (const [ix, iz] of intersections) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(17.5, iz === 72 ? 22.5 : 17.5), interPadMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(ix, 0.042, iz);
    pad.receiveShadow = true;
    worldGroup.add(pad);
  }

  // 4. Sea-Link Bridge Twin Pylons & Suspension Cables
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4, metalness: 0.2 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.8 });
  [120, 160].forEach((pz) => {
    [-8.6, 8.6].forEach((px) => {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.5, 24, 1.8), pylonMat);
      pylon.position.set(px, 12, pz);
      pylon.castShadow = true;
      worldGroup.add(pylon);
    });
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(18.8, 1.4, 1.4), pylonMat);
    crossBeam.position.set(0, 21.5, pz);
    worldGroup.add(crossBeam);

    // Diagonal stay cables
    [-12, -6, 6, 12].forEach((dz) => {
      const len = Math.hypot(16, dz);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 6), cableMat);
      cable.position.set(-8.6, 13, pz + dz * 0.5);
      cable.rotation.x = Math.atan2(dz, 16);
      worldGroup.add(cable);
      const cableR = cable.clone();
      cableR.position.x = 8.6;
      worldGroup.add(cableR);
    });
  });

  // 5. Buildings & Distinct District Landmarks (composite 3-10 part groups!)
  const facadeMat = new THREE.MeshStandardMaterial({
    map: textures.buildingFacadeMap,
    color: 0xffffff,
    roughness: 0.32,
    metalness: 0.55,
  });
  const terraMat = new THREE.MeshStandardMaterial({
    map: textures.terracottaMap,
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.05,
  });
  const trimSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.7 });
  const beaconMeshes: THREE.Mesh[] = [];

  for (const b of BUILDING_COLLIDERS) {
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const grp = new THREE.Group();
    grp.position.set(cx, 0, cz);

    if (b.district === 'downtown') {
      // Composite Skyscraper: Podium + Main Tower + Setback Crown + Spire
      const podium = new THREE.Mesh(
        new THREE.BoxGeometry(w, 8, d),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.3 })
      );
      podium.position.y = 4;
      podium.castShadow = true;
      podium.receiveShadow = true;

      const tower = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, b.height - 14, d * 0.86), facadeMat);
      tower.position.y = 8 + (b.height - 14) / 2;
      tower.castShadow = true;

      const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 6, d * 0.62), trimSteelMat);
      crown.position.y = b.height - 3;

      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.45, 9, 8),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.85 })
      );
      spire.position.y = b.height + 4.5;

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.2 })
      );
      beacon.position.y = b.height + 9.2;
      beaconMeshes.push(beacon);

      grp.add(podium, tower, crown, spire, beacon);
    } else if (b.id === 'village_temple') {
      // Surya Mandir Indian Temple: Plinth + Sanctum + Stepped Shikhara + Kalash + Saffron Flag
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), terraMat);
      plinth.position.y = 1.1;
      const sanctum = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 7.5, d * 0.72), terraMat);
      sanctum.position.y = 5.95;
      sanctum.castShadow = true;
      const shikhara1 = new THREE.Mesh(
        new THREE.ConeGeometry(w * 0.42, 9, 4),
        new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.65, metalness: 0.1 })
      );
      shikhara1.rotation.y = Math.PI / 4;
      shikhara1.position.y = 14.2;
      const kalash = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.9 })
      );
      kalash.position.y = 19.2;
      const flag = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1.1, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.4 })
      );
      flag.position.set(1.2, 21, 0);
      grp.add(plinth, sanctum, shikhara1, kalash, flag);
    } else if (b.district === 'village') {
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, b.height * 0.7, d), terraMat);
      walls.position.y = b.height * 0.35;
      walls.castShadow = true;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.72, b.height * 0.55, 4),
        new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85 })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = b.height * 0.92;
      grp.add(walls, roof);
    } else if (b.id === 'hospital_main') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(w, b.height, d),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.1 })
      );
      base.position.y = b.height / 2;
      base.castShadow = true;
      const crossMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 0.8 });
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.2, 0.4), crossMat);
      crossV.position.set(0, b.height * 0.65, d / 2 + 0.2);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.6, 0.4), crossMat);
      crossH.position.copy(crossV.position);
      const helipad = new THREE.Mesh(
        new THREE.CylinderGeometry(6, 6, 0.25, 20),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
      );
      helipad.position.y = b.height + 0.15;
      grp.add(base, crossV, crossH, helipad);
    } else if (b.id === 'police_hq') {
      const hq = new THREE.Mesh(
        new THREE.BoxGeometry(w, b.height, d),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 })
      );
      hq.position.y = b.height / 2;
      hq.castShadow = true;
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.2, 1.6, d + 0.2),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35 })
      );
      stripe.position.y = b.height - 2.2;
      const sirenBeacon = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.3, 1.4, 12),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 2.2 })
      );
      sirenBeacon.position.y = b.height + 0.7;
      beaconMeshes.push(sirenBeacon);
      grp.add(hq, stripe, sirenBeacon);
    } else if (b.id === 'mall_main') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, b.height, d),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4, metalness: 0.2 })
      );
      body.position.y = b.height / 2;
      body.castShadow = true;
      const atrium = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.32, w * 0.38, 4.5, 16),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.8 })
      );
      atrium.position.y = b.height + 2.2;
      const neonBand = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.3, 0.9, d + 0.3),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.5 })
      );
      neonBand.position.y = 4.6;
      grp.add(body, atrium, neonBand);
    } else if (b.id === 'garage_bldg') {
      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(w, b.height, d),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.4 })
      );
      shell.position.y = b.height / 2;
      shell.castShadow = true;
      const neonRoof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.4, 0.8, d + 0.4),
        new THREE.MeshStandardMaterial({ color: 0xea580c, emissive: 0xf97316, emissiveIntensity: 1.4 })
      );
      neonRoof.position.y = b.height;
      grp.add(shell, neonRoof);
    } else if (b.id === 'parking_deck') {
      // Underground Parking Roof canopy + 4 grounded concrete support columns + P sign
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(w, 1.2, d),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 })
      );
      canopy.position.y = 4.8;
      canopy.castShadow = true;
      const colMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      [
        [-w * 0.44, -d * 0.42],
        [w * 0.44, -d * 0.42],
        [-w * 0.44, d * 0.42],
        [w * 0.44, d * 0.42],
      ].forEach(([px, pz]) => {
        const col = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8.2, 1.4), colMat);
        col.position.set(px, 0.9, pz);
        col.castShadow = true;
        grp.add(col);
      });
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 2.2, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x3b82f6, emissiveIntensity: 1.5 })
      );
      sign.position.set(0, 6.2, -d / 2);
      grp.add(canopy, sign);
    } else if (b.id === 'airport_tower') {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(2.6, 3.8, b.height - 4, 12),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 })
      );
      shaft.position.y = (b.height - 4) / 2;
      shaft.castShadow = true;
      const cab = new THREE.Mesh(
        new THREE.CylinderGeometry(5.6, 4.2, 4.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.15, metalness: 0.8 })
      );
      cab.position.y = b.height - 2;
      const radar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 0.6), trimSteelMat);
      radar.position.y = b.height + 1.2;
      grp.add(shaft, cab, radar);
    } else if (b.id === 'airport_hangar') {
      const hangar = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.45, w * 0.45, d, 16, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.6 })
      );
      hangar.rotation.z = Math.PI / 2;
      hangar.rotation.y = Math.PI / 2;
      hangar.position.y = 0;
      hangar.castShadow = true;
      grp.add(hangar);
    } else {
      // Residential Villas
      const house = new THREE.Mesh(
        new THREE.BoxGeometry(w, b.height * 0.75, d),
        new THREE.MeshStandardMaterial({ color: 0xfef2f2, roughness: 0.7 })
      );
      house.position.y = b.height * 0.375;
      house.castShadow = true;
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 1.2, 1.4, d + 1.2),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 })
      );
      roof.position.y = b.height * 0.78;
      grp.add(house, roof);
    }

    worldGroup.add(grp);
  }

  // 6. Parked Static Airliner Jet on Airport Apron (x=155, z=126)
  const jetGroup = new THREE.Group();
  jetGroup.position.set(155, 1.6, 124);
  jetGroup.rotation.y = -Math.PI / 2;
  const jetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.5 });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 15, 14), jetMat);
  fuselage.rotation.x = Math.PI / 2;
  const wings = new THREE.Mesh(new THREE.BoxGeometry(16, 0.25, 3.2), jetMat);
  const tailWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 3.6, 2.4),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 })
  );
  tailWing.position.set(0, 2.1, -6.5);
  jetGroup.add(fuselage, wings, tailWing);
  worldGroup.add(jetGroup);

  // 7. Instanced Palm & Neem Trees across Beach, Village, and Boulevards
  const treeSpots: Array<{ x: number; z: number; scale: number; isPalm: boolean }> = [];
  for (let x = -210; x <= 210; x += 28) {
    if (Math.abs(x) < 18) continue;
    treeSpots.push({ x, z: 146, scale: 0.85 + (Math.abs(x) % 5) * 0.08, isPalm: true });
    if (x < -30) {
      treeSpots.push({ x, z: -138, scale: 0.9 + (Math.abs(x) % 4) * 0.09, isPalm: false });
      treeSpots.push({ x, z: -20, scale: 0.95, isPalm: false });
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 4.6, 8);
  trunkGeo.translate(0, 2.3, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6c4c33, roughness: 0.9 });
  const canopyGeo = new THREE.DodecahedronGeometry(2.3, 0);
  canopyGeo.translate(0, 5.4, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.82 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treeSpots.length);
  trunkInst.castShadow = true;
  canopyInst.castShadow = true;
  const dummy = new THREE.Object3D();
  const cTint = new THREE.Color();

  treeSpots.forEach((spot, i) => {
    const gy = groundHeightAt(spot.x, spot.z);
    dummy.position.set(spot.x, gy, spot.z);
    dummy.rotation.y = i * 1.1;
    dummy.scale.set(spot.scale, spot.isPalm ? spot.scale * 1.35 : spot.scale, spot.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    canopyInst.setMatrixAt(i, dummy.matrix);
    cTint.setHex(spot.isPalm ? 0x40916c : 0x2d6a4f).offsetHSL(0, 0, ((i % 5) - 2) * 0.03);
    canopyInst.setColorAt(i, cTint);
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  worldGroup.add(trunkInst, canopyInst);

  // 8. Instanced Streetlights along Central Boulevard & Highway
  const lampPositions: Array<{ x: number; z: number }> = [];
  for (let z = -140; z <= 120; z += 34) {
    lampPositions.push({ x: -10, z }, { x: 10, z });
  }
  const poleGeo = new THREE.CylinderGeometry(0.11, 0.15, 5.6, 6);
  poleGeo.translate(0, 2.8, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.7 });
  const bulbGeo = new THREE.BoxGeometry(0.65, 0.22, 0.65);
  bulbGeo.translate(0, 5.65, 0);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 1.4 });

  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
  const bulbInst = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPositions.length);
  lampPositions.forEach((p, i) => {
    dummy.position.set(p.x, groundHeightAt(p.x, p.z), p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(i, dummy.matrix);
    bulbInst.setMatrixAt(i, dummy.matrix);
  });
  poleInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  bulbInst.computeBoundingSphere();
  worldGroup.add(poleInst, bulbInst);

  // 9. Interactable World Ring Markers (Garage, Boutique, Mission Board, Hospital, Police)
  const interactMarkers: THREE.Mesh[] = [];
  const markerCoords = [
    { x: 82, z: 22, color: 0xf97316 },
    { x: 24, z: 24, color: 0xec4899 },
    { x: 42, z: -20, color: 0xfacc15 },
    { x: 150, z: 12, color: 0x22c55e },
    { x: 118, z: -85, color: 0x3b82f6 },
  ];
  for (const m of markerCoords) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.18, 8, 24),
      new THREE.MeshStandardMaterial({
        color: m.color,
        emissive: m.color,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(m.x, 0.22, m.z);
    worldGroup.add(ring);
    interactMarkers.push(ring);
  }

  return { waterMesh, beaconMeshes, interactMarkers };
}
