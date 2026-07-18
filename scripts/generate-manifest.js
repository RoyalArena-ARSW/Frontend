const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'public', 'assets');
const OUT = path.join(ASSETS, 'manifest.json');

/** chr_knight_sprite_359.png -> 359. Ordena los frames por su número. */
const frameNumber = (file) => {
  const m = file.match(/(\d+)(?=\.[^.]+$)/);
  return m ? parseInt(m[1], 10) : 0;
};

const byFrame = (a, b) => frameNumber(a) - frameNumber(b);

/** Escapa cada segmento: "Baby Dragon" -> "Baby%20Dragon" */
const toUrl = (segments) => '/assets/' + segments.map(encodeURIComponent).join('/');

/**
 * Recorre las carpetas y espeja su estructura en JSON.
 * - Carpeta con solo PNGs  -> array de URLs (es una animación)
 * - Carpeta con subcarpetas -> objeto (y el PNG suelto es la carta)
 */
function walk(dir, urlPath) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.filter(e => e.isFile() && /\.png$/i.test(e.name)).map(e => e.name);
  const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  if (subdirs.length === 0) {
    return files.sort(byFrame).map(f => toUrl([...urlPath, f]));
  }

  const node = {};
  if (files.length === 1) {
    node.card = toUrl([...urlPath, files[0]]);        // carta de presentación
  } else if (files.length > 1) {
    node.images = files.sort(byFrame).map(f => toUrl([...urlPath, f]));
  }
  for (const sub of subdirs) {
    node[sub] = walk(path.join(dir, sub), [...urlPath, sub]);
  }
  return node;
}

const manifest = {};
for (const entry of fs.readdirSync(ASSETS, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  manifest[entry.name] = walk(path.join(ASSETS, entry.name), [entry.name]);
}

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
console.log('✅ manifest.json generado');