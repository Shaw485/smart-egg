'use strict';

// 微信小游戏入口：先安装平台兼容层，再加载关卡与游戏本体。
require('./js/wechat-adapter.js');
require('./js/levels.js');
require('./js/smart-egg-game.js');
