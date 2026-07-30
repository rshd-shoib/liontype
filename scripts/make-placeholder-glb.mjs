// Generates src/assets/models/lion.glb — a minimal, valid GLB placeholder.
// It contains a single 3-vertex mesh, which LionAvatar.js detects (verts <= 100)
// and replaces with the procedural neon lion. Drop a real lion.glb over this
// file and the loader will use it automatically.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const out = resolve(import.meta.dirname, '../src/assets/models/lion.glb');
mkdirSync(dirname(out), { recursive: true });

const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const bin = Buffer.from(positions.buffer);
const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);

const gltf = {
  asset: { version: '2.0', generator: 'LionType placeholder' },
  scene: 0,
  scenes: [{ name: 'lion-placeholder', nodes: [0] }],
  nodes: [{ name: 'LionPlaceholder', mesh: 0 }],
  meshes: [{ name: 'placeholder', primitives: [{ attributes: { POSITION: 0 } }] }],
  accessors: [{
    bufferView: 0,
    componentType: 5126, // FLOAT
    count: 3,
    type: 'VEC3',
    min: [0, 0, 0],
    max: [1, 1, 0],
  }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
  buffers: [{ byteLength: binPadded.length }],
};

const json = Buffer.from(JSON.stringify(gltf), 'utf8');
const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);

const chunk = (data, type) => {
  const head = Buffer.alloc(8);
  head.writeUInt32LE(data.length, 0);
  head.writeUInt32LE(type, 4);
  return Buffer.concat([head, data]);
};

const jsonChunk = chunk(jsonPadded, 0x4e4f534a); // 'JSON'
const binChunk = chunk(binPadded, 0x004e4942); // 'BIN\0'

const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + jsonChunk.length + binChunk.length, 8);

writeFileSync(out, Buffer.concat([header, jsonChunk, binChunk]));
console.log(`wrote ${out}`);
