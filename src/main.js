const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');

const ui = {
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
  runStats: document.querySelector('#run-stats')
};

const STORAGE_KEYS = {
  highScore: 'neon-loop.highScore',
  settings: 'neon-loop.settings'
};

const BALANCE = {
  playerHp: 7,
  playerSpeed: 225,
  magnetRadius: 125,
  initialXpToNext: 10,
  spawnBase: 0.5,
  spawnGrowth: 0.02,
  spawnMax: 3.4,
  enemyLimit: 72,
  runnerStart: 35,
  bruteStart: 80,
  enemyHpGrowthSeconds: 120
};

const STARBURST = {
  chargeMax: 5,
  duration: 3,
  maxDuration: 4.5,
  interval: 0.16,
  bulletCount: 20
};

const ENEMY_TYPES = {
  drone: {
    name: 'drone',
    hp: 2,
    speed: 82,
    radius: 15,
    damage: 1,
    score: 12,
    xp: 3,
    color: '#ff4db8',
    edge: '#ffd3ef',
    weave: 4
  },
  runner: {
    name: 'runner',
    hp: 1,
    speed: 142,
    radius: 12,
    damage: 1,
    score: 10,
    xp: 2,
    color: '#ffbb4d',
    edge: '#fff0bd',
    weave: 8
  },
  brute: {
    name: 'brute',
    hp: 7,
    speed: 52,
    radius: 23,
    damage: 1.5,
    score: 34,
    xp: 7,
    color: '#9cff57',
    edge: '#e4ffd0',
    weave: 2
  }
};

const UPGRADE_DEFS = [
  {
    id: 'rapid',
    name: '加速线圈',
    description: '开火频率提升 18%。',
    max: 6,
    apply: ({ player }) => {
      player.fireRate *= 1.18;
    }
  },
  {
    id: 'damage',
    name: '棱镜弹头',
    description: '子弹伤害 +1。',
    max: 5,
    apply: ({ player }) => {
      player.bulletDamage += 1;
    }
  },
  {
    id: 'pierce',
    name: '穿透导轨',
    description: '子弹额外穿透 1 个敌人。',
    max: 4,
    apply: ({ player }) => {
      player.bulletPierce += 1;
    }
  },
  {
    id: 'speed',
    name: '滑移引擎',
    description: '移动速度提升 14%。',
    max: 5,
    apply: ({ player }) => {
      player.speed *= 1.14;
    }
  },
  {
    id: 'magnet',
    name: '磁吸阵列',
    description: '能量吸附半径 +42。',
    max: 5,
    apply: ({ player }) => {
      player.magnetRadius += 42;
    }
  },
  {
    id: 'shield',
    name: '护盾电容',
    description: '最大生命 +1，并回复 2 点生命。',
    max: 4,
    apply: ({ player }) => {
      player.maxHp += 1;
      player.hp = Math.min(player.maxHp, player.hp + 2);
    }
  },
  {
    id: 'burst',
    name: '分裂核心',
    description: '周期性发射三向弹幕。',
    max: 3,
    apply: ({ player }) => {
      player.burstLevel += 1;
    }
  },
  {
    id: 'pulse',
    name: '脉冲外环',
    description: '定期释放近距离伤害脉冲。',
    max: 4,
    apply: ({ player }) => {
      player.pulseDamage += 1;
      player.pulseRadius += 18;
    }
  },
  {
    id: 'phaseShield',
    name: '相位护盾',
    description: '自动抵消一次碰撞伤害，升级缩短充能。',
    max: 4,
    apply: ({ player }) => {
      player.phaseShieldLevel += 1;
      player.phaseShieldCooldown = Math.max(7, 14 - (player.phaseShieldLevel - 1) * 2.2);
      player.phaseShieldReady = true;
      player.phaseShieldTimer = 0;
    }
  },
  {
    id: 'magneticSurge',
    name: '磁场收束',
    description: '定期扩大吸附范围，并短暂减速附近敌人。',
    max: 4,
    apply: ({ player }) => {
      player.magneticSurgeLevel += 1;
      player.magneticSurgeCooldown = Math.max(8, 13 - player.magneticSurgeLevel * 1.2);
      player.magneticSurgeTimer = Math.min(player.magneticSurgeTimer, 1.5);
    }
  },
  {
    id: 'regenBattery',
    name: '再生电池',
    description: '收集一定数量经验球后回复 1 点生命。',
    max: 4,
    apply: ({ player }) => {
      player.regenBatteryLevel += 1;
      player.regenOrbGoal = Math.max(6, 13 - player.regenBatteryLevel * 2);
    }
  },
  {
    id: 'repair',
    name: '应急修复',
    description: '立即回复 2 点生命。',
    max: 99,
    apply: ({ player }) => {
      player.hp = Math.min(player.maxHp, player.hp + 2);
    }
  }
];

