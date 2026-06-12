import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon']
]);

const browserCandidates = [
  process.env.BROWSER_PATH,
  process.env.EDGE_PATH,
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'msedge',
  'chrome',
  'google-chrome',
  'chromium',
  'chromium-browser'
].filter(Boolean);

function getContentType(filePath) {
  return mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function safeResolve(requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const normalized = path.normalize(decoded === '/' ? '/index.html' : decoded).replace(/^([/\\])+/, '');
  return path.resolve(rootDir, normalized);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProcessExit(child, timeout = 2500) {
  if (child.exitCode !== null) return;

  await Promise.race([
    once(child, 'exit'),
    delay(timeout)
  ]);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findBrowser() {
  for (const candidate of browserCandidates) {
    if (candidate.includes('\\') || candidate.includes('/')) {
      if (await fileExists(candidate)) return candidate;
    } else {
      return candidate;
    }
  }

  throw new Error('No compatible Edge or Chrome browser found. Set BROWSER_PATH to run the smoke test.');
}

async function createStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      let filePath = safeResolve(req.url || '/');
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      let fileData = null;
      try {
        fileData = await fs.readFile(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      if (!fileData) {
        filePath = path.join(rootDir, 'index.html');
        fileData = await fs.readFile(filePath);
      }

      res.writeHead(200, {
        'Content-Type': getContentType(filePath),
        'Cache-Control': 'no-store'
      });
      res.end(fileData);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error.message);
    }
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

async function getFreePort() {
  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

async function waitForJson(url, timeout = 6000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await delay(120);
  }

  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(`${message.error.message}: ${message.error.data || ''}`));
      } else {
        resolve(message.result || {});
      }
      return;
    }

    const callbacks = listeners.get(message.method);
    if (callbacks) {
      for (const callback of callbacks) callback(message.params || {});
    }
  });

  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  return {
    async open() {
      await opened;
    },
    on(method, callback) {
      if (!listeners.has(method)) listeners.set(method, new Set());
      listeners.get(method).add(callback);
    },
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    close() {
      socket.close();
    }
  };
}

async function launchBrowser(browserPath, debugPort, appUrl) {
  const userDataDir = path.join(os.tmpdir(), `neon-loop-browser-${Date.now()}`);
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--disable-software-rasterizer',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--disable-extensions',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    appUrl
  ];

  const browser = spawn(browserPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  let stderr = '';
  browser.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  browser.stdout.resume();

  return {
    process: browser,
    userDataDir,
    getStderr: () => stderr
  };
}

async function waitForPageTarget(debugPort, appUrl) {
  const targetsUrl = `http://127.0.0.1:${debugPort}/json`;
  const start = Date.now();

  while (Date.now() - start < 8000) {
    let targets = [];
    try {
      targets = await waitForJson(targetsUrl, 1000);
    } catch {
      await delay(150);
      continue;
    }
    const target = targets.find((item) => item.type === 'page' && item.url.startsWith(appUrl));
    if (target?.webSocketDebuggerUrl) return target;
    await delay(150);
  }

  throw new Error('Timed out waiting for browser page target.');
}

async function evaluate(cdp, expression, options = {}) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    ...options
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed.');
  }

  return result.result?.value;
}

