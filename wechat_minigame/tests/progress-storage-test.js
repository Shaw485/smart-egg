'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const gameRoot = path.resolve(__dirname, '..');
const legacySaveKey = 'big_clever_save_v1';
const saveKey = 'smart_egg_wechat_save_v2';
const freshProgress = { unlocked: 1, completed: [] };

async function boot(storage = new Map(), options = {}) {
  let frame;
  let now = 1000;
  const drawnText = [];
  const context = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: text => ({ width: String(text).length * 20 }),
    fillText: text => drawnText.push(String(text))
  }, {
    get(target, key) {
      if (!(key in target)) target[key] = () => {};
      return target[key];
    }
  });
  const canvas = () => ({
    width: 1920, height: 1080,
    getContext: () => context,
    requestAnimationFrame: callback => { frame = callback; return 1; },
    cancelAnimationFrame() {}
  });
  const wx = {
    createCanvas: canvas,
    getWindowInfo: () => ({ windowWidth: 1920, windowHeight: 1080, pixelRatio: 1 }),
    getAppBaseInfo: () => ({ SDKVersion: 'test', language: 'zh_CN' }),
    getDeviceInfo: () => ({ platform: 'devtools' }),
    getStorageSync: key => storage.get(String(key)) || '',
    setStorageSync: (key, value) => {
      if (options.failSaveWrite && key === saveKey) throw new Error('Simulated save write failure');
      storage.set(String(key), value);
    },
    removeStorageSync: key => {
      if (options.failLegacyCleanup && key === legacySaveKey) throw new Error('Simulated cleanup failure');
      storage.delete(String(key));
    },
    clearStorageSync: () => { throw new Error('Progress operations must not clear unrelated storage'); },
    onTouchStart() {}, onTouchMove() {}, onTouchEnd() {}, onTouchCancel() {},
    onHide() {}, onShow() {}, onWindowResize() {},
    showModal() {}, showToast() {}, setClipboardData() {},
    getFileSystemManager: () => ({ writeFile() {} }),
    env: { USER_DATA_PATH: '/tmp' }
  };
  const sandbox = {
    wx,
    performance: { now: () => now },
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {}, table() {} },
    setTimeout: () => 1, clearTimeout() {},
    setInterval: () => 1, clearInterval() {},
    TextEncoder, TextDecoder
  };
  sandbox.GameGlobal = sandbox;
  vm.createContext(sandbox);
  sandbox.require = relative => {
    let source = fs.readFileSync(path.join(gameRoot, relative), 'utf8');
    if (relative === './js/smart-egg-game.js') {
      if (options.wechat === false) sandbox.__SMART_EGG_WECHAT_ENV__.window.__wxMiniGame = false;
      if (options.codeVersion) source = source.replace(
        /const GAME_CODE_VERSION = \d+;/, `const GAME_CODE_VERSION = ${options.codeVersion};`
      );
    }
    return vm.runInContext(source, sandbox, { filename: relative });
  };
  sandbox.require('./game.js');
  // The package starts asynchronously while probing its inline level bundle.
  await new Promise(resolve => setImmediate(resolve));
  const game = sandbox.__SMART_EGG_WECHAT_ENV__.window;
  assert.strictEqual(typeof frame, 'function', 'Cold start must reach the render loop');
  function tick(milliseconds = 17) {
    now += milliseconds;
    frame(now);
  }
  function progress() {
    let snapshot;
    game.AndroidLogExporter.exportLog = (_name, text) => { snapshot = JSON.parse(text); };
    game.__debug.exportLog();
    return snapshot.runtime.game.progress;
  }
  return { game, storage, tick, progress, drawnText };
}

