import { Game } from "./game.js?v=20260312-5";

const byId = (id) => document.getElementById(id);

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
