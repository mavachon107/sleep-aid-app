// Génère icon-192.png et icon-512.png à partir d'un dessin minimal (lune sur fond sombre).
// Pas de dépendances externes — utilise zlib + écriture PNG manuelle.

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function makePng(size) {
  const w = size, h = size;
  // RGBA, blanc sur transparent : on dessine fond sombre + lune dorée.
  const px = Buffer.alloc(w * h * 4);
  const bg = [10, 10, 10, 255];
  const moon = [212, 165, 90, 255];
  const cx = w * 0.62, cy = h * 0.45;
  const r1 = w * 0.30;
  const cx2 = w * 0.74, cy2 = h * 0.36;
  const r2 = w * 0.27;
  const stars = [
    [0.31, 0.35, 0.006], [0.39, 0.27, 0.004], [0.23, 0.47, 0.004],
    [0.70, 0.20, 0.004], [0.82, 0.35, 0.006], [0.33, 0.74, 0.004],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      px[o]=bg[0]; px[o+1]=bg[1]; px[o+2]=bg[2]; px[o+3]=bg[3];
      const dx1 = x - cx, dy1 = y - cy;
      const dx2 = x - cx2, dy2 = y - cy2;
      const inMoon = dx1*dx1 + dy1*dy1 <= r1*r1;
      const inBite = dx2*dx2 + dy2*dy2 <= r2*r2;
      if (inMoon && !inBite) {
        px[o]=moon[0]; px[o+1]=moon[1]; px[o+2]=moon[2]; px[o+3]=moon[3];
      }
      for (const [sx, sy, sr] of stars) {
        const px2 = sx*w, py2 = sy*h, pr2 = sr*w*w;
        const ddx = x-px2, ddy = y-py2;
        if (ddx*ddx + ddy*ddy <= pr2) {
          px[o]=moon[0]; px[o+1]=moon[1]; px[o+2]=moon[2]; px[o+3]=200;
        }
      }
    }
  }
  // Filtres PNG : 0 par scanline.
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    px.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

writeFileSync(new URL("../icons/icon-192.png", import.meta.url), makePng(192));
writeFileSync(new URL("../icons/icon-512.png", import.meta.url), makePng(512));
console.log("Icônes PNG générées : 192, 512");
