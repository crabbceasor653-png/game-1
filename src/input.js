// 输入处理：键盘、指针、瞄准逻辑
import { game, size, input, canvas } from './state.js';
import { normalize, distanceSquared, clamp } from './utils.js';

export function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp(event.clientX - rect.left, 0, size.width),
    y: clamp(event.clientY - rect.top, 0, size.height)
  };
}

export function getMovementVector() {
  const player = game.player;
  let x = 0;
  let y = 0;

  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;

  if (x === 0 && y === 0 && input.pointer.dragging) {
    const pointerVector = normalize(input.pointer.x - player.x, input.pointer.y - player.y);
    if (pointerVector.length > 18) {
      x = pointerVector.x;
      y = pointerVector.y;
    }
  }

  return normalize(x, y);
}

export function getNearestEnemy() {
  const player = game.player;
  let nearest = null;
  let bestDistance = Infinity;

  for (const enemy of game.enemies) {
    const value = distanceSquared(player, enemy);
    if (value < bestDistance) {
      bestDistance = value;
      nearest = enemy;
    }
  }

  return nearest;
}

export function getAimVector() {
  const player = game.player;

  if (input.pointer.dragging) {
    const pointerAim = normalize(input.pointer.x - player.x, input.pointer.y - player.y);
    if (pointerAim.length > 12) return pointerAim;
  }

  const enemy = getNearestEnemy();
  if (enemy) {
    return normalize(enemy.x - player.x, enemy.y - player.y);
  }

  return player.lastAim;
}
