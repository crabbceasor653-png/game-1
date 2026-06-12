// 音频管理（Web Audio API 程序化合成，零外部文件依赖）
import { settings, audioContext, setAudioContext } from './state.js';

export function ensureAudio() {
  if (settings.muted) return;
  const activation = navigator.userActivation;
  // userActivation 是较新的 API，未受支持时 activation 为 undefined，
  // 此时直接尝试创建 AudioContext（大多数浏览器允许在用户手势后创建）
  if (!audioContext && activation && !activation.hasBeenActive && !activation.isActive) {
    return;
  }
  if (!audioContext) {
    setAudioContext(new AudioContext());
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

export function playSound(kind) {
  if (settings.muted) return;
  ensureAudio();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const soundMap = {
    shot: [520, 0.018, 'square'],
    pop: [180, 0.045, 'triangle'],
    pickup: [760, 0.035, 'sine'],
    level: [320, 0.18, 'sawtooth'],
    damage: [90, 0.16, 'square'],
    gameover: [66, 0.32, 'sawtooth']
  };
  const [frequency, duration, type] = soundMap[kind] || soundMap.pickup;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.55), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);

  // 播放结束后清理节点，防止音频图节点泄漏
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}
