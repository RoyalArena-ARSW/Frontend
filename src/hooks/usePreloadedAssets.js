import { useEffect, useRef, useState } from 'react';
import { computeOpaqueBounds, loadImage, preloadDeck } from '../utils/spriteLoader';

// Fondo de la arena: ruta fija, independiente del manifiesto de sprites.
// NOTA: el archivo hoy vive en .../arena/level_jungle_arena_out/jungle_arena.png
// (no en /assets/arena/jungle_arena.png) — el manifest.json regenerado lo
// confirma. Si se mueve el PNG a la raíz de /assets/arena/, actualizar esta
// constante.
const ARENA_BG_SRC = '/assets/arena/level_jungle_arena_out/jungle_arena.png';

/**
 * Precarga la arena de fondo + los sprites necesarios para dibujar el
 * tablero (torres + las cartas que devuelva fetchCards), compartido por
 * batalla en vivo (mazo propio), espectador y replay (catálogo completo,
 * porque no hay "mi mazo" en modo lectura). fetchCards debe ser estable
 * (useCallback) o la carga se reinicia en cada render.
 */
export function usePreloadedAssets(fetchCards) {
  const [phase, setPhase] = useState('loading');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [cardsById, setCardsById] = useState({});

  const bgImageRef = useRef(null);
  const bgCropRef = useRef(null);
  const spriteIndexRef = useRef(null);
  const towerIndexRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setProgress({ done: 0, total: 0 });

    // La arena se carga aparte, de una ruta fija: no depende del manifiesto
    // ni del progreso de las cartas. Mientras tanto (o si falla) drawBoard
    // usa el azul de respaldo — bgImageRef sigue en null.
    loadImage(ARENA_BG_SRC).then((img) => {
      if (cancelled || !img) return;
      bgImageRef.current = img;
      // El PNG puede traer un margen transparente horneado en el archivo
      // (pasó con este asset): recortarlo evita que ese margen se vea como
      // un hueco al estirar la imagen al canvas.
      bgCropRef.current = computeOpaqueBounds(img);
    });

    async function load() {
      try {
        const [cards, manifest] = await Promise.all([
          fetchCards(),
          fetch('/assets/manifest.json').then((res) => res.json()),
        ]);
        if (cancelled) return;

        // Acepta tanto un array de cartas (catálogo completo) como un mazo
        // { cards: [...] } (mazo propio), para que los llamadores puedan
        // pasar directo el resultado de deckApi.getAllCards() o
        // deckApi.getMyActiveDeck() sin normalizar.
        const cardList = Array.isArray(cards) ? cards : (cards?.cards ?? []);

        const byId = {};
        for (const card of cardList) byId[card.id] = card;

        const { spriteIndex, towerIndex } = await preloadDeck(
          cardList.map((c) => c.name),
          manifest,
          (done, total) => {
            if (!cancelled) setProgress({ done, total });
          },
        );
        if (cancelled) return;

        spriteIndexRef.current = spriteIndex;
        towerIndexRef.current = towerIndex;
        setCardsById(byId);
        setPhase('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'No se pudieron cargar los recursos gráficos.');
          setPhase('error');
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [fetchCards]);

  return { phase, progress, error, cardsById, bgImageRef, bgCropRef, spriteIndexRef, towerIndexRef };
}
