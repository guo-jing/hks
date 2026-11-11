// Original articulated fantasy models. All geometry is local and generated once
// per actor; materials are shared within each Babylon scene.
const B = globalThis.BABYLON;
const TAU = Math.PI * 2;
const materialCache = new WeakMap();
const colors = [
  { steel: '#567d92', deep: '#1a3548', cloth: '#204968', gold: '#ceb47b', light: '#69e2ff' },
  { steel: '#996577', deep: '#432c41', cloth: '#742e4b', gold: '#d4ad80', light: '#ff719c' }
];

function material(scene, color, shine = .4, emission = 0) {
  let cache = materialCache.get(scene);
  if (!cache) { cache = new Map(); materialCache.set(scene, cache); }
  const key = `${color}/${shine}/${emission}`;
  if (!cache.has(key)) {
    const m = new B.StandardMaterial(`model-${key}`, scene);
    m.diffuseColor = B.Color3.FromHexString(color);
    m.specularColor = new B.Color3(shine, shine * .96, shine * .88);
    m.specularPower = 22 + shine * 80;
    m.emissiveColor = m.diffuseColor.scale(emission);
    m.backFaceCulling = false;
    cache.set(key, m);
  }
  return cache.get(key);
}
function node(parent, name, x = 0, y = 0, z = 0) {
  const n = new B.TransformNode(name, parent.getScene());
  n.parent = parent; n.position.set(x, y, z); return n;
}
function finish(mesh, parent, mat, x = 0, y = 0, z = 0) {
  mesh.parent = parent; mesh.material = mat; mesh.position.set(x, y, z);
  mesh.receiveShadows = true; return mesh;
}
function sphere(parent, name, x, y, z, sx, sy, sz, mat, segments = 12) {
  const o = B.MeshBuilder.CreateSphere(name, { diameter: 2, segments }, parent.getScene());
  o.scaling.set(sx, sy, sz); return finish(o, parent, mat, x, y, z);
}
function cylinder(parent, name, x, y, z, bottom, top, height, mat, tessellation = 16) {
  return finish(B.MeshBuilder.CreateCylinder(name, { diameterBottom: bottom * 2, diameterTop: top * 2, height, tessellation }, parent.getScene()), parent, mat, x, y, z);
}
function tube(parent, name, points, radius, mat, tessellation = 8) {
  return finish(B.MeshBuilder.CreateTube(name, { path: points.map(p => new B.Vector3(...p)), radius, tessellation }, parent.getScene()), parent, mat);
}
function torus(parent, name, x, y, z, radius, thickness, mat) {
  return finish(B.MeshBuilder.CreateTorus(name, { diameter: radius * 2, thickness, tessellation: 48 }, parent.getScene()), parent, mat, x, y, z);
}

// Elliptical cross sections give armor a sculpted waist, chest and tapered edges.
// ring = [height, half width, half depth, forward offset].
function shell(parent, name, rings, mat, sides = 12) {
  const positions = [], indices = [], normals = [], uvs = [];
  for (let r = 0; r < rings.length; r++) {
    const [y, rx, rz, oz = 0] = rings[r];
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * TAU;
      positions.push(Math.sin(a) * rx, y, Math.cos(a) * rz + oz);
      uvs.push(i / sides, r / (rings.length - 1));
      if (r && i < sides) {
        const a0 = (r - 1) * (sides + 1) + i, b = r * (sides + 1) + i;
        indices.push(a0, b, a0 + 1, a0 + 1, b, b + 1);
      }
    }
  }
  const bottom = positions.length / 3;
  positions.push(0, rings[0][0], rings[0][3] || 0); uvs.push(.5, .5);
  const top = positions.length / 3, last = rings.at(-1);
  positions.push(0, last[0], last[3] || 0); uvs.push(.5, .5);
  for (let i = 0; i < sides; i++) {
    indices.push(bottom, i, i + 1);
    const k = (rings.length - 1) * (sides + 1) + i;
    indices.push(top, k + 1, k);
  }
  B.VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new B.Mesh(name, parent.getScene()), data = new B.VertexData();
  Object.assign(data, { positions, indices, normals, uvs }); data.applyToMesh(mesh);
  return finish(mesh, parent, mat);
}

