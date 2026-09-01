'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const webAsset = path.join(root, 'web_preview/assets/sfx-door-knock.wav');
const wechatAsset = path.join(root, 'wechat_minigame/assets/sfx-door-knock.wav');
const game = fs.readFileSync(path.join(root, 'web_preview/game.js'), 'utf8');
const adapter = fs.readFileSync(path.join(root, 'wechat_minigame/js/wechat-adapter.js'), 'utf8');

assert.ok(fs.existsSync(webAsset), 'Web 必须包含独立木质敲门采样');
assert.ok(fs.existsSync(wechatAsset), '微信小游戏必须包含独立木质敲门采样');
const webWav = fs.readFileSync(webAsset);
const wechatWav = fs.readFileSync(wechatAsset);
assert.deepStrictEqual(wechatWav, webWav, 'Web 与微信小游戏必须使用同一份敲门采样');
assert.strictEqual(webWav.toString('ascii', 0, 4), 'RIFF', '敲门采样必须使用 RIFF 容器');
assert.strictEqual(webWav.toString('ascii', 8, 12), 'WAVE', '敲门采样必须是 WAVE 文件');
assert.strictEqual(webWav.readUInt16LE(20), 1, '敲门采样必须是未压缩 PCM');
assert.strictEqual(webWav.readUInt16LE(22), 1, '敲门采样必须为单声道');
assert.strictEqual(webWav.readUInt32LE(24), 16000, '敲门采样必须为 16 kHz');
assert.strictEqual(webWav.readUInt16LE(34), 16, '敲门采样必须为 PCM16');

const dataOffset = webWav.indexOf(Buffer.from('data'));
assert.ok(dataOffset >= 36, '敲门采样必须包含 data 数据块');
const dataSize = webWav.readUInt32LE(dataOffset + 4);
const dataStart = dataOffset + 8;
assert.ok(dataStart + dataSize <= webWav.length, '敲门采样 data 数据块不能越界');
const durationSeconds = dataSize / (16000 * 2);
assert.ok(durationSeconds >= 0.18 && durationSeconds <= 0.5,
  `敲门采样应保持短促，当前 ${durationSeconds.toFixed(3)} 秒`);

let peak = 0;
let sumSquares = 0;
let samples = 0;
for (let offset = dataStart; offset + 1 < dataStart + dataSize; offset += 2) {
  const sample = webWav.readInt16LE(offset);
  peak = Math.max(peak, Math.abs(sample));
  sumSquares += sample * sample;
  samples += 1;
}
const rms = Math.sqrt(sumSquares / samples);
assert.ok(peak >= 2000 && rms >= 250, '敲门采样不能是静音或过弱的占位音');

assert.match(game, /_playWebAssetSfx\('assets\/sfx-door-knock\.wav',\s*0\.82,\s*'door-knock',\s*_playKnockFallback\)/,
  'Web 第 5 关必须优先播放独立敲门采样');
assert.match(game, /_tone\(180,\s*0\.24,\s*'triangle',\s*0\.16,\s*0,\s*92,\s*'door-knock'\)/,
  '微信运行时必须把敲门请求标记为 door-knock');
assert.match(adapter, /sampleId === 'door-knock' \? 'assets\/sfx-door-knock\.wav'/,
  '微信适配层必须把 door-knock 路由到独立资源');
assert.match(adapter, /sampleId === 'door-knock'[\s\S]{0,120}Math\.max\(0\.72,\s*Math\.min\(1,\s*gain \* 5\.2\)\)/,
  '微信敲门采样必须使用清晰可听的专用音量下限');
assert.match(adapter, /audio\.autoplay = true/,
  '微信敲门等短动作采样必须具有不依赖 canplay 的 autoplay\/onPlay 主动启动路径');
assert.match(adapter, /if \(destroyed \|\| playbackConfirmed \|\| playRequested\) return/,
  'autoplay 成功后迟到的 canplay 不能重复播放同一敲门采样');
assert.match(game, /fallbackOnce\('play-rejected',error\)/,
  'Web 资源播放 Promise 被拒绝时必须记录并走一次性兜底');
assert.match(game, /fallbackOnce\('media-error', event && \(event\.error \|\| event\)\)/,
  'Web 资源加载或解码错误时必须记录并走一次性兜底');

console.log(
  `第5关敲门音效测试通过：Web/微信采样一致，${durationSeconds.toFixed(3)} 秒，` +
  `peak=${peak}，rms=${rms.toFixed(2)}，专用资源路由有效。`
);
