// Character-aware catch-region geometry. The region is a precomputed
// rectangle offset from the character's centre toward its mouth, clamped to
// the rendered half-width so body/tail catches are avoided.

export function computeCatchRect(x, y, width, facing, char) {
  const visHalfMin = Math.min(...char.visHalf);
  const minHalf = width * visHalfMin * 0.98;
  const offset = Math.max(-minHalf * 0.8, Math.min(minHalf * 0.8, width * char.mouthOffset));
  return {
    x: x + (facing >= 0 ? offset : -offset) - minHalf,
    y: y - width * 0.72,
    w: minHalf * 2,
    h: width * 0.62,
  };
}

export function computeEffectPoint(x, y, width, facing) {
  const side = facing >= 0 ? 1 : -1;
  return {
    x: x + side * width * 0.28,
    y: y - width * 0.66,
  };
}

// A kernel that has already bounced rolls through the character's lower
// silhouette instead of rising back to mouth height. Keep the same fair
// horizontal mouth/body band, but extend it to the floor for that second
// chance.
export function extendCatchRectToGround(catchRect, groundY) {
  return {
    ...catchRect,
    h: Math.max(catchRect.h, groundY - catchRect.y),
  };
}
