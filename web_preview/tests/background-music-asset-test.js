'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const gamePath = path.join(root, 'web_preview/game.js');
const bgmRelativePath = 'assets/bgm-wilds-ambient.wav';
const bgmPath = path.join(root, 'web_preview', bgmRelativePath);

assert.ok(fs.existsSync(bgmPath), `Web 背景音乐文件不存在：${bgmRelativePath}`);

const wav = fs.readFileSync(bgmPath);
assert.ok(wav.length >= 44, '背景音乐 WAV 文件过短，缺少完整 RIFF/WAVE 头');
assert.strictEqual(wav.toString('ascii', 0, 4), 'RIFF', '背景音乐必须使用 RIFF 容器');
assert.strictEqual(wav.toString('ascii', 8, 12), 'WAVE', '背景音乐必须是 WAVE 文件');

let format = null;
const dataChunks = [];
let offset = 12;
while (offset + 8 <= wav.length) {
  const chunkId = wav.toString('ascii', offset, offset + 4);
  const chunkSize = wav.readUInt32LE(offset + 4);
  const chunkStart = offset + 8;
  const chunkEnd = chunkStart + chunkSize;
  assert.ok(chunkEnd <= wav.length,
    `WAV ${chunkId} 数据块越界：end=${chunkEnd}, file=${wav.length}`);

  if (chunkId === 'fmt ') {
    assert.ok(chunkSize >= 16, 'WAV fmt 数据块必须至少有 16 字节');
    format = {
      audioFormat: wav.readUInt16LE(chunkStart),
      channels: wav.readUInt16LE(chunkStart + 2),
      sampleRate: wav.readUInt32LE(chunkStart + 4),
      byteRate: wav.readUInt32LE(chunkStart + 8),
      blockAlign: wav.readUInt16LE(chunkStart + 12),
      bitsPerSample: wav.readUInt16LE(chunkStart + 14)
    };
  } else if (chunkId === 'data') {
    dataChunks.push({ start:chunkStart, end:chunkEnd, size:chunkSize });
  }

  offset = chunkEnd + (chunkSize % 2);
}

assert.ok(format, '背景音乐 WAV 缺少 fmt 数据块');
assert.strictEqual(format.audioFormat, 1, '背景音乐必须是未压缩 PCM');
assert.strictEqual(format.channels, 1, '背景音乐必须是单声道');
assert.strictEqual(format.bitsPerSample, 16, '背景音乐必须是 PCM16');
assert.strictEqual(format.blockAlign, 2, 'PCM16 单声道 blockAlign 必须为 2');
assert.strictEqual(format.byteRate, format.sampleRate * format.blockAlign,
  'WAV byteRate 必须与采样率和 blockAlign 一致');
assert.ok(dataChunks.length > 0, '背景音乐 WAV 缺少 data 数据块');

const dataBytes = dataChunks.reduce((sum, chunk) => sum + chunk.size, 0);
const durationSeconds = dataBytes / format.byteRate;
assert.ok(durationSeconds >= 10,
  `背景音乐必须至少 10 秒，当前仅 ${durationSeconds.toFixed(3)} 秒`);

let sampleCount = 0;
let nonZeroSamples = 0;
let peak = 0;
let sumSquares = 0;
let highPassSumSquares = 0;
let previousSample = 0;
let previousHighPass = 0;
const highPassCutoffHz = 250;
const highPassRc = 1 / (2 * Math.PI * highPassCutoffHz);
const highPassAlpha = highPassRc / (highPassRc + 1 / format.sampleRate);
for (const chunk of dataChunks) {
  assert.strictEqual(chunk.size % format.blockAlign, 0, 'WAV data 大小必须按采样帧对齐');
  for (let position = chunk.start; position + 1 < chunk.end; position += 2) {
    const sample = wav.readInt16LE(position);
    const magnitude = Math.abs(sample);
    sampleCount += 1;
    if (sample !== 0) nonZeroSamples += 1;
    if (magnitude > peak) peak = magnitude;
    sumSquares += sample * sample;
    const highPassSample = highPassAlpha * (previousHighPass + sample - previousSample);
    highPassSumSquares += highPassSample * highPassSample;
    previousSample = sample;
    previousHighPass = highPassSample;
  }
}
const rms = Math.sqrt(sumSquares / sampleCount);
const highPassRms = Math.sqrt(highPassSumSquares / sampleCount);
const highPassRatio = highPassRms / rms;
assert.ok(sampleCount > 0, '背景音乐没有可读取的 PCM 样本');
assert.ok(nonZeroSamples > 0 && peak > 0 && rms > 0,
  '背景音乐 PCM 数据不能是全静音');