// A bevel around an original polygon catches light on blades and armor plates.
function plate(parent, name, outline, depth, mat, x = 0, y = 0, z = 0, bevel = .1) {
  const positions = [], indices = [], normals = [], n = outline.length;
  const center = outline.reduce((p, v) => [p[0] + v[0] / n, p[1] + v[1] / n], [0, 0]);
  for (const [scale, zz] of [[1 - bevel, -depth / 2], [1, -depth * .24], [1, depth * .24], [1 - bevel, depth / 2]]) {
    for (const p of outline) positions.push(center[0] + (p[0] - center[0]) * scale, center[1] + (p[1] - center[1]) * scale, zz);
  }
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = layer * n, b = (layer + 1) * n;
    indices.push(a + i, a + j, b + i, a + j, b + j, b + i);
  }
  for (let i = 1; i < n - 1; i++) indices.push(0, i + 1, i, 3 * n, 3 * n + i, 3 * n + i + 1);
  B.VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new B.Mesh(name, parent.getScene()), data = new B.VertexData();
  Object.assign(data, { positions, indices, normals }); data.applyToMesh(mesh);
  return finish(mesh, parent, mat, x, y, z);
}
function diamond(parent, name, x, y, z, width, height, depth, mat) {
  const o = B.MeshBuilder.CreatePolyhedron(name, { type: 1, size: 1 }, parent.getScene());
  o.scaling.set(width, height, depth); return finish(o, parent, mat, x, y, z);
}
function cape(parent, width, length, mat, trim) {
  const n = node(parent, 'flowing-mantle', 0, 76, -8), positions = [], indices = [], normals = [];
  const cols = 12, rows = 8;
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    const u = c / cols, v = r / rows;
    positions.push((u - .5) * width * (.65 + v * .6), -v * length + Math.sin(u * Math.PI * 3) * v * 2, -v * 10 + Math.cos(u * Math.PI * 6) * (1 + v * 2.5));
    if (r < rows && c < cols) { const i = r * (cols + 1) + c; indices.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1); }
  }
  B.VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new B.Mesh('folded-cloth', parent.getScene()), data = new B.VertexData();
  Object.assign(data, { positions, indices, normals }); data.applyToMesh(mesh); finish(mesh, n, mat);
  for (const side of [-1, 1]) tube(n, 'embroidered-cape-edge', Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [side * width / 2 * (.65 + t * .6), -t * length, -t * 10 + 1 + t * 2.5]; }), .65, trim, 6);
  return n;
}
function sword(parent, mat, heavy = false) {
  const n = node(parent, heavy ? 'runic-greatsword' : 'runic-sword');
  const width = heavy ? 9 : 6, length = heavy ? 65 : 50;
  cylinder(n, 'leather-grip', 0, -5, 0, 2.6, 2.6, 13, mat.leather, 10);
  for (let y = -10; y <= 0; y += 3) torus(n, 'grip-binding', 0, y, 0, 2.6, .65, mat.gold);
  diamond(n, 'pommel', 0, -14, 0, 3.7, 4.5, 3, mat.gold);
  plate(n, 'swept-crossguard', [[-17, -1], [-13, 5], [0, 7], [13, 5], [17, -1], [10, 1], [0, 3], [-10, 1]], 5, mat.gold, 0, 1, 0);
  plate(n, 'beveled-blade', [[-width, 7], [-width * .88, length - 12], [0, length], [width * .88, length - 12], [width, 7]], 4, mat.silver, 0, 0, 0, .22);
  plate(n, 'blade-fuller', [[-1.2, 10], [-1, length - 13], [0, length - 5], [1, length - 13], [1.2, 10]], .6, mat.glow, 0, 0, 2.1, .1);
  diamond(n, 'guard-jewel', 0, 5, 3, 3, 4, 1.5, mat.glow);
  return n;
}

