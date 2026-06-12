// 共享可变状态、DOM 引用、核心生命周期函数
import { BALANCE, STARBURST } from './constants.js';
import { clamp } from './utils.js';

// ── 画布与上下文 ──
export const canvas = document.querySelector('#game-canvas');
export const ctx = canvas.getContext('2d');

// ── UI 元素引用 ──
export const ui = {
  score: document.querySelector('#score-value'),
  best: document.querySelector('#best-value'),
  level: document.querySelector('#level-value'),
  time: document.querySelector('#time-value'),
  hpBar: document.querySelector('#hp-bar'),
  xpBar: document.querySelector('#xp-bar'),
  skillBar: document.querySelector('#skill-bar'),
  hpValue: document.querySelector('#hp-value'),
  xpValue: document.querySelector('#xp-value'),
  skillValue: document.querySelector('#skill-value'),
  pauseButton: document.querySelector('#pause-button'),
  restartButton: document.querySelector('#restart-button'),
  muteButton: document.querySelector('#mute-button'),
  startButton: document.querySelector('#start-button'),
  resumeButton: document.querySelector('#resume-button'),
  pauseRestartButton: document.querySelector('#pause-restart-button'),
  gameoverRestartButton: document.querySelector('#gameover-restart-button'),
  titleScreen: document.querySelector('#title-screen'),
  pauseScreen: document.querySelector('#pause-screen'),
  upgradeScreen: document.querySelector('#upgrade-screen'),
  gameoverScreen: document.querySelector('#gameover-screen'),
  upgradeOptions: document.querySelector('#upgrade-options'),
  upgradeStrip: document.querySelector('#upgrade-strip'),
  runStats: document.querySelector('#run-stats'),
  autoFireButton: document.querySelector('#auto-fire-button')
};

// ── 输入状态 ──
export const input = {
  keys: new Set(),
  pointer: {
    dragging: false,
    pointerId: null,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0
  }
};

// ── 运行时可变状态 ──
export let size = {
  width: 1,
  height: 1,
  dpr: 1
};
export let settings = { muted: false };
export let highScore = 0;
export let game = null;
export let previousFrame = performance.now();
export let audioContext = null;

// ── Setter 函数（其他模块不能直接对 import 的 let 绑定重新赋值）──
export function setGame(val) { game = val; }
export function setHighScore(val) { highScore = val; }
export function setPreviousFrame(val) { previousFrame = val; }
export function setAudioContext(val) { audioContext = val; }

// ── 游戏对象创建 ──
export function createGame(mode = 'title') {
  return {
    mode,
    time: 0,
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpToNext: BALANCE.initialXpToNext,
    skillCharge: 0,
    skillChargeMax: STARBURST.chargeMax,
    starburstTimer: 0,
    starburstFireTimer: 0,
    starburstActivations: 0,
    starburstRings: 0,
    spawnMeter: 0,
    shotCounter: 0,
    shake: 0,
    autoFire: false,
    choices: [],
    upgrades: {},
    bullets: [],
    enemies: [],
    orbs: [],
    particles: [],
    player: {
      x: size.width / 2,
      y: size.height / 2,
      radius: 16,
      speed: BALANCE.playerSpeed,
      maxHp: BALANCE.playerHp,
      hp: BALANCE.playerHp,
      hurtTimer: 0,
      fireRate: 3.2,
      fireTimer: 0,
      bulletSpeed: 560,
      bulletDamage: 1,
      bulletPierce: 0,
      magnetRadius: BALANCE.magnetRadius,
      burstLevel: 0,
      pulseDamage: 0,
      pulseRadius: 118,
      pulseTimer: 2.4,
      phaseShieldLevel: 0,
      phaseShieldCooldown: 14,
      phaseShieldTimer: 0,
      phaseShieldReady: false,
      magneticSurgeLevel: 0,
      magneticSurgeCooldown: 13,
      magneticSurgeTimer: 0,
      magneticSurgeActiveTimer: 0,
      regenBatteryLevel: 0,
      regenOrbGoal: 11,
      regenOrbCount: 0,
      lastAim: { x: 1, y: 0 }
    }
  };
}

// ── 画布尺寸调整 ──
export function clampPlayer() {
  const player = game.player;
  const margin = player.radius + 12;
  player.x = clamp(player.x, margin, size.width - margin);
  player.y = clamp(player.y, margin, size.height - margin);
}

export function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  size.width = Math.max(320, rect.width);
  size.height = Math.max(480, rect.height);
  size.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(size.width * size.dpr);
  canvas.height = Math.floor(size.height * size.dpr);
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);

  if (game) {
    clampPlayer();
  }
}
