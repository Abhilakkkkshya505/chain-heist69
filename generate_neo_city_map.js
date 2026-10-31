import fs from 'fs';
import path from 'path';

const W = 120; // 120 tiles * 16px = 1920px
const H = 72;  // 72 tiles * 16px = 1152px

const collisionData = new Array(W * H).fill(0);

function fillBlocked(x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) {
        collisionData[y * W + x] = 1;
      }
    }
  }
}

function clearWalkable(x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) {
        collisionData[y * W + x] = 0;
      }
    }
  }
}

// 1. Perimeter borders (3 tiles thick solid border)
fillBlocked(0, 0, W - 1, 2);
fillBlocked(0, H - 3, W - 1, H - 1);
fillBlocked(0, 0, 2, H - 1);
fillBlocked(W - 3, 0, W - 1, H - 1);

// 2. City District (Left: cols 3..42)
fillBlocked(3, 3, 18, 18);
fillBlocked(23, 3, 36, 18);
fillBlocked(3, 22, 18, 33);
fillBlocked(23, 22, 36, 26);
fillBlocked(3, 40, 18, 68);
// Block the central city building complex & rooftop completely
fillBlocked(23, 30, 36, 55);
fillBlocked(23, 58, 36, 68);

// 3. Central Jungle / Mountains (Middle: cols 43..78)
fillBlocked(43, 3, 56, 24);
fillBlocked(62, 3, 78, 24);
fillBlocked(43, 48, 56, 68);
fillBlocked(62, 48, 78, 69);

// 4. Wasteland / Refinery (Top Right: cols 79..116)
fillBlocked(79, 3, 93, 20);
fillBlocked(102, 3, 116, 20);
fillBlocked(79, 21, 93, 34);
fillBlocked(102, 21, 116, 34);

// 5. Dock / Cargo Yard (Bottom Right: cols 79..116)
fillBlocked(102, 36, 116, 52);
fillBlocked(79, 42, 95, 54);
fillBlocked(79, 60, 95, 68);
fillBlocked(104, 54, 116, 68);

// 6. Walkways & Open Corridors
clearWalkable(56, 26, 64, 46); // Central jungle clearing
clearWalkable(37, 24, 78, 30); // Main gateway connecting City to Jungle
clearWalkable(2, 26, 42, 30);  // City main street
clearWalkable(18, 26, 22, 68); // Data Hub street
clearWalkable(37, 26, 42, 68); // Lower market street
clearWalkable(14, 54, 22, 60); // Chain Snake Portal area
clearWalkable(94, 10, 101, 24); // Block Flyer Portal area
clearWalkable(96, 36, 103, 65); // Vault Run Portal area

let nextObjId = 1;
function makeObj(layerData) {
  return {
    id: nextObjId++,
    rotation: 0,
    visible: true,
    ...layerData
  };
}

// 7. Object Layers
const playerSpawnObject = makeObj({
  name: 'player_spawn',
  type: '',
  x: 960,
  y: 640,
  width: 64,
  height: 64
});

const reviveLocationObject = makeObj({
  name: 'revive_location',
  type: '',
  x: 960,
  y: 640,
  width: 64,
  height: 64
});

const areaMetadataObject = makeObj({
  name: 'area_metadata',
  type: 'area_metadata',
  x: 960,
  y: 640,
  width: 64,
  height: 64,
  properties: [
    { name: 'faint_location', type: 'string', value: 'building_1' },
    { name: 'id', type: 'int', value: 0 }
  ]
});

const cameraBoundsObject = makeObj({
  name: 'camera_bounds',
  type: 'cameraBounds',
  x: 0,
  y: 1152,
  width: 1920,
  height: 1152,
  properties: [
    { name: 'id', type: 'int', value: 1 }
  ]
});

const signs = [
  makeObj({
    name: 'sign_1',
    type: 'sign',
    x: 896,
    y: 640,
    width: 64,
    height: 64,
    properties: [{ name: 'id', type: 'int', value: 10 }]
  }),
  makeObj({
    name: 'sign_2',
    type: 'sign',
    x: 320,
    y: 896,
    width: 64,
    height: 64,
    properties: [{ name: 'id', type: 'int', value: 11 }]
  }),
  makeObj({
    name: 'sign_3',
    type: 'sign',
    x: 1536,
    y: 320,
    width: 64,
    height: 64,
    properties: [{ name: 'id', type: 'int', value: 12 }]
  })
];

