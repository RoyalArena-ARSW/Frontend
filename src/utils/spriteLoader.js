// Precarga y resolución de sprites del manifiesto (public/assets/manifest.json).
//
// El manifiesto real tiene mayúsculas inconsistentes entre cartas ("Walk" vs
// "walk", "Allied" vs "allied" según la carpeta original de cada asset), y
// algunos hechizos son directamente un array de frames sin envoltorio
// { card, effect }. Todo eso se normaliza UNA VEZ aquí (en buildSpriteIndex /
// preloadDeck), nunca dentro del loop de dibujo: ese solo hace Map.get +
// index de array + lookup en la caché de imágenes.

function normalizeKey(name) {
  return name.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function findKeyCI(obj, name) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const key = Object.keys(obj).find((k) => k.toLowerCase() === name);
  return key ? obj[key] : null;
}

function extractVariants(node) {
  const allied = findKeyCI(node, 'allied');
  const enemy = findKeyCI(node, 'enemy');
  return { allied: Array.isArray(allied) ? allied : [], enemy: Array.isArray(enemy) ? enemy : [] };
}

function resolveTroopOrBuilding(node, category) {
  const walkNode = findKeyCI(node, 'walk');
  const attackNode = findKeyCI(node, 'attack');
  // Los edificios (p. ej. Cannon) no separan walk/attack: allied/enemy están
  // directo en el nodo de la carta. Ese mismo array sirve para cualquier
  // estado de la unidad.
  const fallbackVariants = !walkNode && !attackNode ? extractVariants(node) : null;

  return {
    type: category === 'buildings' ? 'building' : 'troop',
    card: typeof node.card === 'string' ? node.card : null,
    walk: walkNode ? extractVariants(walkNode) : fallbackVariants,
    attack: attackNode ? extractVariants(attackNode) : fallbackVariants,
    effect: null,
  };
}

function resolveSpell(node) {
  if (Array.isArray(node)) {
    return { type: 'spell', card: null, walk: null, attack: null, effect: node };
  }
  const effectNode = findKeyCI(node, 'effect');
  return {
    type: 'spell',
    card: typeof node.card === 'string' ? node.card : null,
    walk: null,
    attack: null,
    effect: Array.isArray(effectNode) ? effectNode : [],
  };
}

/** Mapa normalizeKey(cardName) -> descriptor { type, card, walk, attack, effect }. */
export function buildSpriteIndex(manifest) {
  const index = new Map();
  if (!manifest) return index;

  for (const category of ['troops', 'buildings']) {
    const group = manifest[category];
    if (!group) continue;
    for (const [name, node] of Object.entries(group)) {
      index.set(normalizeKey(name), resolveTroopOrBuilding(node, category));
    }
  }

  const spellGroup = manifest.spells;
  if (spellGroup) {
    for (const [name, node] of Object.entries(spellGroup)) {
      index.set(normalizeKey(name), resolveSpell(node));
    }
  }

  return index;
}

const EMPTY_TOWER_VARIANT = { intact: null, destroyed: null, attack: [] };

function basenameOf(url) {
  return url.split('/').pop().toLowerCase();
}

/**
 * Cada variante (allied/enemy) de una torre trae { images: [...], attack: [...] }
 * — images mezcla intact.png/destroyed.png/<nombre>.png sueltos porque hay
 * más de un PNG suelto en la carpeta (ver generate-manifest.js). Se
 * distinguen por nombre de archivo, no por posición.
 */
function resolveTowerVariant(node) {
  if (!node) return EMPTY_TOWER_VARIANT;
  const images = Array.isArray(node.images) ? node.images : Array.isArray(node) ? node : [];
  const attack = Array.isArray(node.attack) ? node.attack : [];
  return {
    intact: images.find((u) => basenameOf(u) === 'intact.png') ?? null,
    destroyed: images.find((u) => basenameOf(u) === 'destroyed.png') ?? null,
    attack,
  };
}

function resolveTowerType(manifest, keyword) {
  const group = manifest?.towers;
  if (!group) return { allied: EMPTY_TOWER_VARIANT, enemy: EMPTY_TOWER_VARIANT };
  // Tolerante al orden/nombre exacto de la carpeta ("TowerKing", "kingTower",
  // "princessTower", etc.): solo exige que contenga la palabra clave.
  const entryKey = Object.keys(group).find((k) => k.toLowerCase().replace(/[^a-z]/g, '').includes(keyword));
  if (!entryKey) return { allied: EMPTY_TOWER_VARIANT, enemy: EMPTY_TOWER_VARIANT };
  const node = group[entryKey];
  const allied = findKeyCI(node, 'allied');
  const enemy = findKeyCI(node, 'enemy');
  return { allied: resolveTowerVariant(allied), enemy: resolveTowerVariant(enemy) };
}

/** { KING, PRINCESS_LEFT, PRINCESS_RIGHT } -> { allied, enemy } -> { intact, destroyed, attack }. */
export function buildTowerSpriteIndex(manifest) {
  const king = resolveTowerType(manifest, 'king');
  // Ambas torres princesa comparten sprite: no hay carpetas left/right.
  const princess = resolveTowerType(manifest, 'princess');
  return {
    KING: king,
    PRINCESS_LEFT: princess,
    PRINCESS_RIGHT: princess,
  };
}

