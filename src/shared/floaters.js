export const MAX_ACTIVE_FLOATERS = 2;

export function planFloaters(active) {
  if (active.length === 0) return { replaceIndex: -1 };

  // Keep the freshest active floater (the newest one), preferring combos.
  let freshest = 0;
  let bestLife = -Infinity;
  for (let i = 0; i < active.length; i += 1) {
    if (active[i].life >= bestLife) {
      bestLife = active[i].life;
      freshest = i;
    }
  }
  return { replaceIndex: active.length === 0 ? -1 : freshest };
}

export function shouldSpawn(points, lastPoints) {
  return points > 0 && points !== lastPoints;
}