async function waitFor(cdp, expression, timeout = 5000, label = expression) {
  const start = Date.now();
  let value = null;

  while (Date.now() - start < timeout) {
    value = await evaluate(cdp, expression);
    if (value) return value;
    await delay(120);
  }

  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(value)}`);
}

async function key(cdp, type, code, keyValue) {
  await cdp.send('Input.dispatchKeyEvent', {
    type,
    code,
    key: keyValue,
    windowsVirtualKeyCode: keyValue.length === 1 ? keyValue.toUpperCase().charCodeAt(0) : 0
  });
}

async function drag(cdp, from, to) {
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: from.x,
    y: from.y,
    button: 'left',
    clickCount: 1
  });
  await delay(80);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: to.x,
    y: to.y,
    button: 'left',
    buttons: 1
  });
  await delay(420);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: to.x,
    y: to.y,
    button: 'left',
    clickCount: 1
  });
}

async function click(cdp, point) {
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1
  });
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1
  });
}

async function tap(cdp, point) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: point.x, y: point.y }]
  });
  await delay(80);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: []
  });
}

async function touchDrag(cdp, from, to) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y }]
  });
  await delay(80);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: to.x, y: to.y }]
  });
  await delay(460);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: []
  });
}

async function runSmoke() {
  const browserPath = await findBrowser();
  const staticServer = await createStaticServer();
  const appPort = staticServer.address().port;
  const debugPort = await getFreePort();
  const appUrl = `http://127.0.0.1:${appPort}/index.html?test=1`;
  const browser = await launchBrowser(browserPath, debugPort, appUrl);
  let cdp = null;
  const browserErrors = [];

  try {
    const target = await waitForPageTarget(debugPort, appUrl);
    cdp = createCdpClient(target.webSocketDebuggerUrl);
    await cdp.open();
    cdp.on('Runtime.exceptionThrown', (params) => {
      browserErrors.push(params.exceptionDetails?.text || 'Runtime exception');
    });
    cdp.on('Log.entryAdded', (params) => {
      if (['error', 'warning'].includes(params.entry?.level)) {
        browserErrors.push(params.entry.text);
      }
    });

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send('Page.reload', { ignoreCache: true });
    await waitFor(cdp, "document.documentElement.dataset.gameReady === 'true'", 5000, 'game ready');

    let snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.mode === 'title', 'Expected title mode after load.');
    assert(snapshot.canvas.width >= 1200 && snapshot.canvas.height >= 700, 'Expected desktop canvas dimensions.');

    const startPoint = await evaluate(
      cdp,
      `(() => {
        const rect = document.querySelector('#start-button').getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`
    );
    await click(cdp, startPoint);
    await delay(500);
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.mode === 'playing', 'Start run did not enter playing mode.');
    assert(snapshot.time > 0, 'Game loop did not advance after starting.');
    assert(snapshot.maxHp === 7 && snapshot.hp === 7, 'New run did not use the easier 7 HP start.');
    assert(snapshot.stats.speed === 225, 'New run did not use the easier movement speed.');
    assert(snapshot.stats.magnetRadius === 125, 'New run did not use the easier magnet radius.');
    assert(snapshot.xpToNext === 10, 'New run did not use the lower first upgrade threshold.');
    assert(snapshot.balance.spawnBase === 0.5 && snapshot.balance.spawnMax === 3.4, 'Easier spawn balance constants are incorrect.');
    assert(snapshot.balance.runnerStart === 35 && snapshot.balance.bruteStart === 80, 'Strong enemy timing constants are incorrect.');

    const beforeKeyboard = snapshot.player.x;
    await key(cdp, 'keyDown', 'KeyD', 'd');
    await delay(520);
    await key(cdp, 'keyUp', 'KeyD', 'd');
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.player.x > beforeKeyboard + 20, 'Keyboard movement did not move the player.');

    const beforePointer = snapshot.player.y;
    await drag(cdp, { x: snapshot.player.x, y: snapshot.player.y }, { x: snapshot.player.x, y: snapshot.player.y + 170 });
    await delay(250);
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.player.y > beforePointer + 10, 'Mouse drag movement did not move the player.');

    const collision = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.collidePlayer()');
    assert(collision.after < collision.before, 'Collision did not reduce player HP.');

    await delay(3200);
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.enemies > 0 || snapshot.kills > 0, 'Enemy spawning did not produce enemies or kills.');
    assert(snapshot.bullets > 0 || snapshot.kills > 0, 'Auto-fire did not produce bullets or kills.');

    await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.resetSkillTestState()');
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.collectExperienceOrbs(5)');
    assert(snapshot.skillCharge === 0, 'Collecting five orbs did not consume skill charge.');
    assert(snapshot.starburstTimer > 2.8 && snapshot.starburstTimer <= 3, 'Five orbs did not trigger a 3 second starburst.');
    assert(snapshot.starburstActivations >= 1, 'Starburst activation count did not increase.');

    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.runFor(0.2)');
    assert(snapshot.starburstBullets >= 20, 'Starburst did not create a full ring of bullets.');
    assert(snapshot.starburstQuadrants === 4, 'Starburst bullets did not cover all four quadrants.');

    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.runFor(3.2)');
    assert(snapshot.starburstTimer === 0, 'Starburst did not end after its duration.');

    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.collectExperienceOrbs(5)');
    const firstStarburstTimer = snapshot.starburstTimer;
    await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.runFor(0.1)');
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.collectExperienceOrbs(5)');
    assert(snapshot.starburstTimer > firstStarburstTimer, 'Starburst did not extend when charged during activation.');
    assert(snapshot.starburstTimer <= 4.5, 'Starburst extension exceeded the 4.5 second cap.');

    await evaluate(
      cdp,
      `if (window.__NEON_LOOP_TEST_API__.getSnapshot().mode === 'upgrading') {
        window.__NEON_LOOP_TEST_API__.applyFirstUpgrade();
      }`
    );
    await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.grantXp(window.__NEON_LOOP_TEST_API__.getSnapshot().xpToNext)');
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.mode === 'upgrading', 'Granting XP did not enter upgrade mode.');
    assert(snapshot.choices >= 3, 'Upgrade mode did not present at least 3 choices.');

    const upgradeBefore = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot().stats');
    const chosenUpgrade = await evaluate(
      cdp,
      `[...document.querySelectorAll('.upgrade-choice')]
        .map((button) => button.dataset.upgradeId)
        .find((id) => id !== 'repair')`
    );
    assert(chosenUpgrade, 'No non-repair upgrade choice was available for stat verification.');
    await evaluate(cdp, `document.querySelector('[data-upgrade-id="${chosenUpgrade}"]').click()`);
    await delay(150);
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.mode === 'playing', 'Applying upgrade did not resume play.');
    assert(snapshot.upgrades >= 1, 'Upgrade was not recorded.');
    assert(JSON.stringify(snapshot.stats) !== JSON.stringify(upgradeBefore), 'Upgrade did not change player stats.');
    assert(
      ['phaseShield', 'magneticSurge', 'regenBattery'].every((id) => snapshot.upgradeCatalog.includes(id)),
      'New defensive skill upgrades are not in the upgrade pool.'
    );

    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.forceUpgrade("phaseShield")');
    assert(snapshot.stats.phaseShieldLevel >= 1 && snapshot.stats.phaseShieldReady, 'Phase Shield upgrade did not arm a shield.');
    const shieldCollision = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.collidePlayer()');
    assert(shieldCollision.blocked, 'Phase Shield did not block collision damage.');

    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.forceUpgrade("magneticSurge")');
    const magnetBefore = snapshot.stats.effectiveMagnetRadius;
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.runFor(0.2)');
    assert(snapshot.stats.magneticSurgeActiveTimer > 0, 'Magnetic Surge did not activate.');
    assert(snapshot.stats.effectiveMagnetRadius > magnetBefore, 'Magnetic Surge did not expand pickup radius.');

    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.forceUpgrade("regenBattery")');
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.setPlayerHp(window.__NEON_LOOP_TEST_API__.getSnapshot().maxHp - 2)');
    const regenBefore = snapshot.hp;
    const regenGoal = snapshot.stats.regenOrbGoal;
    snapshot = await evaluate(cdp, `window.__NEON_LOOP_TEST_API__.collectExperienceOrbs(${regenGoal})`);
    assert(snapshot.hp > regenBefore, 'Regen Battery did not restore HP after enough orbs.');
    await evaluate(
      cdp,
      `if (window.__NEON_LOOP_TEST_API__.getSnapshot().mode === 'upgrading') {
        window.__NEON_LOOP_TEST_API__.applyFirstUpgrade();
      }`
    );
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    if (snapshot.mode !== 'playing') {
      await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.togglePause()');
    }

    await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.togglePause()');
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.mode === 'paused', 'Pause did not enter paused mode.');
    await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.togglePause()');

    await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.forceGameOver(3210)');
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.mode === 'gameover', 'Force game over did not enter gameover mode.');
    assert(snapshot.highScore >= 3210, 'High score was not saved after game over.');

    const restartPoint = await evaluate(
      cdp,
      `(() => {
        const rect = document.querySelector('#gameover-restart-button').getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`
    );
    await click(cdp, restartPoint);
    await delay(350);
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.mode === 'playing', 'Restart button did not start a new run.');

    const mutePoint = await evaluate(
      cdp,
      `(() => {
        const rect = document.querySelector('#mute-button').getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`
    );
    await click(cdp, mutePoint);
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.muted === true, 'Mute button did not toggle muted state.');

    await cdp.send('Page.reload', { ignoreCache: true });
    await waitFor(cdp, "document.documentElement.dataset.gameReady === 'true'", 5000, 'game ready after mute reload');
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.highScore >= 3210, 'High score did not persist after reload.');
    assert(snapshot.muted === true, 'Muted setting did not persist after reload.');

    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.simulateSurvival(180)');
    assert(snapshot.mode === 'playing', '180 second survival simulation did not remain playable.');
    assert(snapshot.time >= 180, '180 second survival simulation did not advance game time.');
    assert(snapshot.score > 0, '180 second survival simulation did not score.');

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await cdp.send('Page.reload', { ignoreCache: true });
    await waitFor(cdp, "document.documentElement.dataset.gameReady === 'true'", 5000, 'mobile game ready');
    const mobileLayout = await evaluate(
      cdp,
      `(() => {
        const canvas = document.querySelector('#game-canvas').getBoundingClientRect();
        const app = document.querySelector('#app').getBoundingClientRect();
        const buttons = [...document.querySelectorAll('button')].filter((button) => {
          return button.getClientRects().length > 0;
        }).every((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.left >= -1 && rect.right <= innerWidth + 1;
        });
        return {
          canvasOk: canvas.width >= 380 && canvas.height >= 830,
          appOk: app.width <= innerWidth + 1 && app.height <= innerHeight + 1,
          buttonsOk: buttons,
          noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1
        };
      })()`
    );
    assert(mobileLayout.canvasOk, 'Mobile canvas dimensions are incorrect.');
    assert(mobileLayout.appOk, 'Mobile app layout exceeds viewport.');
    assert(mobileLayout.buttonsOk, 'A mobile button is outside the viewport.');
    assert(mobileLayout.noHorizontalOverflow, 'Mobile layout has horizontal overflow.');

    const mobileStartPoint = await evaluate(
      cdp,
      `(() => {
        const rect = document.querySelector('#start-button').getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`
    );
    await tap(cdp, mobileStartPoint);
    await delay(400);
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.mode === 'playing', 'Touch tap did not start the game on mobile.');
    const beforeTouch = snapshot.player.x;
    await touchDrag(cdp, { x: snapshot.player.x, y: snapshot.player.y }, { x: snapshot.player.x - 140, y: snapshot.player.y });
    await delay(220);
    snapshot = await evaluate(cdp, 'window.__NEON_LOOP_TEST_API__.getSnapshot()');
    assert(snapshot.player.x < beforeTouch - 8, 'Touch drag did not move the player on mobile.');

    assert(browserErrors.length === 0, `Browser errors detected: ${browserErrors.join(' | ')}`);
  } finally {
    if (cdp) cdp.close();
    if (browser.process.exitCode === null) browser.process.kill();
    await waitForProcessExit(browser.process);
    staticServer.close();
    await once(staticServer, 'close').catch(() => {});
    await fs.rm(browser.userDataDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 }).catch(() => {});
  }

  console.log('Browser smoke test passed.');
}

runSmoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