function heroMaterials(scene, role, team) {
  const p = colors[team];
  return {
    armor: material(scene, p.steel, .72), deep: material(scene, p.deep, .5),
    gold: material(scene, p.gold, .8), silver: material(scene, '#c7dbe2', .85),
    leather: material(scene, '#28333e', .12), skin: material(scene, '#d5b697', .12),
    hair: material(scene, team ? '#493039' : '#b8bfbd', .25),
    cloth: material(scene, role === 'mage' ? (team ? '#643b67' : '#514c86') : role === 'support' ? (team ? '#907084' : '#8fa9ad') : p.cloth, .13),
    glow: material(scene, p.light, .5, .8), dark: material(scene, '#132331', .15)
  };
}

export function createHeroModel(scene, role = 'fighter', team = 0) {
  const root = new B.TransformNode(`${role}-${team}`, scene), body = node(root, 'articulated-body');
  const m = heroMaterials(scene, role, team), legs = [], arms = [];
  const armored = role === 'fighter' || role === 'guardian', robed = role === 'mage' || role === 'support';
  const weight = role === 'guardian' ? 1.17 : role === 'archer' ? .86 : 1;

  for (const side of [-1, 1]) {
    const leg = node(body, 'hip-joint', side * 8 * weight, 41, 0); legs.push(leg);
    shell(leg, 'fitted-thigh', [[0, 6.2, 6], [-4, 6.9, 6.2], [-17, 4.4, 4.5], [-21, 4.2, 4.2]], m.leather);
    sphere(leg, 'knee-joint', 0, -22, .5, 4.6, 4.6, 4.6, m.deep);
    const shin = shell(leg, 'sculpted-greave', [[-21, 4.8, 4.3, 1], [-24, 5.7, 5.3, 1], [-33, 4, 4, .5], [-36, 4.2, 4.5]], armored ? m.armor : m.deep);
    plate(shin, 'greave-inlay', [[-2.7, -22], [0, -20], [2.7, -22], [1.8, -33], [0, -36], [-1.8, -33]], 1, m.gold, 0, 0, 5.7);
    sphere(leg, 'pointed-armored-boot', 0, -36.8, 3.8, 5.7, 4.2, 9.4, m.deep);
    plate(leg, 'knee-shield', [[-5, 2], [0, 5], [5, 2], [3, -4], [0, -6], [-3, -4]], 3, m.gold, 0, -21, 5);
  }

  if (robed) {
    shell(body, 'flowing-layered-robe', [[8, 20, 13, -1], [12, 21, 14, -1], [26, 17, 11, 0], [43, 10, 8, 0], [46, 10, 8]], m.cloth, 16);
    shell(body, 'embroidered-robe-hem', [[9, 20.5, 13.5, -1], [12, 21.5, 14.5, -1], [14, 20.7, 14, -1]], m.gold, 16);
    for (const side of [-1, 1]) {
      const panel = plate(body, 'split-robe-front', [[side * 1, 43], [side * 9, 44], [side * 18, 12], [side * 5, 9]], 1.4, m.deep, 0, 0, 10);
      panel.rotation.y = side * -.12;
      tube(body, 'robe-gold-piping', [[side * 5, 10, 11.2], [side * 7, 23, 10.5], [side * 2, 43, 9.5]], .7, m.gold);
    }
  }
  shell(body, 'cuirass', [[42, 10 * weight, 7.8], [48, 11 * weight, 8.5], [60, 16 * weight, 10.1], [69, 16.7 * weight, 9], [73, 11, 7]], armored ? m.armor : m.cloth, 16);
  shell(body, 'waist-belt', [[41, 11.4 * weight, 8.4], [44, 11.7 * weight, 8.8], [46, 11.1 * weight, 8.2]], m.gold);
  for (const side of [-1, 1]) {
    const chest = plate(body, 'swept-breastplate', [[side * 1, 48], [side * 13, 55], [side * 16, 66], [side * 7, 71], [side * 1, 65]], 4, armored ? m.silver : m.deep, 0, 0, 8.5);
    chest.rotation.y = side * -.22;
    tube(body, 'chest-filigree', [[side * 2, 50, 12], [side * 11, 57, 12], [side * 13, 65, 10]], .8, m.gold);
    if (!robed) {
      const skirt = plate(body, 'layered-hip-guard', [[-7, 0], [5, 2], [9, -14], [0, -18], [-9, -11]], 3, m.armor, side * 10, 43, 6);
      skirt.rotation.z = side * .18;
      tube(skirt, 'hip-trim', [[-7, -9, 2], [0, -15, 2], [7, -12, 2]], .8, m.gold);
    }
  }
  diamond(body, 'heart-sigil', 0, 61, 13, 3.5, 5, 2.4, m.glow);
  plate(body, 'belt-buckle', [[-4, 3], [4, 3], [5, -2], [0, -5], [-5, -2]], 3, m.gold, 0, 43, 10);
  const mantle = cape(body, role === 'guardian' ? 36 : 30, role === 'archer' ? 43 : 60, m.cloth, m.gold);

  for (const side of [-1, 1]) {
    const arm = node(body, 'shoulder-joint', side * 18 * weight, 69, 0); arms.push(arm);
    sphere(arm, 'shoulder-joint-cover', 0, -2, 0, 6.5, 7, 6.5, m.deep);
    const pauldron = shell(arm, 'sculpted-pauldron', [[-7, 8.5 * weight, 8], [-3, 11 * weight, 10], [3, 10 * weight, 9], [7, 5.5, 6]], armored ? m.armor : m.deep, 10);
    pauldron.rotation.z = side * -.18;
    shell(pauldron, 'pauldron-gold-rim', [[-7.4, 8.8 * weight, 8.3], [-5.8, 9.6 * weight, 8.8], [-4.6, 10 * weight, 9]], m.gold, 10);
    if (armored) {
      const fin = plate(arm, 'winged-shoulder-crest', [[-5, 1], [2, 10], [13, 15], [10, 4], [5, -3]], 3, m.silver, side * 4, 4, -2);
      fin.scaling.x = side;
    }
    shell(arm, 'upper-arm', [[-6, 5.3, 5], [-10, 5.6, 5], [-20, 4, 4]], m.deep);
    sphere(arm, 'elbow', 0, -21, .8, 4.5, 4.5, 4.5, m.gold);
    shell(arm, 'vambrace', [[-20, 5.2, 4.8, 1], [-23, 6, 5.8, 1], [-31, 4.2, 4, 1], [-33, 3.9, 3.7, 1]], armored ? m.armor : m.deep);
    plate(arm, 'gauntlet-inlay', [[-2, -22], [2, -22], [3, -29], [0, -33], [-3, -29]], 1, m.gold, 0, 0, 6.6);
    sphere(arm, 'gloved-hand', 0, -36, 2, 4, 4.6, 4.8, m.leather);
    arm.rotation.z = side * .08;
  }

  cylinder(body, 'neck', 0, 76, 0, 4.7, 4.4, 8, m.skin);
  shell(body, 'gorget', [[72, 8.5, 7], [75, 9.5, 8], [77, 7, 6]], m.gold);
  sphere(body, 'face', 0, 86, 1.2, 7.2, 9.5, 7.1, m.skin, 16);
  plate(body, 'sculpted-nose', [[-1.2, 1.8], [1.2, 1.8], [1.8, -2.2], [-1.8, -2.2]], 3, m.skin, 0, 85, 7);
  for (const side of [-1, 1]) {
    sphere(body, 'eye-shadow', side * 3.3, 87.3, 7.3, 2.4, 1.1, .6, m.dark, 8);
    sphere(body, 'bright-eye', side * 3.4, 87.2, 7.8, 1.1, .65, .35, m.glow, 8);
  }
  if (armored) {
    shell(body, 'forged-helmet', [[82, 7.7, 6.5, -1], [89, 8.7, 7.3, -1], [95, 6.2, 5.4, -1], [98, 1, 1, -1]], m.armor, 12);
    for (const side of [-1, 1]) {
      const cheek = plate(body, 'helmet-cheek-guard', [[side * 3, 80], [side * 7, 78], [side * 9, 89], [side * 6, 92], [side * 4, 86]], 2, m.gold, 0, 0, 6.5);
      cheek.rotation.y = side * -.2;
      tube(body, 'helmet-brow', [[side * .8, 90, 7.5], [side * 5, 91, 7.8], [side * 8, 89.5, 5]], 1.2, m.silver);
    }
    plate(body, 'helmet-center-crest', [[-1.5, 0], [-2, 10], [0, 18], [2, 10], [1.5, 0]], 3, m.gold, 0, 93, -1);
    if (role === 'guardian') for (const side of [-1, 1]) {
      tube(body, 'sweeping-helmet-horn', [[side * 7, 92, -2], [side * 14, 95, -3], [side * 18, 103, -5], [side * 18, 108, -8]], 2.5, m.silver);
      diamond(body, 'horn-tip', side * 18, 108, -8, 1.9, 4, 1.9, m.gold);
    }
  } else if (role === 'archer') {
    shell(body, 'ranger-hood', [[78, 8.4, 6.8, -3], [87, 10, 8, -2.5], [95, 8, 7, -2], [101, 3, 4, -4], [103, .8, 1, -5]], m.cloth, 14);
    for (const side of [-1, 1]) tube(body, 'hood-gold-seam', [[side * 6, 79, 5], [side * 8.5, 87, 5.6], [side * 6.5, 94, 5], [0, 99, 1]], .65, m.gold);
  } else {
    shell(body, 'swept-hair', [[79, 7, 5, -4], [89, 8.4, 7.5, -1.8], [94, 6.6, 6, -1], [97, 2, 2, -2]], m.hair, 14);
    for (const side of [-1, 1]) {
      const hair = plate(body, 'hair-lock', [[0, 12], [5, 8], [4, -13], [0, -20], [-2, -7]], 3, m.hair, side * 6, 85, 1);
      hair.rotation.z = -side * .17;
      diamond(body, 'circlet-wing', side * 7, 93, 3, 2.4, 7, 2, m.gold);
    }
    tube(body, 'circlet', [[-7, 91, 3], [-4, 92, 7], [0, 91, 8], [4, 92, 7], [7, 91, 3]], 1, m.gold);
    diamond(body, 'circlet-jewel', 0, 91, 8.5, 2, 3.7, 1, m.glow);
  }

  if (role === 'fighter') {
    const blade = sword(arms[1], m, true); blade.position.set(0, -35, 5); blade.rotation.set(.19, .12, -.2);
    // The off hand carries a small articulated buckler instead of another block.
    const buckler = sphere(arms[0], 'forearm-buckler', -1, -25, 7, 9, 12, 3, m.armor);
    diamond(buckler, 'buckler-sigil', 0, 0, 1, .25, .35, .3, m.gold);
  } else if (role === 'guardian') {
    const shield = node(arms[0], 'tower-shield', -2, -21, 10);
    const outline = [[-17, 23], [0, 29], [17, 23], [19, 5], [13, -20], [0, -31], [-13, -20], [-19, 5]];
    plate(shield, 'shield-beveled-rim', outline, 6, m.gold);
    plate(shield, 'shield-face', outline.map(([x, y]) => [x * .84, y * .84]), 5, m.deep, 0, 0, 3.3);
    for (const side of [-1, 1]) plate(shield, 'shield-wings', [[side * 2, 14], [side * 12, 18], [side * 10, -7], [side * 3, -17]], 2, m.armor, 0, 0, 6.2);
    diamond(shield, 'shield-crystal', 0, 1, 8, 4.5, 9, 2.3, m.glow);
    const weapon = sword(arms[1], m); weapon.position.set(0, -35, 5); weapon.rotation.z = -.28;
  } else if (role === 'archer') {
    const bow = node(arms[0], 'crescent-longbow', 0, -31, 8);
    tube(bow, 'bow-limb', [[0, -36, 0], [-8, -29, 2], [-13, -14, 3], [-7, 0, 4], [-13, 14, 3], [-8, 29, 2], [0, 36, 0]], 2.4, m.gold);
    tube(bow, 'bow-inlay', [[-1, -33, 1], [-7, -27, 3], [-11, -14, 4], [-6, 0, 5], [-11, 14, 4], [-7, 27, 3], [-1, 33, 1]], .7, m.glow);
    tube(bow, 'bowstring', [[0, -36, 0], [4, 0, 0], [0, 36, 0]], .35, m.silver, 6);
    const arrow = node(arms[1], 'nocked-arrow', -10, -32, 7); arrow.rotation.z = Math.PI / 2;
    cylinder(arrow, 'arrow-shaft', 0, 0, 0, .65, .65, 37, m.gold, 6);
    diamond(arrow, 'arrow-tip', 0, 22, 0, 2.5, 5.5, 1, m.silver);
    const quiver = node(body, 'leather-quiver', 5, 61, -14); quiver.rotation.z = -.2;
    cylinder(quiver, 'quiver', 0, -5, 0, 5.7, 7, 29, m.leather, 12);
    cylinder(quiver, 'quiver-mouth', 0, 9, 0, 7.3, 7.3, 3, m.gold, 12);
    for (let i = 0; i < 4; i++) {
      const x = -4.5 + i * 3;
      cylinder(quiver, 'spare-arrow', x, 15 + i % 2 * 3, 0, .6, .6, 30, m.gold, 6);
      plate(quiver, 'arrow-fletching', [[-2.5, 0], [0, 6], [2.5, 0], [0, -2]], 1, m.silver, x, 29 + i % 2 * 3, 0);
    }
  } else {
    const staff = node(arms[1], 'celestial-staff', 0, -35, 5);
    cylinder(staff, 'staff-shaft', 0, 24, 0, 1.9, 1.5, 82, m.gold, 12);
    cylinder(staff, 'staff-grip', 0, 3, 0, 2.3, 2.3, 17, m.deep, 12);
    for (const yy of [13, 45, 51]) cylinder(staff, 'staff-collar', 0, yy, 0, 3.3, 3.3, 2, m.gold, 12);
    const spell = material(scene, role === 'support' ? '#8af5c9' : team ? '#ffaf83' : '#b6a3ff', .6, .8);
    diamond(staff, 'levitating-staff-crystal', 0, 64, 0, 7, 11, 6, spell);
    for (const side of [-1, 1]) tube(staff, 'crescent-prong', [[side * 2, 48, 0], [side * 11, 56, 0], [side * 13, 69, 0], [side * 7, 79, 0]], 1.7, m.gold);
    if (role === 'mage') {
      for (const side of [-1, 1]) {
        const collar = plate(body, 'high-arcane-collar', [[0, 0], [7, -8], [12, 8], [8, 22], [1, 13]], 3, m.deep, side * 7, 75, -4);
        collar.scaling.x = side; collar.rotation.y = side * -.4;
        tube(collar, 'collar-trim', [[7, -7, 2], [11, 8, 2], [8, 20, 2], [2, 13, 2]], .8, m.gold);
      }
      const orb = sphere(arms[0], 'arcane-focus', 0, -30, 10, 5, 5, 5, spell);
      const orbit = torus(orb, 'arcane-orbit', 0, 0, 0, 1.7, .12, m.gold); orbit.rotation.x = .8;
    } else {
      const halo = torus(body, 'radiant-halo', 0, 103, -3, 14, 1.7, m.gold); halo.rotation.x = .5;
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
        const feather = plate(body, 'guardian-feather', [[0, 0], [4, 7], [6, 23 + i * 2], [2, 28 + i * 2], [-1, 17]], 2, i % 2 ? m.gold : m.silver, side * (10 + i * 4), 60 - i * 2, -13);
        feather.rotation.z = side * (-.3 - i * .2); feather.rotation.y = side * .3;
      }
    }
  }

  const shieldMat = new B.StandardMaterial('temporary-energy-shield', scene);
  shieldMat.diffuseColor = B.Color3.FromHexString('#80daff'); shieldMat.emissiveColor = B.Color3.FromHexString('#214e77');
  shieldMat.alpha = .16; shieldMat.specularPower = 80; shieldMat.backFaceCulling = true;
  const shield = sphere(root, 'energy-shield', 0, 53, 0, 42, 60, 36, shieldMat, 16);
  shield.isPickable = false; shield.setEnabled(false); shield.metadata = { ignorePick: true, disposeMaterial: true };
  root.metadata = { body, legs, arms, cape: mantle, shield, height: role === 'support' || role === 'guardian' ? 125 : 116 };
  return root;
}

