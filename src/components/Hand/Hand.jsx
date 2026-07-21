import { useEffect, useState } from 'react';
import { CardTile } from '../CardTile/CardTile';
import './Hand.css';

/**
 * Vigila el elixir (vía ref, actualizado ~10/s por el snapshot) y expone si
 * la carta se puede pagar en este momento, sin forzar un render de React en
 * cada frame: solo cuando el booleano realmente cambia (cruza el umbral).
 */
function useAffordable(cost, elixirRef) {
  const [affordable, setAffordable] = useState(() => (elixirRef.current ?? 0) + 0.001 >= cost);

  useEffect(() => {
    let frameId;
    function tick() {
      frameId = requestAnimationFrame(tick);
      const canAfford = (elixirRef.current ?? 0) + 0.001 >= cost;
      setAffordable((prev) => (prev === canAfford ? prev : canAfford));
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [cost, elixirRef]);

  return affordable;
}

function HandSlot({ card, elixirRef, selected, dragging, onSelect, onDragStart, onDragEnd }) {
  const affordable = useAffordable(card.elixirCost, elixirRef);

  return (
    <div
      className={`hand__slot${affordable ? '' : ' hand__slot--unaffordable'}${dragging ? ' hand__slot--dragging' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(card.id));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <CardTile card={card} size="small" selected={selected} onClick={onSelect} />
    </div>
  );
}

/**
 * Mano de batalla: las 4 cartas jugables + la siguiente. Reutiliza CardTile;
 * cada slot soporta click-para-seleccionar y arrastrar-y-soltar a la vez.
 */
export function Hand({
  handCards,
  nextCard,
  elixirRef,
  selectedCardId,
  draggingCardId,
  onSelectCard,
  onDragStartCard,
  onDragEndCard,
}) {
  return (
    <div className="hand">
      <div className="hand__cards">
        {handCards.map((card, i) =>
          card ? (
            <HandSlot
              key={card.id}
              card={card}
              elixirRef={elixirRef}
              selected={selectedCardId === card.id}
              dragging={draggingCardId === card.id}
              onSelect={() => onSelectCard(card.id)}
              onDragStart={() => onDragStartCard(card.id)}
              onDragEnd={onDragEndCard}
            />
          ) : (
            <div key={`empty-${i}`} className="hand__slot hand__slot--empty" aria-hidden="true" />
          ),
        )}
      </div>

      <div className="hand__next">
        <span className="hand__next-label">Siguiente</span>
        {nextCard ? (
          <CardTile card={nextCard} size="small" />
        ) : (
          <div className="hand__slot hand__slot--empty" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
