import { useEffect, useMemo, useState } from 'react';
import { deckApi } from '../../api/deckApi';
import { CardTile } from '../../components/CardTile/CardTile';
import { CardBrowser } from '../../components/CardBrowser/CardBrowser';
import { FormError } from '../../components/FormError/FormError';
import { Button } from '../../components/Button/Button';
import { useToast } from '../../hooks/useToast';
import './DeckPage.css';

const DECK_SIZE = 8;

export default function DeckPage() {
  const { showToast } = useToast();

  const [deckId, setDeckId] = useState(null);
  const [deckName, setDeckName] = useState('');
  const [deckCards, setDeckCards] = useState([]);
  const [allCards, setAllCards] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [noDeck, setNoDeck] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      deckApi.getMyActiveDeck().catch((err) => {
        if (err.status === 404) return null;
        throw err;
      }),
      deckApi.getAllCards(),
    ])
      .then(([deck, catalog]) => {
        if (cancelled) return;
        setAllCards(Array.isArray(catalog) ? catalog : []);
        if (!deck) {
          setNoDeck(true);
          return;
        }
        setDeckId(deck.id);
        setDeckName(deck.name);
        setDeckCards(deck.cards ?? []);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'No se pudo cargar el mazo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const inDeckIds = useMemo(() => new Set(deckCards.map((c) => c.id)), [deckCards]);

  function handleCardClick(card) {
    if (inDeckIds.has(card.id)) {
      setDeckCards((prev) => prev.filter((c) => c.id !== card.id));
      return;
    }
    if (deckCards.length >= DECK_SIZE) {
      showToast({ variant: 'warning', message: 'El mazo ya está completo, quita una carta primero.' });
      return;
    }
    setDeckCards((prev) => [...prev, card]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const cardIds = deckCards.map((c) => c.id);
      let updated;
      if (deckId) {
        updated = await deckApi.updateDeckCards(deckId, cardIds);
      } else {
        updated = await deckApi.createDeck('Mi Mazo', cardIds);
        await deckApi.activateDeck(updated.id);
      }
      setDeckId(updated.id);
      setDeckCards(updated.cards ?? deckCards);
      setDeckName(updated.name ?? 'Mi Mazo');
      setNoDeck(false);
      showToast({ variant: 'info', message: 'Mazo guardado.' });
    } catch (err) {
      showToast({ variant: 'error', message: err.message || 'No se pudo guardar el mazo.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="deck-screen">
        <p className="deck-screen__status">Cargando mazo...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="deck-screen">
        <FormError message={loadError} />
      </div>
    );
  }

  const totalElixir = deckCards.reduce((sum, card) => sum + card.elixirCost, 0);
  const avgElixir = (totalElixir / DECK_SIZE).toFixed(1);
  const slots = Array.from({ length: DECK_SIZE }, (_, i) => deckCards[i] ?? null);

  return (
    <div className="deck-screen">
      <header className="deck-editor-header">
        <p className="deck-editor-header__eyebrow">
          {noDeck ? 'Sin mazo activo — arma tu primer mazo' : 'Editando mazo'}
        </p>
        <h1 className="deck-editor-header__name">{deckName || 'Mi Mazo'}</h1>
      </header>

      <section className="deck-board">
        <div className="deck-slots">
          {slots.map((card, i) =>
            card ? (
              <CardTile key={card.id} card={card} size="medium" onClick={() => handleCardClick(card)} />
            ) : (
              <div key={`empty-${i}`} className="deck-slot-empty" aria-hidden="true" />
            ),
          )}
        </div>

        <div className="deck-summary">
          <div className="deck-summary__stat">
            <span className="deck-summary__value">
              {deckCards.length}/{DECK_SIZE}
            </span>
            <span className="deck-summary__label">Cartas</span>
          </div>
          <div className="deck-summary__stat">
            <span className="deck-summary__value">{avgElixir}</span>
            <span className="deck-summary__label">Elixir promedio</span>
          </div>
          <Button type="button" onClick={handleSave} loading={saving} disabled={deckCards.length !== DECK_SIZE}>
            Guardar mazo
          </Button>
        </div>
      </section>

      <section className="deck-collection-section">
        <h2 className="deck-collection-section__title">Colección</h2>
        <CardBrowser cards={allCards} onCardClick={handleCardClick} inDeckIds={inDeckIds} />
      </section>
    </div>
  );
}