const MOVEMENT_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight'
]);

const input = {
  keys: new Set(),
  pointer: {
    dragging: false,
    pointerId: null,
    x: 0,
    y: 0
  }
};

let size = {
  width: 1,
  height: 1,
  dpr: 1
};
let settings = loadSettings();
let highScore = loadHighScore();
let game = null;
let previousFrame = performance.now();
let audioContext = null;

function loadSettings() {
  try {
    return {
      muted: false,
      ...JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}')
    };
  } catch {
    return { muted: false };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {
    // Local storage can be unavailable in private contexts.
  }
}

function loadHighScore() {
  try {
    return Number(localStorage.getItem(STORAGE_KEYS.highScore) || 0);
  } catch {
    return 0;
  }
}

function saveHighScore(value) {
  highScore = Math.max(highScore, Math.floor(value));
  try {
    localStorage.setItem(STORAGE_KEYS.highScore, String(highScore));
  } catch {
    // Best effort only.
  }
}

function createGame(mode = 'title') {
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

function resizeCanvas() {
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length < 0.001) return { x: 0, y: 0, length: 0 };
  return { x: x / length, y: y / length, length };
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function rotateVector(vector, angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos
  };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function shuffle(values) {
  const list = [...values];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [list[index], list[target]] = [list[target], list[index]];
  }
  return list;
}

