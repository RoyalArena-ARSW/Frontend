import { useEffect, useState } from 'react';
import { deckApi } from '../../api/deckApi';
import { CardBrowser } from '../../components/CardBrowser/CardBrowser';
import { FormError } from '../../components/FormError/FormError';
import './CollectionPage.css';

export default function CollectionPage() {
  const [cards, setCards] = useState([]);
  const [deckCardIds, setDeckCardIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="collection-screen">
      <h1 className="collection-title">Colección</h1>

      {error ? <FormError message={error} /> : null}

      {loading ? (
        <p className="collection-status">Cargando catálogo...</p>
      ) : (
        <CardBrowser cards={cards} inDeckIds={deckCardIds} />
      )}
    </div>
  );
}
