import { useEffect, useRef } from 'react';
import './ElixirBar.css';

const SEGMENTS = 10;
const LERP_FACTOR = 0.15;

/**
 * Barra de elixir de 10 segmentos. `elixirRef` es un ref (no state) que el
 * llamador actualiza cada snapshot (~10/s); este componente interpola solo,
 * con su propio requestAnimationFrame, y escribe directo al DOM vía refs
 * internos para que la animación se vea fluida sin generar renders de React
 * en cada frame.
 */
export function ElixirBar({ elixirRef, orientation = 'horizontal' }) {
  const segmentRefs = useRef([]);
  const valueRef = useRef(null);
  const displayedRef = useRef(elixirRef.current ?? 0);

  useEffect(() => {
    let frameId;

    function tick() {
      frameId = requestAnimationFrame(tick);

      const target = elixirRef.current ?? 0;
      const diff = target - displayedRef.current;
      displayedRef.current = Math.abs(diff) < 0.01 ? target : displayedRef.current + diff * LERP_FACTOR;
      const value = displayedRef.current;

      segmentRefs.current.forEach((el, i) => {
        if (!el) return;
        const fill = Math.max(0, Math.min(1, value - i));
        el.classList.toggle('elixir-bar__segment--filled', fill > 0);
        el.style.opacity = 0.35 + fill * 0.65;
      });

      if (valueRef.current) {
        valueRef.current.textContent = value.toFixed(1);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [elixirRef]);

  return (
    <div className={`elixir-bar elixir-bar--${orientation}`}>
      <div className="elixir-bar__segments">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              segmentRefs.current[i] = el;
            }}
            className="elixir-bar__segment"
          />
        ))}
      </div>
      <span ref={valueRef} className="elixir-bar__value">
        0.0
      </span>
    </div>
  );
}
