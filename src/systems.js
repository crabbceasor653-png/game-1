// 游戏核心系统：生成、物理、战斗、技能、升级、游戏流程
import { BALANCE, STARBURST, ENEMY_TYPES, UPGRADE_DEFS } from './constants.js';
import { clamp, normalize, distanceSquared, rotateVector, randomBetween, shuffle } from './utils.js';
import { game, size, settings, highScore, createGame, input, ui, setGame } from './state.js';
import { saveHighScore, saveSettings } from './storage.js';
import { playSound, ensureAudio } from './audio.js';
import { getMovementVector, getAimVector, getNearestEnemy } from './input.js';
import { syncScreens, updateHud } from './hud.js';

// ═══════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════

export function getEffectiveMagnetRadius() {
  const player = game.player;
  if (player.magneticSurgeActiveTimer <= 0) return player.magnetRadius;
  return player.magnetRadius + 70 + player.magneticSurgeLevel * 30;
}

export function getMagneticSurgeRadius() {
  const player = game.player;
  return 150 + player.magneticSurgeLevel * 42;
}

// ═══════════════════════════════════════════════
// 实体生成
// ═══════════════════════════════════════════════

export function spawnEnemy() {
  const margin = 90;
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = randomBetween(-margin, size.width + margin);
    y = -margin;
  } else if (side === 1) {
    x = size.width + margin;
    y = randomBetween(-margin, size.height + margin);
  } else if (side === 2) {
    x = randomBetween(-margin, size.width + margin);
    y = size.height + margin;
  } else {
    x = -margin;
    y = randomBetween(-margin, size.height + margin);
  }

  const roll = Math.random();
  let type = 'drone';
  if (game.time > BALANCE.bruteStart && roll < 0.16) {
    type = 'brute';
  } else if (game.time > BALANCE.runnerStart && roll < 0.38) {
    type = 'runner';
  }

  const base = ENEMY_TYPES[type];
  const hpGrowth = Math.floor(game.time / BALANCE.enemyHpGrowthSeconds);
  game.enemies.push({
    ...base,
    x,
    y,
    hp: base.hp + hpGrowth,
    maxHp: base.hp + hpGrowth,
    phase: randomBetween(0, Math.PI * 2),
    dead: false
  });
}

export function updateSpawning(delta) {
  if (game.enemies.length > BALANCE.enemyLimit) return;
  const rate = clamp(BALANCE.spawnBase + game.time * BALANCE.spawnGrowth, BALANCE.spawnBase, BALANCE.spawnMax);
  game.spawnMeter += delta * rate;

  while (game.spawnMeter >= 1) {
    game.spawnMeter -= 1;
    spawnEnemy();
  }
}

export function spawnOrb(x, y, value) {
  game.orbs.push({
    x,
    y,
    vx: randomBetween(-44, 44),
    vy: randomBetween(-44, 44),
    radius: 6,
    value,
    dead: false
  });
}

export function spawnParticles(x, y, color, amount, force) {
  const remaining = Math.max(0, 260 - game.particles.length);
  const count = Math.min(amount, remaining);

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(force * 0.25, force);
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomBetween(0.35, 0.85),
      maxLife: 0.85,
      size: randomBetween(1.6, 4.2),
      color
    });
  }
}

export function spawnPulseParticles(x, y, radius) {
  const amount = 28;
  for (let index = 0; index < amount; index += 1) {
    const angle = (index / amount) * Math.PI * 2;
    game.particles.push({
      x: x + Math.cos(angle) * radius * 0.45,
      y: y + Math.sin(angle) * radius * 0.45,
      vx: Math.cos(angle) * 120,
      vy: Math.sin(angle) * 120,
      life: 0.42,
      maxLife: 0.42,
      size: 2.2,
      color: '#31d9ff'
    });
  }
}

