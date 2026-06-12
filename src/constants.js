// 游戏平衡常量、敌人类型定义、升级定义、键位集合

export const STORAGE_KEYS = {
  highScore: 'neon-loop.highScore',
  settings: 'neon-loop.settings'
};

export const BALANCE = {
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

export const STARBURST = {
  chargeMax: 5,
  duration: 3,
  maxDuration: 4.5,
  interval: 0.16,
  bulletCount: 20
};

export const ENEMY_TYPES = {
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

export const UPGRADE_DEFS = [
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

export const MOVEMENT_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight'
]);