export function animateHero(root, unit, time) {
  const d = root.metadata;
  if (!d?.body) return;
  d.body.rotation.y = Math.PI / 2 - unit.face;
  d.body.position.y = Math.sin(unit.walk || 0) * .9;
  for (let i = 0; i < (d.legs?.length || 0); i++) d.legs[i].rotation.x = Math.sin((unit.walk || 0) + i * Math.PI) * .33;
  const swing = unit.attackAnim > 0 ? Math.sin(Math.min(1, unit.attackAnim / .28) * Math.PI) : 0;
  for (let i = 0; i < (d.arms?.length || 0); i++) {
    d.arms[i].rotation.x = i === 1 ? -swing * 1.25 : swing * .35;
    d.arms[i].rotation.x += Math.sin((unit.walk || 0) + i * Math.PI) * .1;
  }
  if (d.cape) { d.cape.rotation.x = -.05 + Math.sin(time * 2.6 + (unit.id || 0)) * .045; d.cape.rotation.z = Math.sin(time * 1.4 + (unit.id || 0)) * .025; }
  if (d.shield) d.shield.setEnabled(unit.shield > 0);
}

export function createMinionModel(scene, caster, team) {
  const root = new B.TransformNode(`${caster ? 'caster' : 'soldier'}-${team}`, scene), body = node(root, 'minion-body');
  const m = heroMaterials(scene, 'fighter', team);
  for (const side of [-1, 1]) {
    sphere(body, 'minion-boot', side * 4.6, 4, 2, 4, 4, 6, m.deep, 8);
    cylinder(body, 'minion-leg', side * 4.6, 11, 0, 3, 3.5, 12, m.deep, 8);
    sphere(body, 'minion-pauldron', side * 12, 27, 0, 6, 6, 6, m.armor, 8);
    cylinder(body, 'minion-arm', side * 12, 20, 1, 3, 4, 11, m.deep, 8);
    sphere(body, 'minion-glove', side * 12, 14, 2, 3.2, 3.2, 3.2, m.gold, 8);
  }
  shell(body, 'minion-armor', [[12, 8, 6], [15, 9, 7], [26, 10.5, 7.5], [31, 7, 5]], m.armor, 10);
  cylinder(body, 'minion-belt', 0, 15, 0, 8.5, 8.5, 2, m.gold, 10);
  shell(body, 'minion-helmet', [[30, 8, 6], [38, 9, 7], [44, 6, 5], [47, .8, .8]], m.deep, 10);
  plate(body, 'minion-visor', [[-7, 1], [7, 1], [6, -2], [-6, -2]], 1.5, m.gold, 0, 37, 6.5);
  for (const side of [-1, 1]) sphere(body, 'minion-eye', side * 3, 36.5, 7.5, 1.8, .7, .5, m.glow, 8);
  if (caster) {
    shell(body, 'caster-skirt', [[5, 11, 8], [8, 10, 7], [18, 7, 5]], m.cloth, 10);
    cylinder(body, 'minion-staff', 13, 29, 4, 1, 1, 39, m.gold, 8);
    diamond(body, 'minion-spell-focus', 13, 51, 4, 4, 7, 4, m.glow);
  } else {
    const blade = sword(body, m); blade.scaling.setAll(.45); blade.position.set(13, 16, 5); blade.rotation.z = -.15;
    plate(body, 'minion-shield', [[-7, 8], [7, 8], [6, -6], [0, -11], [-6, -6]], 3, m.gold, -13, 20, 5);
    plate(body, 'minion-shield-face', [[-5, 6], [5, 6], [4, -4], [0, -8], [-4, -4]], 1.5, m.armor, -13, 20, 7);
  }
  root.metadata = { body, height: 65 };
  return root;
}