export function killEnemy(enemy) {
  game.kills += 1;
  game.score += enemy.score;
  spawnOrb(enemy.x, enemy.y, enemy.xp);
  spawnParticles(enemy.x, enemy.y, enemy.color, enemy.name === 'brute' ? 24 : 14, 160);
  playSound('pop');
}

export function collectOrb(orb) {
  const player = game.player;
  orb.dead = true;
  game.xp += orb.value;
  game.score += orb.value * 3;
  game.skillCharge += 1;

  if (player.regenBatteryLevel > 0) {
    player.regenOrbCount += 1;
    if (player.regenOrbCount >= player.regenOrbGoal) {
      player.regenOrbCount -= player.regenOrbGoal;
      player.hp = Math.min(player.maxHp, player.hp + 1);
      spawnParticles(player.x, player.y, '#9cff57', 14, 130);
    }
  }

  while (game.skillCharge >= game.skillChargeMax) {
    game.skillCharge -= game.skillChargeMax;
    triggerStarburst();
  }

  spawnParticles(orb.x, orb.y, '#9cff57', 8, 110);
  playSound('pickup');
}

export function cleanupEntities() {
  const margin = 120;
  game.bullets = game.bullets.filter(
    (bullet) =>
      bullet.life > 0 &&
      bullet.x > -margin &&
      bullet.x < size.width + margin &&
      bullet.y > -margin &&
      bullet.y < size.height + margin
  );
  game.orbs = game.orbs.filter((orb) => !orb.dead);
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

// ═══════════════════════════════════════════════
// 玩家移动
// ═══════════════════════════════════════════════

export function movePlayer(delta) {
  const player = game.player;
  const movement = getMovementVector();
  player.x += movement.x * player.speed * delta;
  player.y += movement.y * player.speed * delta;

  // clampPlayer 定义在 state.js，这里通过 game 引用即可
  const margin = player.radius + 12;
  player.x = clamp(player.x, margin, size.width - margin);
  player.y = clamp(player.y, margin, size.height - margin);

  if (movement.length > 0) {
    player.lastAim = movement;
  }
}

// ═══════════════════════════════════════════════
// 武器与技能
// ═══════════════════════════════════════════════

export function fireWeapon(delta) {
  const player = game.player;
  player.fireTimer -= delta;

  if (player.fireTimer > 0) return;
  if (!game.autoFire) return;
  if (game.enemies.length === 0 && !input.pointer.dragging) return;

  const aim = getAimVector();
  if (!aim || aim.length === 0) return;

  player.lastAim = { x: aim.x, y: aim.y };
  player.fireTimer = 1 / player.fireRate;
  game.shotCounter += 1;

  const burstEvery = Math.max(3, 7 - player.burstLevel);
  const pattern = player.burstLevel > 0 && game.shotCounter % burstEvery === 0 ? [-0.26, 0, 0.26] : [0];

  for (const angle of pattern) {
    const direction = rotateVector(aim, angle);
    game.bullets.push({
      x: player.x + direction.x * (player.radius + 8),
      y: player.y + direction.y * (player.radius + 8),
      vx: direction.x * player.bulletSpeed,
      vy: direction.y * player.bulletSpeed,
      radius: 4,
      damage: player.bulletDamage,
      pierce: player.bulletPierce,
      life: 1.5,
      color: angle === 0 ? '#31d9ff' : '#9cff57'
    });
  }

  if (game.shotCounter % 3 === 0) {
    playSound('shot');
  }
}

export function manualFire(targetX, targetY) {
  const player = game.player;
  const aim = normalize(targetX - player.x, targetY - player.y);
  if (!aim || aim.length === 0) return;

  player.lastAim = { x: aim.x, y: aim.y };
  const spread = [-0.12, -0.04, 0.04, 0.12];

  for (const angle of spread) {
    const direction = rotateVector(aim, angle);
    game.bullets.push({
      x: player.x + direction.x * (player.radius + 8),
      y: player.y + direction.y * (player.radius + 8),
      vx: direction.x * player.bulletSpeed,
      vy: direction.y * player.bulletSpeed,
      radius: 4,
      damage: player.bulletDamage,
      pierce: player.bulletPierce,
      life: 1.5,
      color: '#31d9ff'
    });
  }
  player.fireTimer = 0.25;
  playSound('shot');
}

export function triggerStarburst() {
  game.starburstTimer = Math.min(STARBURST.maxDuration, game.starburstTimer + STARBURST.duration);
  game.starburstFireTimer = 0;
  game.starburstActivations += 1;
  spawnPulseParticles(game.player.x, game.player.y, 96);
  playSound('level');
}

export function fireStarburstRing() {
  const player = game.player;
  const rotation = game.time * 2.2 + game.starburstRings * 0.17;

  for (let index = 0; index < STARBURST.bulletCount; index += 1) {
    const angle = rotation + (index / STARBURST.bulletCount) * Math.PI * 2;
    const direction = {
      x: Math.cos(angle),
      y: Math.sin(angle)
    };
    game.bullets.push({
      x: player.x + direction.x * (player.radius + 10),
      y: player.y + direction.y * (player.radius + 10),
      vx: direction.x * (player.bulletSpeed * 0.84),
      vy: direction.y * (player.bulletSpeed * 0.84),
      radius: 3.6,
      damage: Math.max(1, player.bulletDamage),
      pierce: Math.max(0, player.bulletPierce),
      life: 1.05,
      color: index % 2 === 0 ? '#ffbb4d' : '#31d9ff',
      source: 'starburst',
      angle
    });
  }

  game.starburstRings += 1;
  playSound('shot');
}

export function updateStarburst(delta) {
  if (game.starburstTimer <= 0) return;

  game.starburstTimer = Math.max(0, game.starburstTimer - delta);
  game.starburstFireTimer -= delta;

  while (game.starburstTimer > 0 && game.starburstFireTimer <= 0) {
    fireStarburstRing();
    game.starburstFireTimer += STARBURST.interval;
  }
}

export function updateSupportSkills(delta) {
  const player = game.player;

  if (player.phaseShieldLevel > 0 && !player.phaseShieldReady) {
    player.phaseShieldTimer = Math.max(0, player.phaseShieldTimer - delta);
    if (player.phaseShieldTimer <= 0) {
      player.phaseShieldReady = true;
      spawnParticles(player.x, player.y, '#31d9ff', 10, 90);
    }
  }

  if (player.magneticSurgeLevel > 0) {
    if (player.magneticSurgeActiveTimer > 0) {
      player.magneticSurgeActiveTimer = Math.max(0, player.magneticSurgeActiveTimer - delta);
    } else {
      player.magneticSurgeTimer = Math.max(0, player.magneticSurgeTimer - delta);
      if (player.magneticSurgeTimer <= 0) {
        player.magneticSurgeActiveTimer = 3;
        player.magneticSurgeTimer = player.magneticSurgeCooldown;
        spawnPulseParticles(player.x, player.y, getMagneticSurgeRadius());
        playSound('pickup');
      }
    }
  }
}

export function runPulse(delta) {
  const player = game.player;
  if (player.pulseDamage <= 0) return;

  player.pulseTimer -= delta;
  if (player.pulseTimer > 0) return;

  player.pulseTimer = 2.6;
  const radiusSq = player.pulseRadius * player.pulseRadius;
  let hits = 0;

  for (const enemy of game.enemies) {
    if (distanceSquared(player, enemy) <= radiusSq) {
      enemy.hp -= player.pulseDamage;
      spawnParticles(enemy.x, enemy.y, '#31d9ff', 4, 90);
      if (enemy.hp <= 0) enemy.dead = true;
      hits += 1;
    }
  }

  for (let index = game.enemies.length - 1; index >= 0; index -= 1) {
    if (game.enemies[index].dead) {
      killEnemy(game.enemies[index]);
      game.enemies.splice(index, 1);
    }
  }

  if (hits > 0) {
    spawnPulseParticles(player.x, player.y, player.pulseRadius);
    playSound('level');
  }
}

// ═══════════════════════════════════════════════
// 物理更新
// ═══════════════════════════════════════════════

export function updateEnemies(delta) {
  const player = game.player;
  const paceScale = 1 + Math.min(0.5, game.time / 180);

  for (const enemy of game.enemies) {
    const chase = normalize(player.x - enemy.x, player.y - enemy.y);
    let slowScale = 1;
    if (player.magneticSurgeActiveTimer > 0) {
      const surgeRadius = getMagneticSurgeRadius();
      if (distanceSquared(player, enemy) <= surgeRadius * surgeRadius) {
        slowScale = Math.max(0.42, 0.74 - player.magneticSurgeLevel * 0.06);
      }
    }
    enemy.phase += delta * 4;
    enemy.x += chase.x * enemy.speed * paceScale * slowScale * delta;
    enemy.y += chase.y * enemy.speed * paceScale * slowScale * delta;
    enemy.x += Math.cos(enemy.phase) * enemy.weave * delta;
    enemy.y += Math.sin(enemy.phase) * enemy.weave * delta;
  }
}

export function updateBullets(delta) {
  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
    bullet.life -= delta;
  }
}

