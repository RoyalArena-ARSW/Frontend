import { ElixirBar } from '../ElixirBar/ElixirBar';
import './MatchHud.css';

/**
 * HUD "de solo lectura" compartido por espectador y replay: badge (EN VIVO /
 * REPETICIÓN), timer, y marcador con nombres + elixir de ambos equipos +
 * coronas. Ninguno de los dos modos tiene "mi equipo", por eso TEAM_A/TEAM_B
 * en vez de mí/rival (ver updateReadOnlyHud en drawBoard.js, que escribe
 * estos refs).
 */
export function MatchHud({ badgeLabel, badgeVariant, timerRef, names, elixirARef, elixirBRef, crownsRef }) {
  return (
    <div className="match-hud">
      <div className="match-hud__topbar">
        <span className={`match-hud__badge match-hud__badge--${badgeVariant}`}>
          <span className="match-hud__dot" aria-hidden="true" />
          {badgeLabel}
        </span>
        <span ref={timerRef} className="match-hud__timer">
          0:00
        </span>
      </div>

      <div className="match-hud__scoreboard">
        <div className="match-hud__player">
          <span className="match-hud__player-name">{names.TEAM_B}</span>
          <ElixirBar elixirRef={elixirBRef} orientation="horizontal" />
        </div>

        <span ref={crownsRef} className="match-hud__crowns">
          0 - 0
        </span>

        <div className="match-hud__player">
          <span className="match-hud__player-name">{names.TEAM_A}</span>
          <ElixirBar elixirRef={elixirARef} orientation="horizontal" />
        </div>
      </div>
    </div>
  );
}
