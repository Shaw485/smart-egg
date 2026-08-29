'use strict';

// 微信小游戏入口：先安装平台兼容层，再加载纯逻辑模块、关卡与游戏本体。
require('./js/wechat-adapter.js');
require('./js/physics-collision.js');
require('./js/accepted-mechanics.js');
require('./js/levels.js');
require('./js/smart-egg-game.js');
