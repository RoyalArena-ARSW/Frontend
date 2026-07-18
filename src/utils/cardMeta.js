export const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'CHAMPION'];

export const RARITY_LABEL = {
  COMMON: 'Común',
  RARE: 'Rara',
  EPIC: 'Épica',
  LEGENDARY: 'Legendaria',
  CHAMPION: 'Campeón',
};

export const TYPES = ['TROOP', 'SPELL', 'BUILDING'];

export const TYPE_LABEL = {
  TROOP: 'Tropa',
  SPELL: 'Hechizo',
  BUILDING: 'Edificio',
};

const MOVEMENT_SPEED_LABEL = {
  SLOW: 'Lenta',
  MEDIUM: 'Media',
  FAST: 'Rápida',
  VERY_FAST: 'Muy rápida',
};

const TARGET_LABEL = {
  GROUND: 'Terrestre',
  AIR: 'Aérea',
  GROUND_AND_AIR: 'Terrestre y aérea',
  BUILDINGS: 'Edificios',
};

const DEPLOYMENT_LABEL = {
  OWN_SIDE: 'Solo tu lado',
  ANYWHERE: 'Cualquier lugar',
  ENEMY_SIDE: 'Lado enemigo',
};

/** Arma la lista de stats a mostrar en el panel de detalle, según el "type" polimórfico de la carta. */
export function buildStatRows(card) {
  const rows = [{ label: 'Coste', value: `${card.elixirCost} elixir` }];

  if (card.type === 'TROOP') {
    rows.push(
      { label: 'Daño', value: card.damage },
      { label: 'Vida', value: card.health },
      { label: 'Unidades', value: card.unitCount },
      { label: 'Velocidad de ataque', value: `${card.attackSpeed}s` },
      { label: 'Velocidad de movimiento', value: MOVEMENT_SPEED_LABEL[card.movementSpeed] ?? card.movementSpeed },
      { label: 'Rango de ataque', value: card.attackRange },
      { label: 'Objetivo', value: TARGET_LABEL[card.target] ?? card.target },
      { label: 'Aérea', value: card.isAerial ? 'Sí' : 'No' },
      { label: 'Nivel', value: card.level },
      { label: 'Arena mínima', value: card.unlockArena },
    );
  } else if (card.type === 'SPELL') {
    rows.push(
      { label: 'Daño', value: card.damage },
      { label: 'Radio de efecto', value: card.effectRadius },
      { label: 'Duración', value: `${card.duration}s` },
    );
  } else if (card.type === 'BUILDING') {
    rows.push(
      { label: 'Daño', value: card.damage },
      { label: 'Vida', value: card.health },
      { label: 'Velocidad de ataque', value: `${card.attackSpeed}s` },
      { label: 'Rango de ataque', value: card.attackRange },
      { label: 'Objetivo', value: TARGET_LABEL[card.target] ?? card.target },
      { label: 'Duración en el campo', value: `${card.lifetimeSeconds}s` },
    );
  }

  rows.push({ label: 'Despliegue', value: DEPLOYMENT_LABEL[card.deploymentType] ?? card.deploymentType });

  return rows.filter((row) => row.value !== undefined && row.value !== null);
}
