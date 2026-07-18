import { useCallback, useEffect, useState } from 'react';

const CARD_CATEGORIES = ['troops', 'spells', 'buildings'];

// Normaliza nombres para comparar "Knight" con "knight", "mini P.E.K.K.A" con
// "Mini PEKKA", "Baby Dragon" con "BabyDragon", etc.
function normalizeKey(name) {
  return name.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function buildCardImageIndex(manifest) {
  const index = new Map();
  for (const category of CARD_CATEGORIES) {
    const group = manifest[category];
    if (!group || typeof group !== 'object') continue;
    for (const [key, node] of Object.entries(group)) {
      if (node && typeof node === 'object' && typeof node.card === 'string') {
        index.set(normalizeKey(key), node.card);
      }
    }
  }
  return index;
}

// Cache a nivel de módulo: el manifiesto se pide una sola vez sin importar
// cuántos componentes usen este hook.
let cachedManifest = null;
let cachedIndex = null;
let pendingLoad = null;

function loadManifest() {
  if (cachedManifest) return Promise.resolve(cachedManifest);
  if (!pendingLoad) {
    pendingLoad = fetch('/assets/manifest.json')
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el manifiesto de assets.');
        return res.json();
      })
      .then((data) => {
        cachedManifest = data;
        cachedIndex = buildCardImageIndex(data);
        return data;
      });
  }
  return pendingLoad;
}

export function useManifest() {
  const [manifest, setManifest] = useState(cachedManifest);
  const [loading, setLoading] = useState(!cachedManifest);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cachedManifest) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadManifest()
      .then((data) => {
        if (!cancelled) setManifest(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'No se pudo cargar el manifiesto.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const getCardImage = useCallback((cardName) => {
    if (!cardName || !cachedIndex) return null;
    return cachedIndex.get(normalizeKey(cardName)) ?? null;
  }, []);

  return { manifest, loading, error, getCardImage };
}
