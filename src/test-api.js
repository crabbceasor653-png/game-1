// 测试 API — 仅在 ?test 查询参数存在时挂载到 window.__NEON_LOOP_TEST_API__
import { BALANCE, STARBURST, ENEMY_TYPES, UPGRADE_DEFS } from './constants.js';
import { clamp } from './utils.js';
import { game, size, settings, highScore, canvas } from './state.js';
import {
  startRun, restartRun, togglePause, setMode, endRun,
  updateGame, triggerLevelUp, applyUpgrade, applyUpgradeEffect,
  collectOrb, handleEnemyPlayerCollisions,
  getEffectiveMagnetRadius
} from './systems.js';
import { updateHud } from './hud.js';

export function installTestApi() {
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
      handleEnemyPlayerCollisions(1 / 30);
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