export function updateOrbs(delta) {
  const player = game.player;
  const magnetRadius = getEffectiveMagnetRadius();

  for (const orb of game.orbs) {
    const toPlayer = normalize(player.x - orb.x, player.y - orb.y);
    if (toPlayer.length < magnetRadius) {
      const pull = clamp((magnetRadius - toPlayer.length) * 6, 70, 620);
      orb.vx += toPlayer.x * pull * delta;
      orb.vy += toPlayer.y * pull * delta;
    }

    orb.vx *= 0.965;
    orb.vy *= 0.965;
    orb.x += orb.vx * delta;
    orb.y += orb.vy * delta;

    if (toPlayer.length < player.radius + orb.radius + 4) {
      collectOrb(orb);
    }
  }
}

export function updateParticles(delta) {
  for (const particle of game.particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.95;
    particle.vy *= 0.95;
    particle.life -= delta;
  }
}

// ═══════════════════════════════════════════════
// 碰撞处理
// ═══════════════════════════════════════════════

export function handleBulletEnemyCollisions() {
  for (const bullet of game.bullets) {
    if (bullet.life <= 0) continue;

    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const hitRadius = bullet.radius + enemy.radius;

      if (distanceSquared(bullet, enemy) <= hitRadius * hitRadius) {
        enemy.hp -= bullet.damage;
        bullet.pierce -= 1;
        spawnParticles(bullet.x, bullet.y, enemy.color, 5, 90);

        if (enemy.hp <= 0) {
          enemy.dead = true;
        }

        if (bullet.pierce < 0) {
          bullet.life = 0;
          break;
        }
      }
    }
  }

  for (let index = game.enemies.length - 1; index >= 0; index -= 1) {
    if (game.enemies[index].dead) {
      killEnemy(game.enemies[index]);
      game.enemies.splice(index, 1);
    }
  }
}