function formatNumber(value) {
  return Math.floor(value).toLocaleString('en-US');
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

function ensureAudio() {
  if (settings.muted) return;
  const activation = navigator.userActivation;
  if (!audioContext && activation && !activation.hasBeenActive && !activation.isActive) {
    return;
  }
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

function playSound(kind) {
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
}

function setMode(nextMode) {
  if (!game || game.mode === nextMode) return;
  game.mode = nextMode;
  syncScreens();
}

function startRun() {
  ensureAudio();
  game = createGame('playing');
  syncScreens();
  playSound('level');
}

function restartRun() {
  startRun();
}

function togglePause() {
  if (!game) return;
  if (game.mode === 'playing') {
    setMode('paused');
  } else if (game.mode === 'paused') {
    setMode('playing');
  }
}

function toggleMute() {
  settings.muted = !settings.muted;
  saveSettings();
  syncScreens();
  if (!settings.muted) {
    playSound('pickup');
  }
}

function clampPlayer() {
  const player = game.player;
  const margin = player.radius + 12;
  player.x = clamp(player.x, margin, size.width - margin);
  player.y = clamp(player.y, margin, size.height - margin);
}

function getMovementVector() {
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

function getNearestEnemy() {
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

function getAimVector() {
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

function getEffectiveMagnetRadius() {
  const player = game.player;
  if (player.magneticSurgeActiveTimer <= 0) return player.magnetRadius;
  return player.magnetRadius + 70 + player.magneticSurgeLevel * 30;
}

function getMagneticSurgeRadius() {
  const player = game.player;
  return 150 + player.magneticSurgeLevel * 42;
}

function movePlayer(delta) {
  const player = game.player;
  const movement = getMovementVector();
  player.x += movement.x * player.speed * delta;
  player.y += movement.y * player.speed * delta;
  clampPlayer();

  if (movement.length > 0) {
    player.lastAim = movement;
  }
}

function spawnEnemy() {
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

function updateSpawning(delta) {
  if (game.enemies.length > BALANCE.enemyLimit) return;
  const rate = clamp(BALANCE.spawnBase + game.time * BALANCE.spawnGrowth, BALANCE.spawnBase, BALANCE.spawnMax);
  game.spawnMeter += delta * rate;

  while (game.spawnMeter >= 1) {
    game.spawnMeter -= 1;
    spawnEnemy();
  }
}

function fireWeapon(delta) {
  const player = game.player;
  player.fireTimer -= delta;

  if (player.fireTimer > 0) return;
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

function updateEnemies(delta) {
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

function updateBullets(delta) {
  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
    bullet.life -= delta;
  }
}

function collectOrb(orb) {
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

function updateOrbs(delta) {
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

function updateParticles(delta) {
  for (const particle of game.particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.95;
    particle.vy *= 0.95;
    particle.life -= delta;
  }
}

function handleBulletEnemyCollisions() {
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

function handleEnemyPlayerCollisions() {
  const player = game.player;

  for (const enemy of game.enemies) {
    const overlap = player.radius + enemy.radius;
    if (distanceSquared(player, enemy) <= overlap * overlap) {
      const away = normalize(enemy.x - player.x, enemy.y - player.y);
      enemy.x += away.x * 22;
      enemy.y += away.y * 22;

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

function killEnemy(enemy) {
  game.kills += 1;
  game.score += enemy.score;
  spawnOrb(enemy.x, enemy.y, enemy.xp);
  spawnParticles(enemy.x, enemy.y, enemy.color, enemy.name === 'brute' ? 24 : 14, 160);
  playSound('pop');
}

function spawnOrb(x, y, value) {
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

function spawnParticles(x, y, color, amount, force) {
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

function triggerStarburst() {
  game.starburstTimer = Math.min(STARBURST.maxDuration, game.starburstTimer + STARBURST.duration);
  game.starburstFireTimer = 0;
  game.starburstActivations += 1;
  spawnPulseParticles(game.player.x, game.player.y, 96);
  playSound('level');
}

function fireStarburstRing() {
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

function updateStarburst(delta) {
  if (game.starburstTimer <= 0) return;

  game.starburstTimer = Math.max(0, game.starburstTimer - delta);
  game.starburstFireTimer -= delta;

  while (game.starburstTimer > 0 && game.starburstFireTimer <= 0) {
    fireStarburstRing();
    game.starburstFireTimer += STARBURST.interval;
  }
}

function updateSupportSkills(delta) {
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

function runPulse(delta) {
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

function spawnPulseParticles(x, y, radius) {
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

function cleanupEntities() {
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

function triggerLevelUp() {
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

function pickUpgradeChoices() {
  const available = UPGRADE_DEFS.filter((upgrade) => (game.upgrades[upgrade.id] || 0) < upgrade.max);
  return shuffle(available).slice(0, Math.min(3, available.length));
}

function applyUpgradeEffect(upgrade) {
  game.upgrades[upgrade.id] = (game.upgrades[upgrade.id] || 0) + 1;
  upgrade.apply(game);
}

function applyUpgrade(id) {
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

function updateGame(delta) {
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
  handleEnemyPlayerCollisions();
  cleanupEntities();
  triggerLevelUp();

  if (player.hp <= 0) {
    endRun();
  }
}

function endRun() {
  saveHighScore(game.score);
  setMode('gameover');
  playSound('gameover');
}

function installTestApi() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('test')) return;

  const api = {
    getSnapshot() {
      const starburstBullets = game.bullets.filter((bullet) => bullet.source === 'starburst');
      const starburstQuadrants = new Set(
        starburstBullets.map((bullet) => {
          const normalizedAngle = ((bullet.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          return Math.floor(normalizedAngle / (Math.PI / 2));
        })
      );

      return {
        mode: game.mode,
        time: game.time,
        score: game.score,
        highScore,
        level: game.level,
        xp: game.xp,
        xpToNext: game.xpToNext,
        hp: game.player.hp,
        maxHp: game.player.maxHp,
        enemies: game.enemies.length,
        enemyTypes: game.enemies.reduce((counts, enemy) => {
          counts[enemy.name] = (counts[enemy.name] || 0) + 1;
          return counts;
        }, {}),
        bullets: game.bullets.length,
        starburstBullets: starburstBullets.length,
        starburstQuadrants: starburstQuadrants.size,
        orbs: game.orbs.length,
        kills: game.kills,
        choices: game.choices.length,
        choiceIds: game.choices.map((choice) => choice.id),
        upgradeCatalog: UPGRADE_DEFS.map((upgrade) => upgrade.id),
        upgrades: Object.keys(game.upgrades).length,
        upgradeLevels: { ...game.upgrades },
        muted: settings.muted,
        skillCharge: game.skillCharge,
        skillChargeMax: game.skillChargeMax,
        starburstTimer: game.starburstTimer,
        starburstActivations: game.starburstActivations,
        starburstRings: game.starburstRings,
        balance: { ...BALANCE },
        stats: {
          speed: game.player.speed,
          fireRate: game.player.fireRate,
          bulletDamage: game.player.bulletDamage,
          bulletPierce: game.player.bulletPierce,
          magnetRadius: game.player.magnetRadius,
          effectiveMagnetRadius: getEffectiveMagnetRadius(),
          maxHp: game.player.maxHp,
          burstLevel: game.player.burstLevel,
          pulseDamage: game.player.pulseDamage,
          phaseShieldLevel: game.player.phaseShieldLevel,
          phaseShieldReady: game.player.phaseShieldReady,
          phaseShieldCooldown: game.player.phaseShieldCooldown,
          phaseShieldTimer: game.player.phaseShieldTimer,
          magneticSurgeLevel: game.player.magneticSurgeLevel,
          magneticSurgeActiveTimer: game.player.magneticSurgeActiveTimer,
          magneticSurgeCooldown: game.player.magneticSurgeCooldown,
          regenBatteryLevel: game.player.regenBatteryLevel,
          regenOrbGoal: game.player.regenOrbGoal,
          regenOrbCount: game.player.regenOrbCount
        },
        canvas: {
          width: canvas.clientWidth,
          height: canvas.clientHeight
        },
        player: {
          x: game.player.x,
          y: game.player.y
        }
      };
    },
    startRun,
    restartRun,
    togglePause,
    grantXp(amount) {
      game.xp += amount;
      triggerLevelUp();
      updateHud();
    },
    applyFirstUpgrade() {
      const choice = game.choices[0];
      if (choice) applyUpgrade(choice.id);
    },
    forceUpgrade(id) {
      const upgrade = UPGRADE_DEFS.find((item) => item.id === id);
      if (!upgrade) return api.getSnapshot();
      applyUpgradeEffect(upgrade);
      updateHud();
      return api.getSnapshot();
    },
    setPlayerHp(value) {
      game.player.hp = clamp(value, 0, game.player.maxHp);
      updateHud();
      return api.getSnapshot();
    },
    collectExperienceOrbs(count, value = 1) {
      for (let index = 0; index < count; index += 1) {
        collectOrb({
          x: game.player.x,
          y: game.player.y,
          vx: 0,
          vy: 0,
          radius: 6,
          value,
          dead: false
        });
      }
      updateHud();
      return api.getSnapshot();
    },
    resetSkillTestState() {
      game.skillCharge = 0;
      game.starburstTimer = 0;
      game.starburstFireTimer = 0;
      game.starburstActivations = 0;
      game.starburstRings = 0;
      game.bullets = game.bullets.filter((bullet) => bullet.source !== 'starburst');
      updateHud();
      return api.getSnapshot();
    },
    runFor(seconds) {
      const target = game.time + seconds;
      let guard = 0;
      while (game.time < target && guard < seconds * 90) {
        if (game.mode === 'upgrading') {
          api.applyFirstUpgrade();
        }
        if (game.mode !== 'playing') {
          setMode('playing');
        }

        updateGame(1 / 30);
        guard += 1;
      }
      updateHud();
      return api.getSnapshot();
    },
    collidePlayer() {
      game.player.hurtTimer = 0;
      const enemyBase = ENEMY_TYPES.drone;
      game.enemies.push({
        ...enemyBase,
        x: game.player.x,
        y: game.player.y,
        hp: enemyBase.hp,
        maxHp: enemyBase.hp,
        phase: 0,
        dead: false
      });
      const before = game.player.hp;
      handleEnemyPlayerCollisions();
      updateHud();
      return {
        before,
        after: game.player.hp,
        blocked: game.player.hp === before
      };
    },
    forceGameOver(score = game.score) {
      game.score = score;
      game.player.hp = 0;
      endRun();
      updateHud();
    },
    simulateSurvival(seconds = 180) {
      const wasMuted = settings.muted;
      settings.muted = true;

      if (game.mode !== 'playing') {
        startRun();
      }

      game.player.maxHp = Math.max(game.player.maxHp, 999);
      game.player.hp = game.player.maxHp;

      const target = game.time + seconds;
      let guard = 0;
      while (game.time < target && guard < seconds * 90) {
        if (game.mode === 'upgrading') {
          api.applyFirstUpgrade();
        }
        if (game.mode !== 'playing') {
          setMode('playing');
        }

        updateGame(1 / 30);
        game.player.hp = game.player.maxHp;
        guard += 1;
      }

      if (game.mode === 'upgrading') {
        api.applyFirstUpgrade();
      }
      if (game.mode !== 'playing') {
        setMode('playing');
      }

      settings.muted = wasMuted;
      updateHud();
      return api.getSnapshot();
    }
  };

  window.__NEON_LOOP_TEST_API__ = api;
}

function drawBackground() {
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

function drawPlayer(player) {
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

function drawSkillAuras(player) {
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

function drawEnemy(enemy) {
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

function drawBullet(bullet) {
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

function drawOrb(orb) {
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

function drawParticles() {
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

function render() {
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

function updateHud() {
  if (!game) return;
  const player = game.player;
  ui.score.textContent = formatNumber(game.score);
  ui.best.textContent = formatNumber(highScore);
  ui.level.textContent = String(game.level);
  ui.time.textContent = formatTime(game.time);
  ui.hpValue.textContent = `${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`;
  ui.xpValue.textContent = `${Math.floor(game.xp)}/${game.xpToNext}`;
  ui.skillValue.textContent =
    game.starburstTimer > 0 ? `${game.starburstTimer.toFixed(1)}s` : `${game.skillCharge}/${game.skillChargeMax}`;
  ui.hpBar.style.width = `${clamp(player.hp / player.maxHp, 0, 1) * 100}%`;
  ui.xpBar.style.width = `${clamp(game.xp / game.xpToNext, 0, 1) * 100}%`;
  ui.skillBar.style.width = `${
    game.starburstTimer > 0
      ? clamp(game.starburstTimer / STARBURST.maxDuration, 0, 1) * 100
      : clamp(game.skillCharge / game.skillChargeMax, 0, 1) * 100
  }%`;

  const active = UPGRADE_DEFS.filter((upgrade) => game.upgrades[upgrade.id])
    .map((upgrade) => `${upgrade.name} Lv.${game.upgrades[upgrade.id]}`)
    .join(' | ');
  const starburstText = game.starburstTimer > 0 ? `星环齐射 ${game.starburstTimer.toFixed(1)}s` : '';
  ui.upgradeStrip.textContent = [starburstText, active].filter(Boolean).join(' | ');
}

function renderUpgradeChoices() {
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

function updateFinalStats() {
  ui.runStats.replaceChildren();
  const stats = [
    ['Score', formatNumber(game.score)],
    ['Best', formatNumber(highScore)],
    ['Time', formatTime(game.time)],
    ['Kills', formatNumber(game.kills)],
    ['Level', String(game.level)],
    ['Upgrades', Object.keys(game.upgrades).length.toString()]
  ];

  for (const [label, value] of stats) {
    const item = document.createElement('div');
    const span = document.createElement('span');
    const strong = document.createElement('strong');
    span.textContent = label;
    strong.textContent = value;
    item.append(span, strong);
    ui.runStats.append(item);
  }
}

function syncScreens() {
  const mode = game?.mode || 'title';
  document.body.dataset.gameMode = mode;
  ui.titleScreen.classList.toggle('hidden', mode !== 'title');
  ui.pauseScreen.classList.toggle('hidden', mode !== 'paused');
  ui.upgradeScreen.classList.toggle('hidden', mode !== 'upgrading');
  ui.gameoverScreen.classList.toggle('hidden', mode !== 'gameover');
  ui.pauseButton.textContent = mode === 'paused' ? 'Resume' : 'Pause';
  ui.muteButton.textContent = settings.muted ? 'Sound Off' : 'Sound On';

  if (mode === 'gameover') {
    updateFinalStats();
  }

  updateHud();
}

function step(frameTime) {
  const delta = Math.min(0.033, (frameTime - previousFrame) / 1000);
  previousFrame = frameTime;

  if (game?.mode === 'playing') {
    updateGame(delta);
  }

  render();
  updateHud();
  requestAnimationFrame(step);
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp(event.clientX - rect.left, 0, size.width),
    y: clamp(event.clientY - rect.top, 0, size.height)
  };
}

function setupEvents() {
  ui.startButton.addEventListener('click', startRun);
  ui.resumeButton.addEventListener('click', () => setMode('playing'));
  ui.pauseRestartButton.addEventListener('click', restartRun);
  ui.gameoverRestartButton.addEventListener('click', restartRun);
  ui.pauseButton.addEventListener('click', togglePause);
  ui.restartButton.addEventListener('click', restartRun);
  ui.muteButton.addEventListener('click', toggleMute);

  canvas.addEventListener('pointerdown', (event) => {
    ensureAudio();
    canvas.setPointerCapture(event.pointerId);
    input.pointer.dragging = true;
    input.pointer.pointerId = event.pointerId;
    Object.assign(input.pointer, pointerPosition(event));
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!input.pointer.dragging || input.pointer.pointerId !== event.pointerId) return;
    Object.assign(input.pointer, pointerPosition(event));
  });

  window.addEventListener('pointerup', (event) => {
    if (input.pointer.pointerId === event.pointerId) {
      input.pointer.dragging = false;
      input.pointer.pointerId = null;
    }
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

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

    if (game.mode === 'upgrading' && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
      const index = Number(event.code.replace('Digit', '')) - 1;
      const choice = game.choices[index];
      if (choice) applyUpgrade(choice.id);
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });

  window.addEventListener('resize', resizeCanvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game?.mode === 'playing') {
      setMode('paused');
    }
  });
}

function init() {
  resizeCanvas();
  game = createGame('title');
  setupEvents();
  installTestApi();
  document.documentElement.dataset.gameReady = 'true';
  syncScreens();
  requestAnimationFrame(step);
}

init();
