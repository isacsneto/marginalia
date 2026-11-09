import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageInfo } from '../lib/covers.js';

test('imageInfo lê dimensões de PNG, GIF, JPEG e WebP', () => {
  const png = Buffer.alloc(32);
  png[0] = 0x89; png.write('PNG', 1, 'ascii'); png.writeUInt32BE(300, 16); png.writeUInt32BE(450, 20);
  assert.deepEqual(imageInfo(png), { ext: 'png', w: 300, h: 450 });

  const gif = Buffer.alloc(32);
  gif.write('GIF89a', 0, 'ascii'); gif.writeUInt16LE(120, 6); gif.writeUInt16LE(180, 8);
  assert.deepEqual(imageInfo(gif), { ext: 'gif', w: 120, h: 180 });

  // JPEG mínimo: SOI, um segmento APP0 e um SOF0 com altura 500 e largura 333.
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xf4, 0x01, 0x4d, ...Array(20).fill(0)]);
  assert.deepEqual(imageInfo(jpg), { ext: 'jpg', h: 500, w: 333 });

  const webp = Buffer.alloc(40);
  webp.write('RIFF', 0, 'ascii'); webp.write('WEBP', 8, 'ascii'); webp.write('VP8X', 12, 'ascii');
  webp.writeUIntLE(671, 24, 3); webp.writeUIntLE(959, 27, 3);
  assert.deepEqual(imageInfo(webp), { ext: 'webp', w: 672, h: 960 });

  assert.equal(imageInfo(Buffer.from('não é imagem, só texto qualquer aqui')), null);
});
