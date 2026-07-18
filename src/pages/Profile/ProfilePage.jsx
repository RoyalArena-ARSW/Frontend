import { useRef, useState } from 'react';
import { useProfile } from '../../hooks/useProfile';
import { TrophyBadge } from '../../components/TrophyBadge/TrophyBadge';
import { LevelBadge } from '../../components/LevelBadge/LevelBadge';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar';
import { StatCard } from '../../components/StatCard/StatCard';
import { FormError } from '../../components/FormError/FormError';
import './ProfilePage.css';

const XP_PER_LEVEL = 1000;

function formatWinRate(winRate) {
  if (winRate == null) return '0%';
  return `${(winRate * 100).toFixed(1)}%`;
}

export default function ProfilePage() {
  const { profile, loading, error, updateProfile } = useProfile();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const inputRef = useRef(null);

  if (loading && !profile) {
    return (
      <div className="profile-screen">
        <p className="profile-screen__status">Cargando perfil...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="profile-screen">
        <FormError message={error} />
      </div>
    );
  }

  if (!profile) return null;

  function startEditing() {
    setNameDraft(profile.displayName);
    setSaveError('');
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function saveName() {
    if (saving) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === profile.displayName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await updateProfile({ displayName: trimmed });
      setEditing(false);
    } catch (err) {
      setSaveError(err.message || 'No se pudo actualizar el nombre.');
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveName();
    } else if (event.key === 'Escape') {
      setEditing(false);
    }
  }

  const xpProgress = ((profile.experience % XP_PER_LEVEL) / 10);

  return (
    <div className="profile-screen">
      <div className="profile-card">
        <div className="profile-identity">
          <LevelBadge level={profile.level} size="lg" />
          <div className="profile-identity__name">
            {editing ? (
              <input
                ref={inputRef}
                className="profile-name-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={handleKeyDown}
                disabled={saving}
                maxLength={30}
              />
            ) : (
              <button type="button" className="profile-name-btn" onClick={startEditing}>
                {profile.displayName}
              </button>
            )}
            <FormError message={saveError} />
          </div>
        </div>

        <div className="profile-trophies">
          <div className="profile-trophies__item">
            <span className="profile-trophies__label">Actuales</span>
            <TrophyBadge value={profile.currentTrophies} size="lg" />
          </div>
          <div className="profile-trophies__item">
            <span className="profile-trophies__label">Récord</span>
            <TrophyBadge value={profile.highestTrophies} size="lg" />
          </div>
        </div>

        <ProgressBar
          value={xpProgress}
          label={
            <>
              <span>Nivel {profile.level}</span>
              <span>{profile.experience % XP_PER_LEVEL} / {XP_PER_LEVEL} XP</span>
            </>
          }
        />

        <div className="profile-stats-grid">
          <StatCard label="Victorias" value={profile.totalWins} />
          <StatCard label="Derrotas" value={profile.totalLosses} />
          <StatCard label="Batallas" value={profile.totalBattles} />
          <StatCard label="Win rate" value={formatWinRate(profile.winRate)} />
          <StatCard label="Triple corona" value={profile.threeCrownWins} />
          <StatCard label="Arena" value={profile.currentArena} />
        </div>
      </div>
    </div>
  );
}