assert.ok(rms >= 3200,
  `背景音乐原始响度必须足以在手机扬声器播放，当前 RMS=${rms.toFixed(2)}`);
assert.ok(highPassRatio >= 0.45,
  `至少应有足够的 250Hz 以上可听内容，当前高通 RMS 比例=${highPassRatio.toFixed(3)}`);

const game = fs.readFileSync(gamePath, 'utf8');
assert.match(game, /const GAME_CODE_VERSION = 191/, 'Web 正式代码版本必须升级为 v191');
assert.match(game, /const BGM_VOLUME = 0\.76/,
  'v191 手机可听背景音乐应使用明确的独立音量');
assert.match(game, /phone-audible-v191/,
  '音频诊断必须标记手机可听频段资源修订版');

const bgmAssetMatches = game.match(/assets\/[A-Za-z0-9._/-]*bgm[A-Za-z0-9._/-]*\.(?:wav|mp3|ogg|m4a)/gi) || [];
const uniqueBgmAssets = [...new Set(bgmAssetMatches)];
assert.deepStrictEqual(uniqueBgmAssets, [bgmRelativePath],
  'game.js 必须只声明一个正式背景音乐资源');

const audioStart = game.indexOf('let _audioCtx = null;');
const audioEnd = game.indexOf("document.addEventListener('keydown'", audioStart);
assert.ok(audioStart >= 0 && audioEnd > audioStart, '无法定位 Web 音频实现区段');
const audioSection = game.slice(audioStart, audioEnd);
assert.match(audioSection, /\bloop\s*(?:=|:)\s*true/,
  '正式背景音乐资源必须循环播放');
assert.match(audioSection, /bgmEnabled:\s*true/,
  '音频诊断必须报告背景音乐已启用');
assert.match(audioSection, /legacyDotSequencerEnabled:\s*false/,
  '音频诊断必须明确报告旧点状音序器已关闭');
assert.match(audioSection, /let _bgmAttemptId = 0/,
  'Web 背景音乐必须使用播放代次屏蔽暂停或销毁后的迟到 Promise');
assert.match(audioSection, /attemptId !== _bgmAttemptId/,
  'Web 背景音乐 Promise 回调必须校验当前播放代次');
const ensureBgmStart = audioSection.indexOf('function _ensureWebBgm()');
const ensureBgmEnd = audioSection.indexOf('function _playWebBgm(', ensureBgmStart);
assert.ok(ensureBgmStart >= 0 && ensureBgmEnd > ensureBgmStart,
  '无法定位 Web 背景音乐单例初始化函数');
const ensureBgmSource = audioSection.slice(ensureBgmStart, ensureBgmEnd);
assert.match(ensureBgmSource, /if \(_bgmAudio\) return _bgmAudio;/,
  '重复交互必须复用已有背景音乐实例');
assert.strictEqual((ensureBgmSource.match(/new window\.Audio\s*\(/g) || []).length, 1,
  'Web 背景音乐初始化函数只能创建一个 HTMLAudio 实例');
assert.doesNotMatch(game, /_bgmMelody/,
  '不能恢复旧 _bgmMelody 点状旋律实现');
assert.doesNotMatch(audioSection, /\bsetInterval\s*\(/,
  '背景音乐必须依赖单一 looped asset，不能使用 380ms 或其他 interval 音序器');

console.log(
  `Web 背景音乐回归测试通过：PCM16 单声道，${durationSeconds.toFixed(2)} 秒，` +
  `peak=${peak}，rms=${rms.toFixed(2)}，highPass250=${highPassRatio.toFixed(3)}；` +
  '单一循环资源启用且旧点状音序器关闭。'
);
