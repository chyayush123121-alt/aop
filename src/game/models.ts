import * as THREE from 'three';
import type { VehicleType } from './types';

export interface HumanRig {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  torso: THREE.Mesh;
  shirtMat: THREE.MeshStandardMaterial;
  pantsMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  batMesh: THREE.Mesh;
  blasterMesh: THREE.Group;
}

export function buildHumanModel(options: {
  skinColor: string;
  shirtColor: string;
  pantsColor: string;
  accentColor: string;
  hairColor: string;
  contactShadowTex: THREE.Texture;
  isPolice?: boolean;
  scale?: number;
  withWeapons?: boolean;
}): HumanRig {
  const group = new THREE.Group();
  const scale = options.scale ?? 1;

  // Ground contact shadow disc (bottom-center grounded)
  const shadowMat = new THREE.MeshBasicMaterial({
    map: options.contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowDisc = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  const skinMat = new THREE.MeshStandardMaterial({ color: options.skinColor, roughness: 0.68, metalness: 0.02 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: options.shirtColor, roughness: 0.78, metalness: 0.05 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: options.pantsColor, roughness: 0.85, metalness: 0.04 });
  const accentMat = new THREE.MeshStandardMaterial({ color: options.accentColor, roughness: 0.35, metalness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ color: options.hairColor, roughness: 0.8, metalness: 0.05 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45, metalness: 0.2 });

  const bodyRoot = new THREE.Group();
  bodyRoot.scale.setScalar(scale);
  group.add(bodyRoot);

  // Legs (articulated from hip at y=0.82)
  const makeLeg = (xOff: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOff, 0.82, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pantsMat);
    thigh.position.y = -0.36;
    thigh.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.3), shoeMat);
    shoe.position.set(0, -0.76, 0.05);
    shoe.castShadow = true;
    legPivot.add(thigh, shoe);
    return legPivot;
  };

  const leftLeg = makeLeg(-0.13);
  const rightLeg = makeLeg(0.13);
  bodyRoot.add(leftLeg, rightLeg);

  // Torso + collar/belt trim (Secondary silhouette)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.26), shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  bodyRoot.add(torso);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.28), accentMat);
  belt.position.y = 0.88;
  bodyRoot.add(belt);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.28), accentMat);
  collar.position.y = 1.44;
  bodyRoot.add(collar);

  // Head + Hair/Cap
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.31, 0.29), skinMat);
  head.position.y = 1.64;
  head.castShadow = true;
  bodyRoot.add(head);

  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.31, 0.12, 0.31),
    options.isPolice ? new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4, metalness: 0.2 }) : hairMat
  );
  hair.position.set(0, 1.79, -0.01);
  bodyRoot.add(hair);

  if (options.isPolice) {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.04, 0.14), shoeMat);
    visor.position.set(0, 1.74, 0.17);
    bodyRoot.add(visor);
  }

  // Arms
  const makeArm = (xOff: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOff, 1.4, 0);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.16), shirtMat);
    sleeve.position.y = -0.15;
    sleeve.castShadow = true;
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.14), skinMat);
    forearm.position.y = -0.42;
    forearm.castShadow = true;
    armPivot.add(sleeve, forearm);
    return armPivot;
  };

  const leftArm = makeArm(-0.33);
  const rightArm = makeArm(0.33);
  bodyRoot.add(leftArm, rightArm);

  // Weapons attached to right hand (toggled by visibility)
  const batMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.022, 0.78, 8),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.55, metalness: 0.1 })
  );
  batMesh.position.set(0, -0.54, 0.28);
  batMesh.rotation.x = Math.PI / 2.3;
  batMesh.visible = false;
  if (options.withWeapons) rightArm.add(batMesh);

  const blasterMesh = new THREE.Group();
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.1, 0.36),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.85 })
  );
  const muzzleGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.8 })
  );
  muzzleGlow.position.z = 0.2;
  blasterMesh.add(barrel, muzzleGlow);
  blasterMesh.position.set(0, -0.5, 0.22);
  blasterMesh.visible = false;
  if (options.withWeapons) rightArm.add(blasterMesh);

  return {
    group,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    torso,
    shirtMat,
    pantsMat,
    accentMat,
    batMesh,
    blasterMesh,
  };
}

export interface VehicleRig {
  group: THREE.Group;
  bodyMat: THREE.MeshPhysicalMaterial;
  wheels: THREE.Object3D[];
  rotor?: THREE.Object3D;
  tailRotor?: THREE.Object3D;
  sirenBar?: THREE.Mesh;
}