const imageCache = new Map(); // url -> { image, loaded, failed, promise }

/**
 * Carga (o devuelve de caché) una imagen. Nunca rechaza: si falla (404),
 * loguea una advertencia y resuelve null, para que quien la pida caiga al
 * dibujo geométrico de respaldo en vez de tumbar la partida.
 */
export function loadImage(url) {
  const existing = imageCache.get(url);
  if (existing) return existing.promise;

  const img = new Image();
  const entry = { image: img, loaded: false, failed: false, promise: null };
  entry.promise = new Promise((resolve) => {
    img.onload = () => {
      entry.loaded = true;
      resolve(img);
    };
    img.onerror = () => {
      entry.failed = true;
      console.warn(`No se pudo cargar el sprite: ${url}`);
      resolve(null);
    };
  });
  imageCache.set(url, entry);
  img.src = url;
  return entry.promise;
}

/** Acceso síncrono para el loop de dibujo: null si aún no cargó o falló. */
export function getImage(url) {
  const entry = imageCache.get(url);
  return entry?.loaded ? entry.image : null;
}

/**
 * Como getImage, pero si esa URL nunca se pidió, dispara su carga en segundo
 * plano (una sola vez: loadImage cachea la entrada antes de que termine la
 * descarga, así que llamadas repetidas por la misma URL no reintentan nada).
 * Red de seguridad para sprites que el mazo propio no precargó — p. ej. una
 * carta del rival que no está en mi mazo — sin bloquear el frame actual: se
 * sigue devolviendo null (y se cae al respaldo geométrico) hasta que la
 * imagen quede lista en un frame posterior.
 */
export function ensureImage(url) {
  if (!imageCache.has(url)) {
    loadImage(url);
  }
  return getImage(url);
}

/**
 * Recorta el margen transparente de una imagen: escanea su canal alfa y
 * devuelve el rectángulo (en píxeles de la imagen fuente) que contiene todo
 * el contenido no transparente. Pensado para fondos como la arena, cuyo PNG
 * puede traer un padding transparente enorme horneado en el archivo — un
 * simple "estirar la imagen completa al canvas" deja ese padding visible
 * como huecos. Devuelve null si la imagen es opaca de borde a borde (no
 * hace falta recortar) o si no se pudo escanear.
 */
export function computeOpaqueBounds(img, alphaThreshold = 10) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch (err) {
    console.warn('No se pudo leer los píxeles para recortar el fondo de la arena:', err);
    return null;
  }

  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  const step = 4; // muestreo: no hace falta escanear cada píxel para hallar el borde

  for (let y = 0; y < h; y += step) {
    const rowOffset = y * w * 4;
    for (let x = 0; x < w; x += step) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return null; // todo transparente: no hay nada que recortar
  if (minX === 0 && minY === 0 && maxX >= w - step && maxY >= h - step) return null; // ya es opaca de borde a borde

  return {
    x: minX,
    y: minY,
    width: Math.min(w, maxX - minX + step),
    height: Math.min(h, maxY - minY + step),
  };
}

function collectSpriteUrls(cardNames, spriteIndex, towerIndex) {
  const urls = new Set();

  for (const towerType of Object.values(towerIndex)) {
    for (const variant of [towerType.allied, towerType.enemy]) {
      if (variant.intact) urls.add(variant.intact);
      if (variant.destroyed) urls.add(variant.destroyed);
      variant.attack.forEach((u) => urls.add(u));
    }
  }

  for (const name of cardNames) {
    const descriptor = spriteIndex.get(normalizeKey(name));
    if (!descriptor) continue;
    if (descriptor.card) urls.add(descriptor.card);
    if (descriptor.effect) descriptor.effect.forEach((u) => urls.add(u));
    for (const action of ['walk', 'attack']) {
      const variants = descriptor[action];
      if (!variants) continue;
      variants.allied.forEach((u) => urls.add(u));
      variants.enemy.forEach((u) => urls.add(u));
    }
  }

  return Array.from(urls);
}

/**
 * Precarga todos los frames necesarios para jugar (mazo propio + torres). La
 * arena de fondo se carga aparte, directo desde una ruta fija (ver
 * BattlePage.jsx) — no depende del manifiesto. onProgress(done, total) para
 * la barra de carga. Nunca rechaza: un sprite roto no debe tumbar la
 * pantalla de carga, solo cae al respaldo geométrico cuando le toque
 * dibujarse (o, si aparece más tarde, a ensureImage).
 */
export function preloadDeck(cardNames, manifest, onProgress) {
  const spriteIndex = buildSpriteIndex(manifest);
  const towerIndex = buildTowerSpriteIndex(manifest);
  const urls = collectSpriteUrls(cardNames, spriteIndex, towerIndex);

  const total = urls.length;
  let done = 0;
  onProgress?.(0, total);

  if (total === 0) return Promise.resolve({ spriteIndex, towerIndex });

  return Promise.all(
    urls.map((url) =>
      loadImage(url).finally(() => {
        done += 1;
        onProgress?.(done, total);
      }),
    ),
  ).then(() => ({ spriteIndex, towerIndex }));
}

export { normalizeKey };
