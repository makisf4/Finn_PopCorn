// Direction-change treatment: the mirror sign switches instantly at full
// horizontal scale (never interpolates through zero), and a brief vertical
// squash softens the pop. Width stays stable throughout.

export const TURN_DURATION = 0.118;

export function createFacingState(initialFacing = -1) {
  return {
    facing: initialFacing < 0 ? -1 : 1,
    progress: 1,
  };
}

export function advanceFacing(state, targetFacing, dt) {
  const target = targetFacing >= 0 ? 1 : -1;
  let current = state;
  if (current.facing !== target) {
    current = { facing: target, progress: 0 };
  }
  if (dt > 0 && current.progress < 1) {
    current.progress = Math.min(1, current.progress + dt / TURN_DURATION);
  }
  return current;
}

// Vertical squash envelope: a restrained 7% compression at turn start.
// The renderers anchor this at the feet so direction changes stay grounded.
export function facingSquash(state) {
  const p = Math.min(1, Math.max(0, state.progress));
  const lift = Math.pow(1 - p, 2.2);
  return 1 - 0.07 * lift;
}

export function updateFacing(state, targetFacing, dt) {
  const next = advanceFacing(state, targetFacing, dt);
  return {
    facing: next.facing,
    progress: next.progress,
    mirrorSign: next.facing,
    squash: facingSquash(next),
  };
}

export function pickRunFrame(runCount, stepPhase, movement, isGameOver) {
  if (!isGameOver && Math.abs(movement) >= 0.06) {
    const idx = Math.floor((stepPhase / (Math.PI * 2)) * runCount) % runCount;
    return ((idx % runCount) + runCount) % runCount;
  }
  return runCount; // idle frame index
}

export function selectFrameIndex(options) {
  return pickRunFrame(
    options.runCount,
    options.stepPhase,
    options.movement,
    options.isGameOver
  );
}
