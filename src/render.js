// 渲染系统：背景、玩家、敌人、子弹、经验球、粒子
import { ctx, size, game } from './state.js';
import { clamp, randomBetween } from './utils.js';
import { getEffectiveMagnetRadius } from './systems.js';

export function drawBackground() {
  ctx.fillStyle = '#071018';
  ctx.fillRect(0, 0, size.width, size.height);

  const spacing = 44;
  const drift = ((game?.time || 0) * 18) % spacing;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(49, 217, 255, 0.08)';

  for (let x = -spacing + drift; x < size.width + spacing; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size.height);
    ctx.stroke();
  }

  for (let y = -spacing + drift; y < size.height + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 77, 184, 0.1)';
  ctx.lineWidth = 2;
  for (let index = 0; index < 5; index += 1) {
    const y = ((game?.time || 0) * 24 + index * 170) % (size.height + 120) - 60;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size.width, y + 60);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawPlayer(player) {
  const angle = Math.atan2(player.lastAim.y, player.lastAim.x);

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);
  ctx.shadowColor = player.hurtTimer > 0 ? '#ff5c7a' : '#31d9ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = player.hurtTimer > 0 ? 'rgba(255, 92, 122, 0.4)' : 'rgba(49, 217, 255, 0.18)';
  ctx.strokeStyle = player.hurtTimer > 0 ? '#ff5c7a' : '#31d9ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-12, -12);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-12, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(156, 255, 87, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawSkillAuras(player) {
  ctx.save();
  ctx.translate(player.x, player.y);

  if (game.starburstTimer > 0) {
    const pulse = 1 + Math.sin(game.time * 18) * 0.08;
    ctx.strokeStyle = 'rgba(255, 187, 77, 0.72)';
    ctx.shadowColor = '#ffbb4d';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (player.magneticSurgeActiveTimer > 0) {
    ctx.strokeStyle = 'rgba(156, 255, 87, 0.35)';
    ctx.shadowColor = '#9cff57';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, getEffectiveMagnetRadius(), 0, Math.PI * 2);
    ctx.stroke();
  }

  if (player.phaseShieldReady) {
    ctx.strokeStyle = 'rgba(49, 217, 255, 0.62)';
    ctx.shadowColor = '#31d9ff';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.shadowColor = enemy.color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = `${enemy.color}55`;
  ctx.strokeStyle = enemy.edge;
  ctx.lineWidth = 2;

  if (enemy.name === 'runner') {
    ctx.rotate(enemy.phase);
    ctx.beginPath();
    ctx.moveTo(enemy.radius + 5, 0);
    ctx.lineTo(-enemy.radius, -enemy.radius);
    ctx.lineTo(-enemy.radius * 0.45, 0);
    ctx.lineTo(-enemy.radius, enemy.radius);
    ctx.closePath();
  } else if (enemy.name === 'brute') {
    ctx.rotate(enemy.phase * 0.25);
    ctx.beginPath();
    ctx.rect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
  }

  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(233, 244, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBullet(bullet) {
  ctx.save();
  ctx.strokeStyle = bullet.color;
  ctx.shadowColor = bullet.color;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bullet.x, bullet.y);
  ctx.lineTo(bullet.x - bullet.vx * 0.035, bullet.y - bullet.vy * 0.035);
  ctx.stroke();
  ctx.restore();
}

export function drawOrb(orb) {
  ctx.save();
  ctx.translate(orb.x, orb.y);
  ctx.rotate((game.time + orb.x * 0.01) * 2);
  ctx.shadowColor = '#9cff57';
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(156, 255, 87, 0.34)';
  ctx.strokeStyle = '#9cff57';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -orb.radius);
  ctx.lineTo(orb.radius, 0);
  ctx.lineTo(0, orb.radius);
  ctx.lineTo(-orb.radius, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const particle of game.particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.restore();
}

export function render() {
  ctx.save();
  if (game?.shake > 0) {
    ctx.translate(randomBetween(-game.shake, game.shake), randomBetween(-game.shake, game.shake));
  }

  drawBackground();

  if (game) {
    for (const orb of game.orbs) drawOrb(orb);
    for (const bullet of game.bullets) drawBullet(bullet);
    for (const enemy of game.enemies) drawEnemy(enemy);
    drawSkillAuras(game.player);
    drawPlayer(game.player);
    drawParticles();
  }

  ctx.restore();
}