export function buildVehicleModel(
  type: VehicleType,
  paintHex: string,
  contactShadowTex: THREE.Texture
): VehicleRig {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: paintHex,
    roughness: 0.24,
    metalness: 0.65,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.85,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.25,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.9,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.9,
  });
  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  // Ground contact shadow
  const shadowSize = type === 'bus' || type === 'truck' ? [3.4, 7.6] : type === 'motorcycle' || type === 'scooter' ? [1.3, 2.5] : [2.8, 5.2];
  const shadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(shadowSize[0], shadowSize[1]),
    new THREE.MeshBasicMaterial({ map: contactShadowTex, transparent: true, depthWrite: false, opacity: 0.55 })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.025;
  group.add(shadowDisc);

  const makeWheel = (radius: number, width: number, x: number, y: number, z: number) => {
    const wGroup = new THREE.Group();
    wGroup.position.set(x, y, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 12), rimMat);
    rim.rotation.z = Math.PI / 2;
    wGroup.add(tire, rim);
    group.add(wGroup);
    wheels.push(wGroup);
    return wGroup;
  };

  if (type === 'helicopter') {
    // 1. Primary fuselage hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.35, 3.8), bodyMat);
    hull.position.set(0, 1.35, 0.2);
    hull.castShadow = true;
    // 2. Nose canopy glass
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.95, 1.35), glassMat);
    nose.position.set(0, 1.38, 2.25);
    nose.rotation.x = 0.25;
    // 3. Tail boom + fin
    const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 3.2), bodyMat);
    tailBoom.position.set(0, 1.45, -2.9);
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.7), trimMat);
    tailFin.position.set(0, 1.9, -4.3);
    // 4. Landing skids
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.6), trimMat);
    skidL.position.set(-0.95, 0.12, 0.2);
    const skidR = skidL.clone();
    skidR.position.x = 0.95;
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.65, 0.1), trimMat);
    strutL.position.set(-0.9, 0.45, 0.9);
    const strutL2 = strutL.clone();
    strutL2.position.z = -0.6;
    const strutR = strutL.clone();
    strutR.position.x = 0.9;
    const strutR2 = strutL2.clone();
    strutR2.position.x = 0.9;
    // 5. Main Rotor Mast & Blades
    const rotor = new THREE.Group();
    rotor.position.set(0, 2.22, 0.2);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.35, 10), rimMat);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.05, 0.24), trimMat);
    blade1.position.y = 0.14;
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 7.2), trimMat);
    blade2.position.y = 0.14;
    rotor.add(mast, blade1, blade2);

    const tailRotor = new THREE.Group();
    tailRotor.position.set(0.2, 2.0, -4.3);
    const tb1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.14), rimMat);
    tailRotor.add(tb1);

    group.add(hull, nose, tailBoom, tailFin, skidL, skidR, strutL, strutL2, strutR, strutR2, rotor, tailRotor);
    return { group, bodyMat, wheels, rotor, tailRotor };
  }

  if (type === 'boat') {
    // Sculpted V-hull speedboat
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.72, 4.7), bodyMat);
    hull.position.set(0, 0.46, 0);
    hull.castShadow = true;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.6, 4), bodyMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1.38, 1, 0.48);
    bow.position.set(0, 0.46, 2.95);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.14, 3.8), trimMat);
    deck.position.set(0, 0.84, -0.1);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.48, 0.55), glassMat);
    windshield.position.set(0, 1.05, 0.9);
    windshield.rotation.x = -0.35;
    const outboard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.75, 0.5), trimMat);
    outboard.position.set(0, 0.55, -2.55);
    group.add(hull, bow, deck, windshield, outboard);
    return { group, bodyMat, wheels };
  }

  if (type === 'motorcycle' || type === 'scooter') {
    const isScooter = type === 'scooter';
    const wRad = isScooter ? 0.28 : 0.36;
    makeWheel(wRad, 0.16, 0, wRad, isScooter ? 0.68 : 0.82);
    makeWheel(wRad, 0.18, 0, wRad, isScooter ? -0.68 : -0.82);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(isScooter ? 0.44 : 0.36, isScooter ? 0.48 : 0.42, isScooter ? 1.45 : 1.55),
      bodyMat
    );
    frame.position.set(0, wRad + 0.26, 0);
    frame.castShadow = true;

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.72), trimMat);
    seat.position.set(0, wRad + 0.5, -0.22);

    const frontColumn = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.24), bodyMat);
    frontColumn.position.set(0, wRad + 0.56, isScooter ? 0.54 : 0.62);
    frontColumn.rotation.x = -0.25;

    const handlebar = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.12), rimMat);
    handlebar.position.set(0, wRad + 0.86, isScooter ? 0.48 : 0.56);

    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.08), headLightMat);
    headlight.position.set(0, wRad + 0.65, isScooter ? 0.68 : 0.78);

    const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.08), tailLightMat);
    tailLight.position.set(0, wRad + 0.45, isScooter ? -0.78 : -0.84);

    group.add(frame, seat, frontColumn, handlebar, headlight, tailLight);
    return { group, bodyMat, wheels };
  }

  // 4-Wheeled Land Vehicles (Supercar, Sports Car, SUV, Truck, Bus, Police Car)
  const isSupercar = type === 'supercar';
  const isSUV = type === 'suv';
  const isTruck = type === 'truck';
  const isBus = type === 'bus';
  const isPolice = type === 'police_car';

  const bodyW = isTruck || isBus ? 2.3 : isSUV ? 2.05 : 1.92;
  const bodyL = isBus ? 7.0 : isTruck ? 6.1 : isSUV ? 4.65 : 4.35;
  const wheelR = isTruck || isBus ? 0.48 : isSUV ? 0.42 : 0.35;
  const axleZ = bodyL * 0.32;
  const axleX = bodyW * 0.49;

  makeWheel(wheelR, 0.28, -axleX, wheelR, axleZ);
  makeWheel(wheelR, 0.28, axleX, wheelR, axleZ);
  makeWheel(wheelR, 0.28, -axleX, wheelR, -axleZ);
  makeWheel(wheelR, 0.28, axleX, wheelR, -axleZ);

  // Lower chassis skirt
  const lowerH = isBus ? 1.55 : isTruck ? 0.75 : isSUV ? 0.72 : 0.54;
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(bodyW, lowerH, bodyL), bodyMat);
  chassis.position.set(0, wheelR + lowerH * 0.45, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  if (isBus) {
    // Classic double-band windows & roof AC units
    const winBand = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.03, 0.72, bodyL - 0.5), glassMat);
    winBand.position.set(0, wheelR + 1.45, 0.1);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.15, 0.2, bodyL - 0.3), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }));
    roof.position.set(0, wheelR + 2.02, 0);
    group.add(winBand, roof);
  } else if (isTruck) {
    // Truck cab + painted cargo container
    const cab = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.08, 1.35, 1.85), bodyMat);
    cab.position.set(0, wheelR + 1.25, bodyL * 0.28);
    cab.castShadow = true;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.24, 0.62, 0.12), glassMat);
    windshield.position.set(0, wheelR + 1.45, bodyL * 0.28 + 0.9);
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW, 1.85, 3.85),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.7, metalness: 0.15 })
    );
    cargo.position.set(0, wheelR + 1.5, -1.05);
    cargo.castShadow = true;
    group.add(cab, windshield, cargo);
  } else {
    // Car / SUV / Police / Supercar Cabin
    const cabH = isSUV ? 0.68 : isSupercar ? 0.42 : 0.52;
    const cabL = isSUV ? 2.65 : 2.15;
    const cabZ = isSupercar ? -0.15 : -0.1;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.24, cabH, cabL), isPolice ? new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 }) : bodyMat);
    cabin.position.set(0, wheelR + lowerH + cabH * 0.35, cabZ);
    cabin.castShadow = true;

    const glassWrap = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.2, cabH * 0.72, cabL + 0.08), glassMat);
    glassWrap.position.copy(cabin.position);
    group.add(cabin, glassWrap);

    if (isSupercar) {
      // Carbon rear wing & splitter
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.1, 0.08, 0.35), trimMat);
      spoiler.position.set(0, wheelR + lowerH + 0.32, -bodyL * 0.45);
      const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.18), trimMat);
      pylonL.position.set(-0.55, wheelR + lowerH + 0.18, -bodyL * 0.45);
      const pylonR = pylonL.clone();
      pylonR.position.x = 0.55;
      group.add(spoiler, pylonL, pylonR);
    }
  }

  // Bumpers, Headlights, Taillights
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.06, 0.2, 0.22), trimMat);
  frontBumper.position.set(0, wheelR + 0.1, bodyL * 0.5);
  const rearBumper = frontBumper.clone();
  rearBumper.position.z = -bodyL * 0.5;
  group.add(frontBumper, rearBumper);

  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), headLightMat);
  hlL.position.set(-bodyW * 0.33, wheelR + 0.38, bodyL * 0.5 + 0.02);
  const hlR = hlL.clone();
  hlR.position.x = bodyW * 0.33;
  const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.08), tailLightMat);
  tlL.position.set(-bodyW * 0.33, wheelR + 0.4, -bodyL * 0.5 - 0.02);
  const tlR = tlL.clone();
  tlR.position.x = bodyW * 0.33;
  group.add(hlL, hlR, tlL, tlR);

  let sirenBar: THREE.Mesh | undefined;
  if (isPolice) {
    sirenBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 2.2 })
    );
    sirenBar.position.set(0, wheelR + lowerH + 0.68, -0.05);
    group.add(sirenBar);
  }

  return { group, bodyMat, wheels, sirenBar };
}
