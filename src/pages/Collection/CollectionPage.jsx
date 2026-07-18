import { useEffect, useMemo, useState } from 'react';
import { deckApi } from '../../api/deckApi';
import { CardTile } from '../../components/CardTile/CardTile';
import { FormError } from '../../components/FormError/FormError';
import { RARITIES, RARITY_LABEL, TYPES, TYPE_LABEL } from '../../utils/cardMeta';
import './CollectionPage.css';

export default function CollectionPage() {
  const [cards, setCards] = useState([]);
  const [deckCardIds, setDeckCardIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [rarityFilter, setRarityFilter] = useState('ALL');

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      deckApi.getAllCards(),
      deckApi.getMyActiveDeck().catch((err) => (err.status === 404 ? null : Promise.reject(err))),
    ])
      .then(([allCards, activeDeck]) => {
        if (cancelled) return;
        setCards(Array.isArray(allCards) ? allCards : []);
        setDeckCardIds(new Set((activeDeck?.cards ?? []).map((card) => card.id)));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'No se pudo cargar el catálogo de cartas.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCards = useMemo(
    () =>
      cards.filter((card) => {
        if (typeFilter !== 'ALL' && card.type !== typeFilter) return false;
        if (rarityFilter !== 'ALL' && card.rarity !== rarityFilter) return false;
        return true;
      }),
    [cards, typeFilter, rarityFilter],
  );

  return (
    <div className="collection-screen">
      <h1 className="collection-title">Colección</h1>

      <div className="collection-filters">
        <select
          className="collection-filters__select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">Todos los tipos</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABEL[type]}
            </option>
          ))}
        </select>

        <select
          className="collection-filters__select"
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value)}
        >
          <option value="ALL">Todas las rarezas</option>
          {RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {RARITY_LABEL[rarity]}
            </option>
          ))}
        </select>
      </div>

      {error ? <FormError message={error} /> : null}

      {loading ? (
        <p className="collection-status">Cargando catálogo...</p>
      ) : (
        <>
          <p className="collection-count">
            {filteredCards.length} carta{filteredCards.length === 1 ? '' : 's'}
          </p>
          <div className="collection-grid">
            {filteredCards.map((card) => (
              <CardTile key={card.id} card={card} size="small" inDeck={deckCardIds.has(card.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
