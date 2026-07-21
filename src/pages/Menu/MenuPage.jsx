import { Link } from 'react-router-dom';
import { useProfile } from '../../hooks/useProfile';
import { LevelBadge } from '../../components/LevelBadge/LevelBadge';
import { TrophyBadge } from '../../components/TrophyBadge/TrophyBadge';
import './MenuPage.css';

const ARENA_BG = '/assets/arena/level_jungle_arena_out/level_jungle_arena_sprite_00.png';

export default function MenuPage() {
  const { profile, loading } = useProfile();

  return (
    <div className="menu-screen">
      <div className="menu-screen__bg" style={{ backgroundImage: `url(${ARENA_BG})` }} />
      <div className="menu-screen__overlay" />

      <header className="menu-header">
        <LevelBadge level={profile?.level ?? '—'} />
        <div className="menu-header__info">
          <p className="menu-header__name">
            {loading && !profile ? 'Cargando...' : (profile?.displayName ?? 'Jugador')}
          </p>
          <TrophyBadge value={profile?.currentTrophies ?? 0} />
        </div>
      </header>

      <main className="menu-content">
        <Link to="/matchmaking" className="menu-battle-btn">
          Batalla
        </Link>

        <nav className="menu-secondary">
          <Link to="/deck" className="menu-secondary__btn">
            Mazo
          </Link>
          <Link to="/profile" className="menu-secondary__btn">
            Perfil
          </Link>
          <Link to="/leaderboard" className="menu-secondary__btn">
            Ranking
          </Link>
          <Link to="/spectate" className="menu-secondary__btn">
            TV Royale
          </Link>
          <Link to="/replays" className="menu-secondary__btn">
            Historial
          </Link>
        </nav>
      </main>
    </div>
  );
}