(async () => {
  const first = await boot();
  assert.deepStrictEqual(first.progress(), freshProgress,
    'A new player must start with zero completed levels and only level 1 unlocked');
  first.game.__debug.setState('levelSelect');
  first.tick();
  assert.ok(first.drawnText.includes('已通关: 0 / 20'),
    'The actual level-select screen must show 0 / 20 for a new player');
  assert.ok(!first.drawnText.includes('✓ 已通关'),
    'A new player must not see any pre-completed level');

  // Reach the real first-level goal and let the normal completion path save it.
  first.game.__debug.loadLevelAndStart();
  first.game.__debug.setState('playing');
  const door = first.game.__debug.getLevelData().doors.find(item => item.is_goal);
  Object.assign(first.game.__debug.getPlayer(), {
    x: door.x, y: door.y, vx: 0, vy: 0, alive: true
  });
  first.tick();
  assert.strictEqual(first.game.__debug.getShowSuccess(), true, 'The real goal must be reached');
  first.tick(300);
  assert.deepStrictEqual(first.progress(), { unlocked: 2, completed: [0] },
    'Completing level 1 must save exactly one completion and unlock level 2');
  assert.ok(first.storage.has(saveKey), 'Normal completion must persist a save');

  const reopened = await boot(first.storage);
  assert.deepStrictEqual(reopened.progress(), { unlocked: 2, completed: [0] },
    'Reopening must retain the progress earned by this player');
  assert.deepStrictEqual((await boot(first.storage, { codeVersion: 193 })).progress(), {
    unlocked: 2, completed: [0]
  }, 'A later code version must not trigger another progress reset');
  assert.deepStrictEqual((await boot()).progress(), freshProgress,
    'A different new player must not inherit another player’s progress');

  const oldSave = JSON.stringify({
    unlocked: 20, completed: Array.from({ length: 20 }, (_, i) => i), mainline_revision: 179
  });
  const creatorData = JSON.stringify([{ id: 'keep-my-level' }]);
  const faultData = JSON.stringify({ schemaVersion: 1, lastFault: { id: 'keep-my-fault' } });
  const existing = new Map([
    [legacySaveKey, oldSave],
    ['smart_egg_creator_levels_v1', creatorData],
    ['smart_egg_fault_journal_v1', faultData]
  ]);
  const upgraded = await boot(existing);
  assert.deepStrictEqual(upgraded.progress(), freshProgress, 'Upgrading must reset an old 20/20 save');
  assert.strictEqual(existing.has(legacySaveKey), false, 'Old completion records must be removed');
  assert.ok(existing.has(saveKey), 'First launch must persist the new empty save immediately');
  assert.strictEqual(existing.get('smart_egg_creator_levels_v1'), creatorData);
  assert.strictEqual(existing.get('smart_egg_fault_journal_v1'), faultData);
  assert.deepStrictEqual((await boot(existing)).progress(), freshProgress);
  assert.ok(!((await boot(existing)).game._findLogs('wechat-progress-reset', 'progress').length),
    'The reset must not repeat on later launches');

  // Earn progress after an upgrade, then reopen with a reintroduced legacy save.
  upgraded.game.__debug.loadLevelAndStart();
  upgraded.game.__debug.setState('playing');
  const upgradedDoor = upgraded.game.__debug.getLevelData().doors.find(item => item.is_goal);
  Object.assign(upgraded.game.__debug.getPlayer(), {
    x: upgradedDoor.x, y: upgradedDoor.y, vx: 0, vy: 0, alive: true
  });
  upgraded.tick();
  upgraded.tick(300);
  existing.set(legacySaveKey, oldSave);
  assert.deepStrictEqual((await boot(existing)).progress(), { unlocked: 2, completed: [0] },
    'Newly earned progress must take precedence even if the old save reappears');

  const cleanupFailure = new Map([[legacySaveKey, oldSave]]);
  assert.deepStrictEqual((await boot(cleanupFailure, { failLegacyCleanup: true })).progress(), freshProgress);
  cleanupFailure.set(saveKey, JSON.stringify({ unlocked: 2, completed: [0], mainline_revision: 179 }));
  assert.deepStrictEqual((await boot(cleanupFailure)).progress(), { unlocked: 2, completed: [0] },
    'Retrying old-save cleanup must not erase new progress');
  assert.strictEqual(cleanupFailure.has(legacySaveKey), false);

  const writeFailure = new Map([[legacySaveKey, oldSave]]);
  assert.deepStrictEqual((await boot(writeFailure, { failSaveWrite: true })).progress(), freshProgress,
    'Storage failure must never restore the old completed progress into gameplay');
  assert.strictEqual(writeFailure.get(legacySaveKey), oldSave,
    'Old-save cleanup must wait until the new save is successfully written');
  assert.deepStrictEqual((await boot(writeFailure)).progress(), freshProgress);
  assert.strictEqual(writeFailure.has(legacySaveKey), false);
  assert.deepStrictEqual((await boot(new Map([[legacySaveKey, 'invalid-json']]))).progress(), freshProgress,
    'Malformed legacy saves must not interfere with the reset');
  const webStorage = new Map([[legacySaveKey, oldSave]]);
  assert.deepStrictEqual((await boot(webStorage, { wechat: false })).progress(), {
    unlocked: 20, completed: Array.from({ length: 20 }, (_, i) => i)
  }, 'The shared runtime must preserve web/Android progress');
  assert.strictEqual(webStorage.get(legacySaveKey), oldSave);
  assert.strictEqual(webStorage.has(saveKey), false);

  console.log('Progress storage passed: one-time reset, real completion, reopen, device isolation, and storage failures.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
