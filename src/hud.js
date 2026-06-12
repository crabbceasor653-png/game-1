// HUD 更新与界面切换
import { STARBURST, UPGRADE_DEFS } from './constants.js';
import { clamp, formatNumber, formatTime } from './utils.js';
import { game, settings, highScore, ui } from './state.js';

export function updateHud() {
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

export function syncScreens() {
  const mode = game?.mode || 'title';
  document.body.dataset.gameMode = mode;
  ui.titleScreen.classList.toggle('hidden', mode !== 'title');
  ui.pauseScreen.classList.toggle('hidden', mode !== 'paused');
  ui.upgradeScreen.classList.toggle('hidden', mode !== 'upgrading');
  ui.gameoverScreen.classList.toggle('hidden', mode !== 'gameover');
  ui.pauseButton.textContent = mode === 'paused' ? 'Resume' : 'Pause';
  ui.muteButton.textContent = settings.muted ? 'Sound Off' : 'Sound On';

  if (ui.autoFireButton) {
    ui.autoFireButton.textContent = game?.autoFire ? 'Auto: ON' : 'Auto: OFF';
    ui.autoFireButton.classList.toggle('active', game?.autoFire ?? false);
  }

  if (mode === 'gameover') {
    updateFinalStats();
  }

  updateHud();
}
