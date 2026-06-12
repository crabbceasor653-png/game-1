// 本地存储持久化
import { STORAGE_KEYS } from './constants.js';
import { settings, highScore, setHighScore } from './state.js';

export function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
    settings.muted = stored.muted || false;
  } catch {
    settings.muted = false;
  }
}

export function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {
    // Local storage 在隐私模式下可能不可用
  }
}

export function loadHighScore() {
  try {
    setHighScore(Number(localStorage.getItem(STORAGE_KEYS.highScore) || 0));
  } catch {
    setHighScore(0);
  }
}

export function saveHighScore(value) {
  setHighScore(Math.max(highScore, Math.floor(value)));
  try {
    localStorage.setItem(STORAGE_KEYS.highScore, String(highScore));
  } catch {
    // 尽最大努力保存
  }
}
