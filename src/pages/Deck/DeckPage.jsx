import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deckApi } from '../../api/deckApi';
import { CardTile } from '../../components/CardTile/CardTile';
import { FormError } from '../../components/FormError/FormError';
import { buildStatRows, RARITY_LABEL, TYPE_LABEL } from '../../utils/cardMeta';
import './DeckPage.css';

const DECK_SIZE = 8;

export default function DeckPage() {
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noDeck, setNoDeck] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    let cancelled = false;

    deckApi
      .getMyActiveDeck()
      .then((data) => {
        if (!cancelled) setDeck(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404) {
          setNoDeck(true);
        } else {
          setError(err.message || 'No se pudo cargar el mazo.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="deck-screen">
        <p className="deck-screen__status">Cargando mazo...</p>
      </div>
    );
  }

  if (noDeck) {
    return (
      <div className="deck-screen">
        <div className="deck-empty">
          <h1>Sin mazo activo</h1>
          <p>Todavía no tienes un mazo activo. Necesitas armar uno de 8 cartas para poder jugar.</p>
          <Link to="/collection" className="deck-empty__link">
            Ver colección de cartas
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="deck-screen">
        <FormError message={error} />
      </div>
    );
  }

  if (!deck) return null;

  const totalElixir = deck.cards.reduce((sum, card) => sum + card.elixirCost, 0);
  const avgElixir = (totalElixir / DECK_SIZE).toFixed(2);

  return (
    <div className="deck-screen">
      <header className="deck-header">
        <div>
          <p className="deck-header__eyebrow">Mazo activo</p>
          <h1 className="deck-header__name">{deck.name}</h1>
        </div>
        <div className="deck-header__actions">
          <div className="deck-header__avg">
            <span className="deck-header__avg-value">{avgElixir}</span>
            <span className="deck-header__avg-label">Elixir promedio</span>
          </div>
          <Link to="/collection" className="deck-header__collection-link">
            Colección
          </Link>
        </div>
      </header>

      <div className={`deck-layout${selectedCard ? ' deck-layout--with-panel' : ''}`}>
        <div className="deck-grid">
          {deck.cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              size="medium"
              selected={selectedCard?.id === card.id}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </div>

        {selectedCard ? (
          <aside className="deck-detail">
            <button
              type="button"
              className="deck-detail__close"
              onClick={() => setSelectedCard(null)}
              aria-label="Cerrar detalle"
            >
              ×
            </button>
            <h2 className="deck-detail__name">{selectedCard.name}</h2>
            <p className="deck-detail__meta">
              {TYPE_LABEL[selectedCard.type] ?? selectedCard.type} · {RARITY_LABEL[selectedCard.rarity] ?? selectedCard.rarity}
            </p>
            {selectedCard.description ? (
              <p className="deck-detail__description">{selectedCard.description}</p>
            ) : null}
            <dl className="deck-detail__stats">
              {buildStatRows(selectedCard).map((row) => (
                <div key={row.label} className="deck-detail__stat-row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
