import { Game } from "./game.js?v=20260906-34";

const byId = (id) => document.getElementById(id);

const blockMobileZoomGestures = () => {
  // Only restrict zoom gestures over movement controls; pinch zoom works on the page.
  const preventIfCancelable = (event) => {
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  let lastTouchEnd = 0;
  window.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      const isDoubleTap = now - lastTouchEnd < 320;
      lastTouchEnd = now;
      if (!isDoubleTap) return;

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("#controls")) {
        preventIfCancelable(event);
      }
    },
    { passive: false }
  );
};

blockMobileZoomGestures();

const game = new Game({
  hud: byId("hud"),
  controls: byId("controls"),
  canvas: byId("game-canvas"),
  scoreValue: byId("score-value"),
  missValue: byId("miss-value"),
  missMarkers: byId("miss-markers"),
  lastChance: byId("last-chance"),
  comboPill: byId("combo-pill"),
  comboValue: byId("combo-value"),
  pointsAward: byId("points-award"),
  startScreen: byId("start-screen"),
  gameOverScreen: byId("game-over-screen"),
  pauseScreen: byId("pause-screen"),
  pauseBtn: byId("pause-btn"),
  resumeBtn: byId("resume-btn"),
  gameAnnouncer: byId("game-announcer"),
  playBtn: byId("play-btn"),
  restartBtn: byId("restart-btn"),
  finalScore: byId("final-score"),
  finalPlayer: byId("final-player"),
  homeBtn: byId("home-btn"),
  milestoneBanner: byId("milestone-banner"),
  milestoneText: byId("milestone-text"),
  homeEndBtn: byId("home-end-btn"),
  runTimeEl: byId("run-time"),
  runCaughtEl: byId("run-caught"),
  runBestComboEl: byId("run-best-combo"),
  runMissesEl: byId("run-misses"),
  runWaveEl: byId("run-wave"),
  runCharacterEl: byId("run-character"),
  playerNameInput: byId("player-name"),
  nameError: byId("name-error"),
  leaderboardListStart: byId("leaderboard-list-start"),
  leaderboardListOver: byId("leaderboard-list-over"),
  leftBtn: byId("left-btn"),
  rightBtn: byId("right-btn"),
  pauseEndBtn: byId("pause-end-btn"),
  quitConfirmEl: byId("quit-confirm"),
  quitConfirmOk: byId("quit-ok-btn"),
  quitConfirmCancel: byId("quit-cancel-btn"),
  firstRunOverlay: byId("first-run-overlay"),
  firstRunText: byId("first-run-text"),
});

window.finnPopcornGame = game;