export function handleEnemyPlayerCollisions(delta) {
  const player = game.player;
  // 归一化系数使碰撞分离在不同帧率下效果一致（基准约 30fps）
  const separationBase = 22 * delta * 30;

  for (const enemy of game.enemies) {
    const overlap = player.radius + enemy.radius;
    if (distanceSquared(player, enemy) <= overlap * overlap) {
      const away = normalize(enemy.x - player.x, enemy.y - player.y);
      enemy.x += away.x * separationBase;
      enemy.y += away.y * separationBase;

      if (player.hurtTimer <= 0) {
        if (player.phaseShieldReady) {
          player.phaseShieldReady = false;
          player.phaseShieldTimer = player.phaseShieldCooldown;
          player.hurtTimer = 0.45;
          game.shake = 5;
          spawnPulseParticles(player.x, player.y, player.radius + 28);
          playSound('pickup');
        } else {
          player.hp -= enemy.damage;
          player.hurtTimer = 0.72;
          game.shake = 10;
          spawnParticles(player.x, player.y, '#ff5c7a', 20, 170);
          playSound('damage');
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════
// 升级系统
// ═══════════════════════════════════════════════

export function pickUpgradeChoices() {
  const available = UPGRADE_DEFS.filter((upgrade) => (game.upgrades[upgrade.id] || 0) < upgrade.max);
  return shuffle(available).slice(0, Math.min(3, available.length));
}

export function applyUpgradeEffect(upgrade) {
  game.upgrades[upgrade.id] = (game.upgrades[upgrade.id] || 0) + 1;
  upgrade.apply(game);
}

export function applyUpgrade(id) {
  const upgrade = UPGRADE_DEFS.find((item) => item.id === id);
  if (!upgrade || game.mode !== 'upgrading') return;

  applyUpgradeEffect(upgrade);
  game.choices = [];
  playSound('pickup');

  if (game.xp >= game.xpToNext) {
    triggerLevelUp();
  } else {
    setMode('playing');
  }

  updateHud();
}

export function renderUpgradeChoices() {
  ui.upgradeOptions.replaceChildren();

  for (const choice of game.choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upgrade-choice';
    button.dataset.upgradeId = choice.id;

    const title = document.createElement('strong');
    title.textContent = choice.name;
    const description = document.createElement('span');
    description.textContent = choice.description;
    const level = document.createElement('em');
    level.textContent = `Level ${(game.upgrades[choice.id] || 0) + 1} / ${choice.max}`;

    button.append(title, description, level);
    button.addEventListener('click', () => applyUpgrade(choice.id));
    ui.upgradeOptions.append(button);
  }
}

export function triggerLevelUp() {
  while (game.xp >= game.xpToNext) {
    game.xp -= game.xpToNext;
    game.level += 1;
    game.xpToNext = Math.round(10 + game.level * 6 + game.level * game.level * 0.45);
    game.score += 35 * game.level;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + 0.5);
    game.choices = pickUpgradeChoices();
    renderUpgradeChoices();
    setMode('upgrading');
    playSound('level');
    return;
  }
}

// ═══════════════════════════════════════════════
// 游戏流程控制
// ═══════════════════════════════════════════════

export function setMode(nextMode) {
  if (!game || game.mode === nextMode) return;
  game.mode = nextMode;
  syncScreens();
}

export function startRun() {
  ensureAudio();
  setGame(createGame('playing'));
  syncScreens();
  playSound('level');
}

export function restartRun() {
  startRun();
}

export function togglePause() {
  if (!game) return;
  if (game.mode === 'playing') {
    setMode('paused');
  } else if (game.mode === 'paused') {
    setMode('playing');
  }
}

export function toggleMute() {
  settings.muted = !settings.muted;
  saveSettings();
  syncScreens();
  if (!settings.muted) {
    playSound('pickup');
  }
}

export function endRun() {
  saveHighScore(game.score);
  setMode('gameover');
  playSound('gameover');
}

// ═══════════════════════════════════════════════
// 主更新循环
// ═══════════════════════════════════════════════

export function updateGame(delta) {
  const player = game.player;
  game.time += delta;
  game.score += delta * (3 + Math.min(8, game.time / 25));
  game.shake = Math.max(0, game.shake - delta * 18);
  player.hurtTimer = Math.max(0, player.hurtTimer - delta);

  movePlayer(delta);
  updateSupportSkills(delta);
  updateSpawning(delta);
  fireWeapon(delta);
  updateStarburst(delta);
  updateEnemies(delta);
  updateBullets(delta);
  updateOrbs(delta);
  updateParticles(delta);
  runPulse(delta);
  handleBulletEnemyCollisions();
  handleEnemyPlayerCollisions(delta);
  cleanupEntities();
  triggerLevelUp();

  if (player.hp <= 0) {
    endRun();
  }
}
