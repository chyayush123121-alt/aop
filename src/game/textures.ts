import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  buildingFacadeMap: THREE.CanvasTexture;
  terrainGrassMap: THREE.CanvasTexture;
  terracottaMap: THREE.CanvasTexture;
  waterBump: THREE.CanvasTexture;
  contactShadowTex: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  // 1. Asphalt Road Texture (with crisp lane dashes)
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 256;
  asphaltCanvas.height = 256;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#252930';
  actx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 30 + Math.floor(Math.random() * 24);
    actx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    actx.fillRect(x, y, 2, 2);
  }
  // Yellow center line & white edge lines
  actx.fillStyle = '#e9b949';
  actx.fillRect(125, 16, 6, 92);
  actx.fillRect(125, 144, 6, 92);
  actx.fillStyle = '#e2e8f0';
  actx.fillRect(8, 0, 5, 256);
  actx.fillRect(243, 0, 5, 256);

  const asphaltMap = new THREE.CanvasTexture(asphaltCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.anisotropy = aniso;

  // 2. Asphalt Micro-Relief Bump (linear space)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 128;
  bumpCanvas.height = 128;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1800; i++) {
    const g = 90 + Math.floor(Math.random() * 80);
    bctx.fillStyle = `rgb(${g},${g},${g})`;
    bctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const asphaltBump = new THREE.CanvasTexture(bumpCanvas);
  asphaltBump.wrapS = THREE.RepeatWrapping;
  asphaltBump.wrapT = THREE.RepeatWrapping;
  asphaltBump.anisotropy = aniso;

  // 3. Skyscraper Glass & Concrete Facade
  const facCanvas = document.createElement('canvas');
  facCanvas.width = 256;
  facCanvas.height = 512;
  const fctx = facCanvas.getContext('2d')!;
  fctx.fillStyle = '#334155';
  fctx.fillRect(0, 0, 256, 512);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 8; col++) {
      const lit = Math.random() > 0.38;
      fctx.fillStyle = lit
        ? Math.random() > 0.7 ? '#fef08a' : '#7dd3fc'
        : '#1e293b';
      fctx.fillRect(8 + col * 30, 8 + row * 31, 20, 20);
    }
  }
  const buildingFacadeMap = new THREE.CanvasTexture(facCanvas);
  buildingFacadeMap.colorSpace = THREE.SRGBColorSpace;
  buildingFacadeMap.wrapS = THREE.RepeatWrapping;
  buildingFacadeMap.wrapT = THREE.RepeatWrapping;
  buildingFacadeMap.anisotropy = aniso;

  // 4. Grass / Urban Ground Map
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const gctx = grassCanvas.getContext('2d')!;
  gctx.fillStyle = '#4f6d42';
  gctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const g = 75 + Math.floor(Math.random() * 45);
    gctx.fillStyle = `rgba(${g - 15}, ${g + 22}, ${g - 25}, 0.45)`;
    gctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
  }
  const terrainGrassMap = new THREE.CanvasTexture(grassCanvas);
  terrainGrassMap.colorSpace = THREE.SRGBColorSpace;
  terrainGrassMap.wrapS = THREE.RepeatWrapping;
  terrainGrassMap.wrapT = THREE.RepeatWrapping;
  terrainGrassMap.repeat.set(36, 36);
  terrainGrassMap.anisotropy = aniso;

  // 5. Terracotta / Sandstone Village Plaster
  const terraCanvas = document.createElement('canvas');
  terraCanvas.width = 256;
  terraCanvas.height = 256;
  const tctx = terraCanvas.getContext('2d')!;
  tctx.fillStyle = '#d9a066';
  tctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    tctx.fillStyle = Math.random() > 0.5 ? 'rgba(180,105,55,0.2)' : 'rgba(245,210,165,0.2)';
    tctx.fillRect(Math.random() * 256, Math.random() * 256, 6, 3);
  }
  const terracottaMap = new THREE.CanvasTexture(terraCanvas);
  terracottaMap.colorSpace = THREE.SRGBColorSpace;
  terracottaMap.wrapS = THREE.RepeatWrapping;
  terracottaMap.wrapT = THREE.RepeatWrapping;
  terracottaMap.anisotropy = aniso;

  // 6. Water Ripple Bump Map (linear)
  const wCanvas = document.createElement('canvas');
  wCanvas.width = 256;
  wCanvas.height = 256;
  const wctx = wCanvas.getContext('2d')!;
  wctx.fillStyle = '#808080';
  wctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 120; i++) {
    wctx.strokeStyle = i % 2 === 0 ? 'rgba(220,220,220,0.22)' : 'rgba(40,40,40,0.22)';
    wctx.lineWidth = 3;
    wctx.beginPath();
    const y = (i * 19) % 256;
    wctx.moveTo(0, y);
    wctx.bezierCurveTo(85, y + 10, 170, y - 10, 256, y);
    wctx.stroke();
  }
  const waterBump = new THREE.CanvasTexture(wCanvas);
  waterBump.wrapS = THREE.RepeatWrapping;
  waterBump.wrapT = THREE.RepeatWrapping;
  waterBump.repeat.set(16, 8);

  // 7. Radial Contact Shadow Disc
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 128;
  sCanvas.height = 128;
  const sctx = sCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.62)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.26)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const contactShadowTex = new THREE.CanvasTexture(sCanvas);

  return {
    asphaltMap,
    asphaltBump,
    buildingFacadeMap,
    terrainGrassMap,
    terracottaMap,
    waterBump,
    contactShadowTex,
    dispose: () => {
      asphaltMap.dispose();
      asphaltBump.dispose();
      buildingFacadeMap.dispose();
      terrainGrassMap.dispose();
      terracottaMap.dispose();
      waterBump.dispose();
      contactShadowTex.dispose();
    },
  };
}