const portals = [
  makeObj({
    name: 'chainSnake',
    type: 'portal',
    x: 256,
    y: 896,
    width: 64,
    height: 64,
    properties: [{ name: 'game', type: 'string', value: 'chainSnake' }]
  }),
  makeObj({
    name: 'blockFlyer',
    type: 'portal',
    x: 1536,
    y: 192,
    width: 64,
    height: 64,
    properties: [{ name: 'game', type: 'string', value: 'blockFlyer' }]
  }),
  makeObj({
    name: 'vaultRun',
    type: 'portal',
    x: 1600,
    y: 960,
    width: 64,
    height: 64,
    properties: [{ name: 'game', type: 'string', value: 'vaultRun' }]
  })
];

const npcConfigs = [
  { id: 1, x: 320, y: 512 },
  { id: 2, x: 640, y: 768 },
  { id: 3, x: 704, y: 448 },
  { id: 4, x: 1536, y: 640 },
  { id: 5, x: 1600, y: 832 }
];

const npcLayers = npcConfigs.map((npc, idx) => ({
  draworder: 'topdown',
  id: 100 + idx,
  name: `NPC${idx + 1}`,
  objects: [
    makeObj({
      name: 'npc',
      type: 'npc',
      x: npc.x,
      y: npc.y,
      width: 64,
      height: 64,
      properties: [
        { name: 'id', type: 'int', value: npc.id },
        { name: 'movement_pattern', type: 'string', value: 'IDLE' }
      ]
    })
  ],
  opacity: 1,
  type: 'objectgroup',
  visible: true,
  x: 0,
  y: 0
}));

const tokens = [
  { x: 192, y: 320 },
  { x: 384, y: 192 },
  { x: 512, y: 896 },
  { x: 832, y: 448 },
  { x: 1088, y: 704 },
  { x: 1152, y: 384 },
  { x: 1344, y: 832 },
  { x: 1472, y: 448 },
  { x: 1728, y: 256 },
  { x: 1792, y: 896 }
].map((pos, idx) => makeObj({
  name: `token_${idx + 1}`,
  type: 'token',
  point: true,
  x: pos.x,
  y: pos.y,
  width: 0,
  height: 0
}));

const coins = [
  { x: 320, y: 576 },
  { x: 448, y: 576 },
  { x: 576, y: 576 },
  { x: 704, y: 576 },
  { x: 832, y: 576 },
  { x: 960, y: 512 },
  { x: 960, y: 640 },
  { x: 1088, y: 576 },
  { x: 1216, y: 576 },
  { x: 1344, y: 576 },
  { x: 1472, y: 576 },
  { x: 1600, y: 576 },
  { x: 320, y: 704 },
  { x: 1472, y: 704 },
  { x: 1600, y: 384 }
].map((pos, idx) => makeObj({
  name: `coin_${idx + 1}`,
  type: 'coin',
  point: true,
  x: pos.x,
  y: pos.y,
  width: 0,
  height: 0
}));

// Build Full Tiled Map JSON
const neoCityMapJson = {
  compressionlevel: -1,
  height: H,
  width: W,
  infinite: false,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tileheight: 16,
  tilewidth: 16,
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.0',
  nextlayerid: 200,
  nextobjectid: nextObjId + 10,
  tilesets: [
    {
      columns: 4,
      firstgid: 1,
      image: '../images/monster-tamer/map/collision.png',
      imageheight: 64,
      imagewidth: 64,
      margin: 0,
      name: 'collision',
      spacing: 0,
      tilecount: 16,
      tileheight: 16,
      tilewidth: 16
    }
  ],
  layers: [
    {
      id: 1,
      image: '../images/bithunter/maps/neo-city.png',
      name: 'Background',
      opacity: 1,
      type: 'imagelayer',
      visible: true,
      x: 0,
      y: 0
    },
    {
      data: collisionData,
      height: H,
      width: W,
      id: 2,
      name: 'Collision',
      opacity: 0.5,
      type: 'tilelayer',
      visible: false,
      x: 0,
      y: 0
    },
    {
      draworder: 'topdown',
      id: 3,
      name: 'Player-Spawn-Location',
      objects: [playerSpawnObject],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    },
    {
      draworder: 'topdown',
      id: 4,
      name: 'Revive-Location',
      objects: [reviveLocationObject],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    },
    {
      draworder: 'topdown',
      id: 5,
      name: 'Area-Metadata',
      objects: [areaMetadataObject],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    },
    {
      draworder: 'topdown',
      id: 6,
      name: 'Camera-Bounds',
      objects: [cameraBoundsObject],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    },
    {
      draworder: 'topdown',
      id: 7,
      name: 'Sign',
      objects: signs,
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    },
    {
      id: 8,
      name: 'NPC',
      opacity: 1,
      type: 'group',
      visible: true,
      x: 0,
      y: 0,
      layers: npcLayers
    },
    {
      draworder: 'topdown',
      id: 9,
      name: 'Portals',
      objects: portals,
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    },
    {
      draworder: 'topdown',
      id: 10,
      name: 'Tokens',
      objects: tokens,
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    },
    {
      draworder: 'topdown',
      id: 11,
      name: 'Coins',
      objects: coins,
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    },
    {
      draworder: 'topdown',
      id: 12,
      name: 'Item',
      objects: [],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    },
    {
      draworder: 'topdown',
      id: 13,
      name: 'Events',
      objects: [],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    },
    {
      draworder: 'topdown',
      id: 14,
      name: 'Scene-Transitions',
      objects: [],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    }
  ]
};

