// 霓虹回路 (Neon Loop) — 入口模块
// 负责：初始化、事件绑定、游戏主循环

import { MOVEMENT_KEYS } from './constants.js';
import { clamp } from './utils.js';
import {
  canvas, ui, input,
  game, size, settings, highScore,
  previousFrame, audioContext,
  createGame, resizeCanvas,
  setGame, setPreviousFrame
} from './state.js';
import { loadSettings, loadHighScore } from './storage.js';
import { ensureAudio } from './audio.js';
import { pointerPosition } from './input.js';
import {
  startRun, restartRun, togglePause, toggleMute,
  setMode, updateGame, applyUpgrade, manualFire
} from './systems.js';
import { render } from './render.js';
import { updateHud, syncScreens } from './hud.js';
import { installTestApi } from './test-api.js';

// ═══════════════════════════════════════════════
// 事件绑定
// ═══════════════════════════════════════════════

function setupEvents() {
  // 按钮事件
  ui.startButton.addEventListener('click', startRun);
  ui.resumeButton.addEventListener('click', () => setMode('playing'));
  ui.pauseRestartButton.addEventListener('click', restartRun);
  ui.gameoverRestartButton.addEventListener('click', restartRun);
  ui.pauseButton.addEventListener('click', togglePause);
  ui.restartButton.addEventListener('click', restartRun);
  ui.muteButton.addEventListener('click', toggleMute);
  ui.autoFireButton.addEventListener('click', () => {
    if (!game) return;
    game.autoFire = !game.autoFire;
    ui.autoFireButton.textContent = game.autoFire ? 'Auto: ON' : 'Auto: OFF';
    ui.autoFireButton.classList.toggle('active', game.autoFire);
  });

  // 指针按下（拖拽开始）
  canvas.addEventListener('pointerdown', (event) => {
    ensureAudio();
    canvas.setPointerCapture(event.pointerId);
    const pos = pointerPosition(event);
    input.pointer.dragging = true;
    input.pointer.pointerId = event.pointerId;
    input.pointer.startX = pos.x;
    input.pointer.startY = pos.y;
    Object.assign(input.pointer, pos);
  });

  // 指针移动（拖拽中）
  canvas.addEventListener('pointermove', (event) => {
    if (!input.pointer.dragging || input.pointer.pointerId !== event.pointerId) return;
    Object.assign(input.pointer, pointerPosition(event));
  });

  // 指针释放（区分点击与拖拽）
  window.addEventListener('pointerup', (event) => {
    if (input.pointer.pointerId === event.pointerId) {
      const pos = pointerPosition(event);
      const dx = pos.x - input.pointer.startX;
      const dy = pos.y - input.pointer.startY;
      const dist = Math.hypot(dx, dy);
      if (dist < 10 && game?.mode === 'playing' && !game.autoFire) {
        manualFire(pos.x, pos.y);
      }
      input.pointer.dragging = false;
      input.pointer.pointerId = null;
    }
  });

  // 禁用右键菜单
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // 键盘事件
  window.addEventListener('keydown', (event) => {
    if (MOVEMENT_KEYS.has(event.code)) {
      input.keys.add(event.code);
      event.preventDefault();
      ensureAudio();
      return;
    }

    if (event.code === 'Enter') {
      if (game.mode === 'title' || game.mode === 'gameover') startRun();
      event.preventDefault();
    }

    if (event.code === 'KeyP' || event.code === 'Escape') {
      togglePause();
      event.preventDefault();
    }

    if (event.code === 'KeyR') {
      restartRun();
      event.preventDefault();
    }

    if (event.code === 'KeyM') {
      toggleMute();
      event.preventDefault();
    }

    if (game && game.mode === 'upgrading' && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
      const index = Number(event.code.replace('Digit', '')) - 1;
      const choice = game.choices[index];
      if (choice) applyUpgrade(choice.id);
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });

  // 窗口缩放
  window.addEventListener('resize', resizeCanvas);

  // 页面隐藏时自动暂停
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game?.mode === 'playing') {
      setMode('paused');
    }
  });
}

// ═══════════════════════════════════════════════
// 主循环
// ═══════════════════════════════════════════════

function step(frameTime) {
  const delta = Math.min(0.033, (frameTime - previousFrame) / 1000);
  setPreviousFrame(frameTime);

  if (game?.mode === 'playing') {
    updateGame(delta);
  }

  render();
  updateHud();
  requestAnimationFrame(step);
}

// ═══════════════════════════════════════════════
// 初始化
// ═══════════════════════════════════════════════

function init() {
  resizeCanvas();
  loadSettings();
  loadHighScore();
  setGame(createGame('title'));
  setupEvents();
  installTestApi();
  document.documentElement.dataset.gameReady = 'true';
  syncScreens();
  requestAnimationFrame(step);
}

init();
