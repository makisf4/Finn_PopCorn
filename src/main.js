import { Game } from "./game.js?v=20260312-14";

const byId = (id) => document.getElementById(id);

const blockMobileZoomGestures = () => {
  const preventIfCancelable = (event) => {
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    window.addEventListener(eventName, preventIfCancelable, { passive: false });
  });

  window.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) {
        preventIfCancelable(event);
      }
    },
    { passive: false }
  );

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
      if (target.closest("#controls, #game-shell")) {
        preventIfCancelable(event);
      }
    },
    { passive: false }
  );
};

blockMobileZoomGestures();

const game = new Game({
  canvas: byId("game-canvas"),
  scoreValue: byId("score-value"),
  missValue: byId("miss-value"),
  startScreen: byId("start-screen"),
  gameOverScreen: byId("game-over-screen"),
  pauseScreen: byId("pause-screen"),
  playBtn: byId("play-btn"),
  restartBtn: byId("restart-btn"),
  finalScore: byId("final-score"),
  muteBtn: byId("mute-btn"),
  muteIcon: byId("mute-icon"),
  volumeSlider: byId("volume-slider"),
  volumeValue: byId("volume-value"),
  milestoneBanner: byId("milestone-banner"),
  milestoneText: byId("milestone-text"),
  playerNameInput: byId("player-name"),
  nameError: byId("name-error"),
  leaderboardListStart: byId("leaderboard-list-start"),
  leaderboardListOver: byId("leaderboard-list-over"),
  leftBtn: byId("left-btn"),
  rightBtn: byId("right-btn"),
});

window.finnPopcornGame = game;
