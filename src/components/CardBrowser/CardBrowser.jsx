import { useMemo, useState } from 'react';
import { CardTile } from '../CardTile/CardTile';
import { RARITIES, RARITY_LABEL, TYPES, TYPE_LABEL } from '../../utils/cardMeta';
import './CardBrowser.css';

/**
 * Grid de cartas filtrable por tipo/rareza. Si se pasa onCardClick, cada
 * carta se vuelve clickeable (usado por el editor de mazo); si no, queda de
 * solo lectura (usado por la colección).
 */
export function CardBrowser({ cards, onCardClick, inDeckIds, size = 'small' }) {
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [rarityFilter, setRarityFilter] = useState('ALL');

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
    <div className="card-browser">
      <div className="card-browser__filters">
        <select
          className="card-browser__select"
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
          className="card-browser__select"
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

      <p className="card-browser__count">
        {filteredCards.length} carta{filteredCards.length === 1 ? '' : 's'}
      </p>

      <div className="card-browser__grid">
        {filteredCards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            size={size}
            inDeck={inDeckIds?.has(card.id)}
            onClick={onCardClick ? () => onCardClick(card) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