export function createStructureModel(scene, kind, team) {
  const root = new B.TransformNode(`${kind}-${team}`, scene), m = heroMaterials(scene, 'fighter', team);
  const stone = material(scene, '#52687b', .3), dark = material(scene, '#293e52', .3), snow = material(scene, '#bdced6', .18);
  const tower = kind === 'tower', radius = tower ? 43 : 64;
  cylinder(root, 'foundation', 0, 2, 0, radius + 14, radius + 10, 9, dark, 8);
  cylinder(root, 'foundation-gold-band', 0, 8, 0, radius + 10, radius + 8, 4, m.gold, 8);
  cylinder(root, 'chamfered-stone-base', 0, 16, 0, radius + 8, radius - 2, 12, stone, 8);
  cylinder(root, 'base-step', 0, 24, 0, radius - 2, radius - 2, 6, dark, 8);
  if (tower) {
    shell(root, 'octagonal-tower', [[26, 31, 31], [32, 29, 29], [68, 25, 25], [102, 29, 29], [110, 32, 32]], dark, 8);
    for (let i = 0; i < 4; i++) {
      const buttress = node(root, 'ornate-buttress'); buttress.rotation.y = i * Math.PI / 2;
      plate(buttress, 'carved-pillar', [[-7, 29], [7, 29], [6, 86], [12, 108], [-12, 108], [-6, 86]], 12, stone, 0, 0, 27);
      plate(buttress, 'pillar-inlay', [[-2, 38], [2, 38], [2, 88], [0, 99], [-2, 88]], 1, m.gold, 0, 0, 33.5);
      diamond(buttress, 'warding-rune', 0, 65, 34.5, 3, 8, 1.5, m.glow);
      cylinder(buttress, 'buttress-cap', 0, 107, 27, 10, 10, 5, m.gold, 8);
    }
    cylinder(root, 'upper-cornice', 0, 113, 0, 30, 43, 12, m.gold, 8);
    cylinder(root, 'crown-platform', 0, 122, 0, 43, 40, 8, stone, 8);
    cylinder(root, 'snow-crown', 0, 127, 0, 40, 38, 3, snow, 8);
    for (let i = 0; i < 4; i++) {
      const arm = node(root, 'crown-claw'); arm.rotation.y = Math.PI / 4 + i * Math.PI / 2;
      plate(arm, 'gold-crystal-claw', [[-5, 0], [5, 0], [4, 23], [0, 38], [-3, 22]], 7, m.gold, 0, 125, 29);
      diamond(arm, 'claw-crystal', 0, 137, 30, 2.2, 5, 2, m.glow);
    }
    const gem = diamond(root, 'floating-tower-crystal', 0, 158, 0, 19, 32, 19, m.glow);
    const orbit = torus(root, 'crystal-orbit', 0, 155, 0, 26, 1.2, m.gold); orbit.rotation.x = .35;
    root.metadata = { gem, gemBaseY: 158, height: 211 };
  } else {
    cylinder(root, 'nexus-dais', 0, 32, 0, 54, 46, 14, stone, 10);
    cylinder(root, 'nexus-gold-ring', 0, 40, 0, 47, 47, 3, m.gold, 10);
    const gem = diamond(root, 'nexus-heart', 0, 87, 0, 30, 53, 30, m.glow);
    for (let i = 0; i < 6; i++) {
      const n = node(root, 'nexus-outrigger'); n.rotation.y = i * TAU / 6;
      cylinder(n, 'outrigger-base', 0, 20, 58, 12, 9, 29, dark, 6);
      cylinder(n, 'outrigger-cap', 0, 35, 58, 10, 10, 4, m.gold, 6);
      diamond(n, 'satellite-crystal', 0, 52, 58, 8, 19, 8, m.glow);
      tube(n, 'nexus-conduit', [[0, 7, 58], [0, 7, 35], [0, 20, 20]], 1.5, m.glow);
    }
    const orbit = torus(root, 'nexus-orbit', 0, 74, 0, 44, 1.8, m.gold); orbit.rotation.z = .2;
    root.metadata = { gem, gemBaseY: 87, height: 163 };
  }
  return root;
}