// Write JSON
fs.writeFileSync('assets/data/neo-city.json', JSON.stringify(neoCityMapJson, null, 2));
console.log('Successfully wrote assets/data/neo-city.json');

// Build TMX XML
function xmlProps(props) {
  if (!props || props.length === 0) return '';
  let str = '  <properties>\n';
  for (const p of props) {
    str += `   <property name="${p.name}" type="${p.type}" value="${p.value}"/>\n`;
  }
  str += '  </properties>\n';
  return str;
}

function xmlObj(obj) {
  const pointTag = obj.point ? '  <point/>\n' : '';
  const propTag = xmlProps(obj.properties);
  return `  <object id="${obj.id}" name="${obj.name}" type="${obj.type}" x="${obj.x}" y="${obj.y}" width="${obj.width || 0}" height="${obj.height || 0}">\n${pointTag}${propTag}  </object>\n`;
}

let tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.0" orientation="orthogonal" renderorder="right-down" width="${W}" height="${H}" tilewidth="16" tileheight="16" infinite="0" nextlayerid="200" nextobjectid="${nextObjId + 10}">
 <tileset firstgid="1" name="collision" tilewidth="16" tileheight="16" tilecount="16" columns="4">
  <image source="../images/monster-tamer/map/collision.png" width="64" height="64"/>
 </tileset>
 <imagelayer id="1" name="Background">
  <image source="../images/bithunter/maps/neo-city.png" width="1920" height="1152"/>
 </imagelayer>
 <layer id="2" name="Collision" width="${W}" height="${H}" opacity="0.5" visible="0">
  <data encoding="csv">
${collisionData.join(',')}
</data>
 </layer>
 <objectgroup id="3" name="Player-Spawn-Location">
${xmlObj(playerSpawnObject)} </objectgroup>
 <objectgroup id="4" name="Revive-Location">
${xmlObj(reviveLocationObject)} </objectgroup>
 <objectgroup id="5" name="Area-Metadata">
${xmlObj(areaMetadataObject)} </objectgroup>
 <objectgroup id="6" name="Camera-Bounds">
${xmlObj(cameraBoundsObject)} </objectgroup>
 <objectgroup id="7" name="Sign">
${signs.map(xmlObj).join('')} </objectgroup>
 <group id="8" name="NPC">
${npcLayers.map(nl => `  <objectgroup id="${nl.id}" name="${nl.name}">\n${nl.objects.map(xmlObj).join('')}  </objectgroup>\n`).join('')} </group>
 <objectgroup id="9" name="Portals">
${portals.map(xmlObj).join('')} </objectgroup>
 <objectgroup id="10" name="Tokens">
${tokens.map(xmlObj).join('')} </objectgroup>
 <objectgroup id="11" name="Coins">
${coins.map(xmlObj).join('')} </objectgroup>
 <objectgroup id="12" name="Item"/>
 <objectgroup id="13" name="Events"/>
 <objectgroup id="14" name="Scene-Transitions"/>
</map>`;

fs.writeFileSync('assets/data/neo-city.tmx', tmx);
console.log('Successfully wrote assets/data/neo-city.tmx');

