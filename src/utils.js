// 纯工具函数

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length < 0.001) return { x: 0, y: 0, length: 0 };
  return { x: x / length, y: y / length, length };
}

export function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function rotateVector(vector, angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos
  };
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function shuffle(values) {
  const list = [...values];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [list[index], list[target]] = [list[target], list[index]];
  }
  return list;
}

export function formatNumber(value) {
  return Math.floor(value).toLocaleString('en-US');
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}
