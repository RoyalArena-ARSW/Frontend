import { useManifest } from '../../hooks/useManifest';
import './CardTile.css';

export function CardTile({ card, size = 'medium', selected = false, inDeck = false, onClick }) {
  const { getCardImage } = useManifest();
  const imageUrl = getCardImage(card.name);
  const rarityClass = card.rarity ? card.rarity.toLowerCase() : 'common';
  const interactive = typeof onClick === 'function';

  return (
    <button
      type="button"
      className={`card-tile card-tile--${size} card-tile--${rarityClass}${selected ? ' card-tile--selected' : ''}${interactive ? '' : ' card-tile--static'}`}
      onClick={onClick}
      disabled={!interactive}
      title={card.name}
    >
      <span className="card-tile__elixir">
        <span className="card-tile__elixir-value">{card.elixirCost}</span>
      </span>

      {inDeck ? <span className="card-tile__badge">En mazo</span> : null}

      <span className="card-tile__art">
        {imageUrl ? (
          <img src={imageUrl} alt={card.name} loading="lazy" />
        ) : (
          <span className="card-tile__placeholder">{card.name.slice(0, 2).toUpperCase()}</span>
        )}
      </span>

      <span className="card-tile__name">{card.name}</span>
    </button>
  );
}
