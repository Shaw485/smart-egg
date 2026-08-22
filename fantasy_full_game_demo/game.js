(() => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    // ===== v15.0 永久防缓存：代码版本号 + localStorage 自动校验 + 右上角可视化显示 =====
    //   - GAME_CODE_VERSION：每次发版递增整数（和index.html?v=xxx同步，避免不同步）
    //   - 用户以前打开的旧tab还保留着旧代码的JS快照，没手动刷新就一直命中缓存
    //   - 现在：打开页面时先读localStorage的最后保存版本号，如果当前更小 → 强制location.reload(true)清磁盘缓存
    const GAME_CODE_VERSION = 155;   // 跟 index.html 的 ?v=155 保持一致
    try {
        const LAST_KNOWN_KEY = 'fantasy_full_code_v_last_seen_v1';
        const last = parseInt(localStorage.getItem(LAST_KNOWN_KEY) || '0', 10);
        if (!Number.isNaN(last) && last < GAME_CODE_VERSION && last > 0) {
            // 用户这次访问的代码版本比上次保存的新 → 旧tab没刷新的情况下也强制清缓存刷新
            console.info('[CACHE BUSTER] 检测到代码版本落后：last=' + last + ' < current=' + GAME_CODE_VERSION + '，强制reload(true)清缓存');
            localStorage.setItem(LAST_KNOWN_KEY, String(GAME_CODE_VERSION));
            // reload(true) = 强制绕过 HTTP 磁盘缓存 + 内存缓存
            window.location.reload(true);
            throw new Error('stop-exec-old-code'); // 防止老代码接着跑
        }
        // 记录这次最新版本号（下次用户打开别的tab/旧tab就能对比）
        localStorage.setItem(LAST_KNOWN_KEY, String(GAME_CODE_VERSION));
    } catch(_cacheCheckErr) {
        // localStorage 禁用（隐身模式/隐私模式）= 静默跳过，不影响正常玩
    }

    // v14.0 自动测试模式标记：URL 含 ?autotest → 全程画面左上红底白字警告
    const IS_AUTOTEST_MODE = location.search.includes('autotest') || location.hash.includes('autotest');

    const W = 1920, H = 1080;
    const FANTASY_TITLES = [
        '风起之门 · 迈出旅程', '云阶试炼 · 借木而登', '锁语遗迹 · 让钥匙找到归途',
        '断崖回声 · 一次飞跃不够', '守门人的礼仪 · 以礼叩响古门',
        '花之暗号 · 记住短暂盛开的数字', '逃走的门 · 让奔跑停在掌心'
    ];
    const GRAVITY = 2000.0;
    const MAX_FALL = 1200.0;
    const MOVE_SPEED = 300.0;
    const JUMP_VELOCITY = -1080.0;
    const HALF_W = 40.0, HALF_H = 60.0;
    // v4.9.5 成功进门动画：3阶段 2 秒 = 120 帧
    //   阶段1 (120→80): 0~40帧  门打开动画
    //   阶段2 (80→20):  40~100帧  蛋滑入+被吸入+缩小到0消失
    //   阶段3 (20→0):   100~120帧 成功弹窗淡入
    const SUCCESS_TOTAL = 120;
    const COMPLETE_INTRO_TOTAL = 90;

    let dpr = window.devicePixelRatio || 1;
    let renderScale = dpr;
    let frameCount = 0;
    let showSuccess = false;
    let successTimer = 0;
    let doorOpenT = 0;
    let showDead = false;
    const DEAD_BTN = { btx: 0, bty: 0, btw: 360, bth: 110 };
    let gameState = 'menu';
    const PAGE_NAMES = Object.freeze({
        menu:'首页', levelSelect:'主线选关页', creatorList:'创造秘境关卡列表页',
        creatorEdit:'秘境编辑台页', playing:'踏上旅途页', paused:'暂停页',
        complete:'通关页', completeIntro:'通关过渡页'
    });
    function currentPageName() {
        if(_creatorDeleteConfirmIndex>=0)return '删除确认弹窗';
        if(_passwordVisible)return '密码输入弹窗';
        if(gameState==='playing'&&_playingCustom)return '自定义关卡试玩页';
        if(gameState==='paused'&&_playingCustom)return '自定义关卡暂停页';
        return PAGE_NAMES[gameState]||gameState;
    }
    let levelData = null;
    let _successStuckCounter = 0;  // 兜底保险：showSuccess 持续超过120帧就强制切complete
    // v4.9.5 进门动画：蛋吸入参数
    let _animStartX = 0, _animStartY = 0;
    let _animTargetX = 0, _animTargetY = 0;
    let _animTargetDoor = null;
    // v4.9.6c 坏关卡健康保护：进入 playing 后 0.5秒内还在往下掉超过1100 → 平台没接住 = 坏关，立刻跳选关页，避免等死亡循环
    let _healthGuardFrames = 0;
    // 第五关敲门状态：只有人物站在目标门前的敲门才累计，所有敲门都会显示“咚”。
    let _validKnockCount = 0;
    let _knockEffects = [];
    let _questionBlocks = [];
    let _flowerBursts = [];
    let _passwordVisible = false;
    let _passwordInput = '';
    let _passwordSolved = false;
    let _passwordErrorUntil = 0;
    let _passwordDismissUntil = 0;
    let _playingCustom = false;
    const CREATOR_LS_KEY = 'fantasy_full_creator_levels_v1';
    let _creatorLevels = [];
    try { _creatorLevels = JSON.parse(localStorage.getItem(CREATOR_LS_KEY) || '[]'); } catch (_) { _creatorLevels = []; }
    let _creatorDraft = null;
    let _creatorTool = 'platform';
    let _creatorMechanics = [];
    let _creatorHistory = [];
    let _creatorSavedUntil = 0;
    let _creatorDeleteConfirmIndex = -1;
    let _creatorBindingMode = false;
    const _heldMovingTargets = new Map();
    let _mouseMovingTarget = null;
    let _cameraX = 0, _cameraY = 0;
    let _creatorCameraX = 0, _creatorCameraY = 0;
    let _creatorMapOverview = false;
    let _creatorSelected = null;
    let _creatorRangeNotice = '', _creatorRangeNoticeUntil = 0;
    let _creatorShareCode = '';
    let _creatorShareIndex = -1;
    let _creatorImportPreview = null;
    function _mechanicsOf(lv) {
        if(!lv)return [];
        if(Array.isArray(lv.mechanics))return lv.mechanics.filter(x=>x&&x!=='normal');
        const result=[];
        if(lv.mechanic&&lv.mechanic!=='normal')result.push(lv.mechanic);
        if(lv.double_jump&&!result.includes('double_jump'))result.push('double_jump');
        if((lv.type==='knock_twice'||lv.type==='flower_password')&&!result.includes(lv.type))result.push(lv.type);
        return result;
    }
    function _hasMechanic(name) { return _mechanicsOf(levelData).includes(name); }
    function _mapExtent(lv){
        const e=(lv&&lv.map_extent)||{};
        return {left:Math.max(0,Math.floor(e.left||0)),right:Math.max(0,Math.floor(e.right||0)),up:Math.max(0,Math.floor(e.up||0))};
    }
    function _mapBounds(lv){const e=_mapExtent(lv);return{minX:-e.left*W,maxX:(e.right+1)*W,minY:-e.up*H,maxY:H,e};}
    function _isMovingHeld(obj) { return Array.from(_heldMovingTargets.values()).includes(obj) || _mouseMovingTarget === obj; }
    function _movingTargets() {
        if (!levelData) return [];
        const out=[];
        for(const d of levelData.doors||[])if(d.hold_to_stop)out.push({kind:'door',obj:d,w:d.w||150,h:d.h||210});
        for(const p of levelData.platforms||[])if(p.hold_to_stop)out.push({kind:'platform',obj:p,w:p.w||260,h:p.h||52});
        for(const c of crates)if(c.hold_to_stop)out.push({kind:'crate',obj:c,w:c.w||130,h:c.h||140});
        for(const k of keyItems)if(k.hold_to_stop&&k.state!=='collected')out.push({kind:'key',obj:k,w:90,h:90});
        for(const q of _questionBlocks)if(q.hold_to_stop)out.push({kind:'question',obj:q,w:q.w||105,h:q.h||105});
        return out;
    }
    function _movingTargetAt(p) {
        const wp={x:p.x+_cameraX,y:p.y+_cameraY};
        for(const t of _movingTargets().reverse())if(inRect(wp,{x:t.obj.x-t.w/2-18,y:t.obj.y-t.h/2-18,w:t.w+36,h:t.h+36}))return t;
        return null;
    }
    function _updateMovingTargets(dt) {
        if(!_hasMechanic('hold_to_stop'))return;
        for(const t of _movingTargets()){
            const o=t.obj;
            if(o._moveBaseY==null)o._moveBaseY=o.y;
            if(o._runLift==null)o._runLift=0;
            if(_isMovingHeld(o)){
                o._isRunning=false;
                o._runLift+=(0-o._runLift)*Math.min(1,dt*14);
                continue;
            }
            if(Math.abs(player.x-o.x)<540)o._moveActivated=true;
            if(o._moveActivated){
                // 逃跑元素模仿人物当前的横向方向，而不是永远朝元素所在侧逃跑。
                // 这样人物左跑时门也左跑，右跑时二者同速，可持续追逐。
                // 直接读取本帧输入，避免 updateMovingTargets 早于 moveDir 更新造成方向迟滞。
                const dir=(input.right?1:0)-(input.left?1:0);
                o._isRunning=dir!==0;
                o._runLift+=((o._isRunning?22:0)-o._runLift)*Math.min(1,dt*14);
                if(dir!==0)o.x+=dir*MOVE_SPEED*dt;
                if(!levelData.infinite_horizontal){const mb=_mapBounds(levelData);o.x=Math.max(mb.minX+t.w/2+16,Math.min(mb.maxX-t.w/2-16,o.x));}
                // 完整复制人物的连续纵向轨迹，去掉顶部限幅，避免门在跳跃顶点停住。
                o.y=o._moveBaseY+(player.y-levelData.spawn.y)-o._runLift;
            } else {
                o._isRunning=false;
                o._runLift+=(0-o._runLift)*Math.min(1,dt*14);
                if(Math.abs(o.y-o._moveBaseY)>1)o.y+=(o._moveBaseY-o.y)*Math.min(1,dt*9);
            }
        }
    }

    // 暴露调试接口到 window
    window.__debug = {
      getState: () => gameState,
      getPageName: () => currentPageName(),
      PAGE_NAMES,
      setState: (v) => { gameState = v; },
      getShowSuccess: () => showSuccess,
      getShowDead: () => showDead,
      getSuccessTimer: () => successTimer,
      setSuccessTimer: (v) => { successTimer = v; },
      getPlayer: () => player,
      getFrame: () => frameCount,
      getDoorOpenT: () => doorOpenT,
      __setPlayerX: (v) => { player.x = v; },
      __setPlayerVy: (v) => { player.vy = v; },
      __setInputRight: (v) => { input.right = v; },
      loadLevelAndStart: () => {
        logStep('debug', 'manual-loadLevelAndStart', {gameState, hasLevelData: !!levelData});
        loadLevelAndStart();
        return gameState;
      },
      getLevelData: () => levelData,
      setFrameHandler: (fn) => {
        // 让外部在每帧执行一个钩子（用于自动化测试）
        window.__frameHook = fn;
        logStep('debug', 'frame-hook-set', {});
      },
    };

    // ====== 日志系统（logStep：带帧号+时间戳+K/V详情，按category分组）======
    // 用法：logStep('physics', 'gate1-pass', {x:player.x, y:player.y, vx:player.vx, vy:player.vy})
    // 所有日志走 window.__gameLogs 数组，可在浏览器DevTools里查看或通过 _dumpLogs() 导出
    const LOG_MAX = 10000;
    const LOG_SESSION_ID = 'se-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    let _logSequence = 0;
    const _logStartedAt = new Date().toISOString();
    window.__gameLogs = window.__gameLogs || [];
    // v4.9.7a 死亡/坏关卡前 10 帧 player 快照（环形buffer），排查"为什么掉下去/为什么没碰门"直接回溯状态
    const PLAYER_RING_SIZE = 10;
    const _playerRing = [];
    function _pushPlayerRing() {
        const snap = {
            f: frameCount,
            x: Math.round(player.x), y: Math.round(player.y),
            vx: Math.round(player.vx), vy: Math.round(player.vy),
            onGround: player.onGround, moveDir: player.moveDir, wantJump: !!player.wantJump
        };
        _playerRing.push(snap);
        if (_playerRing.length > PLAYER_RING_SIZE) _playerRing.shift();
    }
    function logStep(cat, tag, kv) {
        const entry = {
            seq: ++_logSequence,
            f: frameCount,
            t: (performance.now() / 1000).toFixed(3),
            at: new Date().toISOString(),
            session: LOG_SESSION_ID,
            cat, tag,
            kv: kv || {}
        };
        window.__gameLogs.push(entry);
        if (window.__gameLogs.length > LOG_MAX) window.__gameLogs.shift();
        // v4.9.7b 性能紧急修复：loudCats 只保留「低频次」的 9 类（必须高频 physics/collide 不打console！）
        //   之前 physics/frame-snap 每帧 + collide/door-overlap 每帧都 JSON.stringify+console → 渲染线程写I/O卡死=用户说的"通关很卡顿"
        //   解决：只把这些高频日志写进 __gameLogs 数组（用户 _findLogs/_dumpLogs 能查到），不实时 console.log
        const loudCats = ['state','door','success','fatal','debug','level-load','input','dead','guard','progress'];
        if (loudCats.includes(cat)) {
            console.log(`[LOG f=${entry.f} ${cat}/${tag}]`, JSON.stringify(entry.kv));
        }
    }
    // v4.9.7a 日志查询工具（一次性暴露 6 个）：
    //   _dumpLogs() 全量 / _tailLogs(n) 最后N条 / _findLogs(keyword) 按tag或KV关键字搜
    //   _deadSnaps() 死亡/坏关卡前 10 帧（环形buffer快照），_stateChange() 状态机转换全链路
    window._dumpLogs = function() { return window.__gameLogs.slice(); };
    window._clearLogs = function() { window.__gameLogs = []; console.log('🧹 __gameLogs 已清空'); };
    window._tailLogs = function(n=50) { return window.__gameLogs.slice(-n); };
    window._findLogs = function(keyword, cat='') {
        const k = (keyword || '').toString().toLowerCase();
        return window.__gameLogs.filter(l => {
            if (cat && l.cat !== cat) return false;
            if (l.tag.toLowerCase().includes(k)) return true;
            try {
                const kvStr = JSON.stringify(l.kv || '').toLowerCase();
                if (kvStr.includes(k)) return true;
            } catch(e) {}
            return false;
        });
    };
    window._deadSnaps = function() { return _playerRing.slice(); };
    window._stateChanges = function() { return window._findLogs('', 'state'); };
    // 暴露 ring buffer 到 debug
    window.__debug.getLastPlayerSnaps = window._deadSnaps;

    function _runtimeSnapshot() {
        return {
            codeVersion: GAME_CODE_VERSION,
            sessionId: LOG_SESSION_ID,
            sessionStartedAt: _logStartedAt,
            exportedAt: new Date().toISOString(),
            page: { href: location.href, protocol: location.protocol, online: navigator.onLine, visibility: document.visibilityState },
            device: { userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language, dpr: window.devicePixelRatio, viewport: { width: innerWidth, height: innerHeight } },
            backend: {
                mode: location.protocol === 'file:' ? 'android-local-offline' : 'static-web-preview',
                apiEndpoint: null,
                note: '当前游戏无业务后端；关卡来自内置 levels_bundle.js 或本地 JSON。所有资源读取结果记录在 level-load/network 分类。'
            },
            game: {
                pageName: currentPageName(),
                state: gameState, levelIndex: currentLevelIndex,
                levelName: levelData && levelData.name,
                showSuccess, showDead, paused: gameState === 'paused',
                player: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, onGround: player.onGround, alive: player.alive, jumpsLeft: player.jumpsLeft },
                input: { ...input }, validKnockCount: _validKnockCount,
                availableLevels: _availableLevels.slice(),
                progress: { unlocked: _progress.unlocked, completed: (_progress.completed || []).slice() }
            },
            audio: { supported: !!(window.AudioContext || window.webkitAudioContext), state: _audioCtx ? _audioCtx.state : 'not-created' }
        };
    }
    function exportDiagnosticLog() {
        logStep('export', 'export-request', { state: gameState, levelIndex: currentLevelIndex, logCountBeforeExport: window.__gameLogs.length });
        const report = {
            format: 'smart-egg-diagnostic-log', schemaVersion: 1,
            runtime: _runtimeSnapshot(),
            recentPlayerFrames: _playerRing.slice(),
            logs: window.__gameLogs.slice()
        };
        const text = JSON.stringify(report, null, 2);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `smart-egg-log-v${GAME_CODE_VERSION}-${stamp}.json`;
        try {
            if (window.AndroidLogExporter && typeof window.AndroidLogExporter.exportLog === 'function') {
                window.AndroidLogExporter.exportLog(filename, text);
                logStep('export', 'android-export-dispatched', { filename, bytes: text.length });
                return;
            }
            const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; a.style.display = 'none';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            logStep('export', 'browser-download-triggered', { filename, bytes: text.length });
        } catch (err) {
            logStep('fatal', 'log-export-failed', { message: err.message, stack: String(err.stack || '') });
            alert('日志导出失败：' + err.message);
        }
    }
    window.__debug.exportLog = exportDiagnosticLog;
    window.addEventListener('error', e => logStep('fatal', 'window-error', { message: e.message, file: e.filename, line: e.lineno, column: e.colno, stack: e.error && e.error.stack }));
    window.addEventListener('unhandledrejection', e => logStep('fatal', 'unhandled-rejection', { reason: String(e.reason), stack: e.reason && e.reason.stack }));
    window.addEventListener('online', () => logStep('network', 'browser-online', { online: true }));
    window.addEventListener('offline', () => logStep('network', 'browser-offline', { online: false }));
    document.addEventListener('visibilitychange', () => logStep('lifecycle', 'visibility-change', { visibility: document.visibilityState }));
    window.addEventListener('pagehide', e => logStep('lifecycle', 'page-hide', { persisted: e.persisted }));

    const input = { left: false, right: false, jumpPressed: false, jumpHeld: false };
    let helpVisible = false;
    const keys = { ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right',
                   Space:'jump', ArrowUp:'jump', KeyW:'jump' };

    // 轻量程序化音效：不依赖外部音频文件，首次键盘/触摸操作后自动启用。
    let _audioCtx = null;
    function _ensureAudio() {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;
        if (!_audioCtx) _audioCtx = new AudioCtor();
        if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
        return _audioCtx;
    }
    function _tone(freq, duration, type = 'sine', volume = 0.08, delay = 0, endFreq = freq) {
        const ac = _ensureAudio();
        if (!ac) return;
        const t = ac.currentTime + delay;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + duration);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(gain).connect(ac.destination);
        osc.start(t); osc.stop(t + duration + 0.02);
    }
    function playSfx(name) {
        logStep('audio', 'sfx-request', { name, audioState: _audioCtx ? _audioCtx.state : 'not-created', gameState, levelIndex: currentLevelIndex });
        if (name === 'jump') {
            _tone(260, 0.16, 'sine', 0.07, 0, 520);
        } else if (name === 'land') {
            _tone(120, 0.09, 'triangle', 0.055, 0, 70);
        } else if (name === 'success') {
            _tone(523, 0.18, 'triangle', 0.06, 0.00, 659);
            _tone(659, 0.18, 'triangle', 0.06, 0.12, 784);
            _tone(784, 0.28, 'triangle', 0.07, 0.24, 1047);
        } else if (name === 'unlock') {
            _tone(440, 0.12, 'square', 0.035, 0.00, 660);
            _tone(880, 0.24, 'triangle', 0.055, 0.10, 1175);
        } else if (name === 'knock') {
            _tone(145, 0.11, 'sine', 0.10, 0.00, 82);
            _tone(105, 0.16, 'triangle', 0.065, 0.045, 62);
        }
    }
    let _bgmTimer = 0;
    let _bgmStep = 0;
    // 独立奇幻版原创五声音阶主题，不引用任何商业游戏旋律。
    const _bgmMelody = [294, 370, 440, 554, 440, 370, 330, 294, 370, 440, 659, 554];
    function _startBgm() {
        const ac = _ensureAudio();
        if (!ac || _bgmTimer) return;
        const tick = () => {
            if (document.hidden || !_audioCtx || _audioCtx.state !== 'running') return;
            const note = _bgmMelody[_bgmStep % _bgmMelody.length];
            _tone(note, 0.34, _bgmStep % 3 ? 'triangle' : 'sine', 0.031, 0, note * 0.997);
            if (_bgmStep % 3 === 0) {
                const bass = [147, 220, 165, 220][Math.floor(_bgmStep / 3) % 4];
                _tone(bass, 0.72, 'sine', 0.019, 0, bass * 0.99);
            }
            _bgmStep++;
        };
        tick();
        _bgmTimer = window.setInterval(tick, 380);
    }
    document.addEventListener('pointerdown', _startBgm, { passive: true });
    document.addEventListener('keydown', e => {
        _ensureAudio();
        _startBgm();
        // v4.9.7a B类：键盘输入事件全链路日志（含 repeat/游戏状态/按键名）
        logStep('input', 'keydown', {
            code: e.code, key: e.key, repeat: !!e.repeat,
            gameState, showSuccess, showDead,
            handled_shortcut: false
        });
        // 通关页快捷键：ESC=返回菜单，ENTER/SPACE=再玩一次，N=下一关
        if (gameState === 'complete' || gameState === 'completeIntro') {
            if (_completeTimer > 0) return;   // 转圈动画期间不响应键盘
            if (e.code === 'Escape') { logStep('input','shortcut',{from_state:gameState,to:'menu',shortcut:'ESC→返回菜单'}); backToMenu(); e.preventDefault(); return; }
            if (e.code === 'Enter')  { logStep('input','shortcut',{from_state:gameState,to:'levelSelect',shortcut:'Enter→选关页'}); gameState = 'levelSelect'; e.preventDefault(); return; }
            if (e.code === 'Space')  { logStep('input','shortcut',{from_state:gameState,to:'load-next',shortcut:'Space→下一关'}); loadLevelByIndex(currentLevelIndex + 1); e.preventDefault(); return; }
        }
        // 菜单页快捷键：ENTER/SPACE=进入选关
        if (gameState === 'menu') {
            if (e.code === 'Enter' || e.code === 'Space') { logStep('input','shortcut',{from_state:gameState,to:'levelSelect',shortcut:'Enter/Space'}); gameState = 'levelSelect'; e.preventDefault(); return; }
        }
        // 选关页快捷键：ESC回菜单
        if (gameState === 'levelSelect') {
            if (e.code === 'Escape') { logStep('input','shortcut',{from_state:gameState,to:'menu',shortcut:'ESC'}); gameState = 'menu'; e.preventDefault(); return; }
        }
        if (keys[e.code]) {
            if (keys[e.code] === 'jump') {
                const beforeHeld = input.jumpHeld;
                if (!beforeHeld) input.jumpPressed = true;
                input.jumpHeld = true;
                logStep('input','jump-press', {jumpPressed: input.jumpPressed, beforeHeld, jumpHeld_now: input.jumpHeld});
            } else {
                const name = keys[e.code];
                const before = input[name];
                input[name] = true;
                logStep('input','dir-press', {name, before, now: true, code: e.code});
            }
        }
    });
    document.addEventListener('keyup', e => {
        if (keys[e.code]) {
            if (keys[e.code] === 'jump') {
                input.jumpHeld = false;
                logStep('input','jump-release', {jumpHeld: false});
            } else {
                const name = keys[e.code];
                input[name] = false;
                logStep('input','dir-release', {name, code: e.code});
            }
        }
    });

    const player = {
        x: 0, y: 0, vx: 0, vy: 0,
        w: HALF_W * 2, h: HALF_H * 2,
        onGround: false, alive: true,
        moveDir: 0, wantJump: false,
        walkT: 0,
        sH: 0, sF: 0,
        jumpsLeft: 1,
    };
    let crates = [];
    let keyItems = [];
    let unlockedDoors = new Set();

    function resetCratesFromLevel() {
        crates = (levelData && levelData.crates || []).map((c, i) => ({
            id: c.id || ('crate_' + i),
            x: c.x, y: c.y, w: c.w || 130, h: c.h || 140,
            spawnX: c.x, spawnY: c.y,
            vy: 0, onGround: false, hold_to_stop: !!c.hold_to_stop
        }));
    }

    function resetKeysFromLevel() {
        unlockedDoors = new Set();
        keyItems = (levelData && levelData.keys || []).map((k, i) => ({
            id: k.id || ('key_' + i), x: k.x, y: k.y,
            startX: k.x, startY: k.y, targetDoor: k.target_door,
            state: 'idle', flyT: 0, hold_to_stop: !!k.hold_to_stop
        }));
    }

    function updateKeys(dt) {
        for (const k of keyItems) {
            if (k.hold_to_stop && _isMovingHeld(k)) continue;
            if (k.state === 'idle') {
                const hit = rectVsRect(player.x - HALF_W, player.y - HALF_H, HALF_W * 2, HALF_H * 2,
                                       k.x - 42, k.y - 42, 84, 84);
                if (hit) {
                    k.state = 'flying';
                    k.startX = k.x; k.startY = k.y; k.flyT = 0;
                }
            } else if (k.state === 'flying') {
                const door = (levelData.doors || []).find(d => d.id === k.targetDoor);
                if (!door) continue;
                k.flyT = Math.min(1, k.flyT + dt / 0.72);
                const eased = 1 - Math.pow(1 - k.flyT, 3);
                k.x = k.startX + (door.x - k.startX) * eased;
                k.y = k.startY + (door.y - k.startY) * eased - Math.sin(Math.PI * k.flyT) * 150;
                if (k.flyT >= 1) {
                    k.state = 'collected';
                    unlockedDoors.add(door.id);
                    playSfx('unlock');
                }
            }
        }
    }

    function resize() {
        const ww = window.innerWidth;
        const isAndroidApp = document.body.classList.contains('android-app');
        const wh = window.innerHeight - (isAndroidApp ? 0 : 48);
        if (isAndroidApp) {
            // 1920×1080 的手绘 Canvas 在模拟器 WebView 中按设备 DPR 全量绘制非常昂贵。
            // 0.70 倍内部缓冲仍保持相同逻辑坐标和全屏比例，但像素填充量下降约 51%。
            renderScale = 0.70;
            canvas.style.width = ww + 'px';
            canvas.style.height = wh + 'px';
            canvas.width = Math.round(W * renderScale);
            canvas.height = Math.round(H * renderScale);
            ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
            return;
        }
        const baseR = W / H;
        const winR = ww / wh;
        let cw, ch;
        if (winR > baseR) { ch = wh; cw = ch * baseR; }
        else { cw = ww; ch = cw / baseR; }
        canvas.style.width = cw + 'px';
        canvas.style.height = ch + 'px';
        renderScale = Math.min(dpr, 1.25);
        canvas.width = Math.round(W * renderScale);
        canvas.height = Math.round(H * renderScale);
        ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    }
    window.addEventListener('resize', resize);

    function wobble(seed, amp = 1.5) {
        return (Math.sin(seed * 12.9898 + frameCount * 0.02) * 43758.5453 % 1) * amp - amp / 2;
    }
    // 基于种子的稳定抖动（同一seed同一帧输出一致，不随时间动）
    function wobbleStatic(seed, amp = 1.5) {
        return (Math.sin(seed * 12.9898) * 43758.5453 % 1) * amp - amp / 2;
    }

    function sketchBold(text, x, y, size = 24, align = 'center', color = '#17343a') {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${size}px "Kaiti SC", "STKaiti", "Songti SC", serif`;
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }
    function sketchText(text, x, y, size = 24, align = 'center', bold = false, color = '#17343a') {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        const w = bold ? '800 ' : '500 ';
        ctx.font = `${w}${size}px "Songti SC", "STSong", serif`;
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    function _roundPath(x, y, w, h, r) {
        ctx.beginPath();
        const s = 12;
        for (let i = 0; i <= s; i++) {
            const t = Math.PI + (Math.PI / 2) * (i / s);
            const px = x + r + Math.cos(t) * r;
            const py = y + r + Math.sin(t) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        for (let i = 0; i <= s; i++) {
            const t = -Math.PI / 2 + (Math.PI / 2) * (i / s);
            ctx.lineTo(x + w - r + Math.cos(t) * r, y + r + Math.sin(t) * r);
        }
        for (let i = 0; i <= s; i++) {
            const t = (Math.PI / 2) * (i / s);
            ctx.lineTo(x + w - r + Math.cos(t) * r, y + h - r + Math.sin(t) * r);
        }
        for (let i = 0; i <= s; i++) {
            const t = Math.PI / 2 + (Math.PI / 2) * (i / s);
            ctx.lineTo(x + r + Math.cos(t) * r, y + h - r + Math.sin(t) * r);
        }
        ctx.closePath();
    }

    // 手绘不规则圆角矩形路径（每一点带static抖动，模拟手绘）
    function _wonkyRectPath(x, y, w, h, r, seed = 0, amp = 2.2) {
        ctx.beginPath();
        const s = 14;
        // 左上弧
        for (let i = 0; i <= s; i++) {
            const t = Math.PI + (Math.PI / 2) * (i / s);
            const px = x + r + Math.cos(t) * r + wobbleStatic(seed + i, amp);
            const py = y + r + Math.sin(t) * r + wobbleStatic(seed + 100 + i, amp);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        // 右上弧
        for (let i = 0; i <= s; i++) {
            const t = -Math.PI / 2 + (Math.PI / 2) * (i / s);
            const px = x + w - r + Math.cos(t) * r + wobbleStatic(seed + 200 + i, amp);
            const py = y + r + Math.sin(t) * r + wobbleStatic(seed + 300 + i, amp);
            ctx.lineTo(px, py);
        }
        // 右下弧
        for (let i = 0; i <= s; i++) {
            const t = (Math.PI / 2) * (i / s);
            const px = x + w - r + Math.cos(t) * r + wobbleStatic(seed + 400 + i, amp);
            const py = y + h - r + Math.sin(t) * r + wobbleStatic(seed + 500 + i, amp);
            ctx.lineTo(px, py);
        }
        // 左下弧
        for (let i = 0; i <= s; i++) {
            const t = Math.PI / 2 + (Math.PI / 2) * (i / s);
            const px = x + r + Math.cos(t) * r + wobbleStatic(seed + 600 + i, amp);
            const py = y + h - r + Math.sin(t) * r + wobbleStatic(seed + 700 + i, amp);
            ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    function drawGrid() {
        // 极简背景：关卡内山脉抬到远方，与地面之间保留明显空白。
        ctx.fillStyle='#f2efe6';ctx.fillRect(0,0,W,H);
        ctx.strokeStyle='rgba(25,25,24,.16)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(W*.8,H*.19,66,0,Math.PI*2);ctx.stroke();
        const inLevelBackground=gameState==='playing'||gameState==='paused',mountainBase=inLevelBackground ? .63 : .88,mountainHeight=inLevelBackground ? .12 : .15;
        ctx.strokeStyle='#000';ctx.lineWidth=inLevelBackground?2.2:2.7;ctx.lineCap='round';ctx.lineJoin='round';
        ctx.beginPath();ctx.moveTo(0,H*mountainBase);ctx.bezierCurveTo(W*.07,H*(mountainBase-mountainHeight*.34),W*.09,H*(mountainBase-mountainHeight),W*.15,H*(mountainBase-mountainHeight*.78));ctx.bezierCurveTo(W*.21,H*(mountainBase-mountainHeight*.56),W*.24,H*(mountainBase-mountainHeight*.14),W*.3,H*mountainBase);ctx.stroke();
        ctx.beginPath();ctx.moveTo(W*.34,H*mountainBase);ctx.bezierCurveTo(W*.4,H*(mountainBase-mountainHeight*.42),W*.43,H*(mountainBase-mountainHeight*1.08),W*.49,H*(mountainBase-mountainHeight*.88));ctx.bezierCurveTo(W*.55,H*(mountainBase-mountainHeight*.62),W*.6,H*(mountainBase-mountainHeight*.18),W*.66,H*mountainBase);ctx.stroke();
        ctx.beginPath();ctx.moveTo(W*.7,H*mountainBase);ctx.bezierCurveTo(W*.77,H*(mountainBase-mountainHeight*.34),W*.8,H*(mountainBase-mountainHeight),W*.86,H*(mountainBase-mountainHeight*.78));ctx.bezierCurveTo(W*.92,H*(mountainBase-mountainHeight*.54),W*.95,H*(mountainBase-mountainHeight*.14),W,H*mountainBase);ctx.stroke();
    }

    function drawLevelTopBar() {
        // === 图2：顶部去掉了状态栏！（没有20:38/信号/WiFi/电池）===

        // === 1. 吊牌：两根竖杆 + 路牌「第 1 关」===
        const bx = 110, by = 30, bw = 205, bh = 82;
        const br = 18;
        // 1a. 两根吊杆（从画面顶部y=0垂下来）
        ctx.save();
        ctx.strokeStyle = '#17343a';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx + 48 + wobbleStatic(11, 1), 0);
        ctx.lineTo(bx + 48 + wobbleStatic(12, 1), by + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + bw - 48 + wobbleStatic(13, 1), 0);
        ctx.lineTo(bx + bw - 48 + wobbleStatic(14, 1), by + 2);
        ctx.stroke();
        // 竖杆和标签连接点：两个小实心点
        ctx.fillStyle = '#17343a';
        ctx.beginPath(); ctx.arc(bx + 48, by + 3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + bw - 48, by + 3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // 1b. 吊牌标签牌（手绘不规则圆角矩形）
        ctx.save();
        ctx.fillStyle = '#fff0bd';
        _wonkyRectPath(bx, by, bw, bh, br, 5000, 2.0); ctx.fill();
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4.5;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        _wonkyRectPath(bx, by, bw, bh, br, 5000, 2.0); ctx.stroke();
        ctx.restore();
        sketchBold(_playingCustom ? '自定义关卡' : ('第 ' + (currentLevelIndex + 1) + ' 关'), bx + bw / 2, by + bh / 2 + 8, _playingCustom ? 29 : 34);

        // === 2. ? ↻ ⏸ 三个轻削角纸片按钮：保留原点击区域，只更新视觉形象。===
        const bs = 96, bgap = 34;
        const by2 = 26;
        const bx0 = bx + bw + 44;
        for (let i = 0; i < 3; i++) {
            const cx = bx0 + i * (bs + bgap);
            const icx = cx + bs / 2, icy = by2 + bs / 2;
            // 轻微不对称的削角纸片，比旧圆角方框更利落，也更贴合忍者线描风。
            ctx.save();
            ctx.fillStyle = '#fff0bd';
            _cutCornerPanelPath(cx, by2, bs, bs, 16, 6000 + i * 137); ctx.fill();
            ctx.strokeStyle = '#17343a'; ctx.lineWidth = 5;
            _cutCornerPanelPath(cx, by2, bs, bs, 16, 6000 + i * 137); ctx.stroke();
            ctx.strokeStyle = 'rgba(23,52,58,.35)'; ctx.lineWidth = 2;
            _cutCornerPanelPath(cx + 7, by2 + 7, bs - 14, bs - 14, 10, 6100 + i * 137); ctx.stroke();
            ctx.restore();

            if (i === 0) {
                // 第1个：大问号「?」（居中）
                ctx.save();
                ctx.strokeStyle = '#17343a';
                ctx.fillStyle = '#17343a';
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                // 问号的钩子：从顶部开始绕圆弧+下降
                ctx.beginPath();
                // 上部圆弧（从左到右画一个 270° 的圆弧）
                const qR = 15;
                const qx = icx;
                const qy = icy - 6;
                ctx.arc(qx, qy, qR, Math.PI, -Math.PI / 2, false);
                // 从圆弧末端下弯一个短钩
                ctx.lineTo(qx + 0.5, qy + qR + 2);
                ctx.stroke();
                // 问号底部的小圆点
                ctx.beginPath();
                ctx.arc(icx, icy + 24, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else if (i === 1) {
                // 第2个：循环箭头「↻」（圆形循环箭头，居中）
                ctx.save();
                ctx.strokeStyle = '#17343a';
                ctx.fillStyle = '#17343a';
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                // 更大、更饱满的回转箭头：接近一整圈，并用单个大箭头收尾
                const arcR = 27;
                // 留口放在右上角，避免箭头尾巴落在右下时看起来像字母 Q
                const arcStart = Math.PI * 0.10;
                const arcEnd = Math.PI * 1.75;
                ctx.beginPath();
                ctx.arc(icx, icy, arcR, arcStart, arcEnd, false);
                ctx.stroke();
                // 顺着圆弧切线方向画饱满箭头，避免旧图标两端箭头显得碎、弧线偏短
                const tipX = icx + Math.cos(arcEnd) * arcR;
                const tipY = icy + Math.sin(arcEnd) * arcR;
                const tangentX = -Math.sin(arcEnd);
                const tangentY = Math.cos(arcEnd);
                const normalX = Math.cos(arcEnd);
                const normalY = Math.sin(arcEnd);
                const arrowLength = 16;
                const arrowHalfWidth = 10;
                ctx.beginPath();
                ctx.moveTo(tipX + tangentX * 4, tipY + tangentY * 4);
                ctx.lineTo(tipX - tangentX * arrowLength + normalX * arrowHalfWidth,
                           tipY - tangentY * arrowLength + normalY * arrowHalfWidth);
                ctx.lineTo(tipX - tangentX * arrowLength - normalX * arrowHalfWidth,
                           tipY - tangentY * arrowLength - normalY * arrowHalfWidth);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            } else {
                // 第3个：暂停「||」两条粗竖线（居中并排）
                ctx.save();
                ctx.strokeStyle = '#17343a';
                ctx.lineWidth = 8;
                ctx.lineCap = 'round';
                const barH = 42;
                const barGap = 12;
                // 左竖线
                ctx.beginPath();
                ctx.moveTo(icx - barGap, icy - barH / 2);
                ctx.lineTo(icx - barGap, icy + barH / 2);
                ctx.stroke();
                // 右竖线
                ctx.beginPath();
                ctx.moveTo(icx + barGap, icy - barH / 2);
                ctx.lineTo(icx + barGap, icy + barH / 2);
                ctx.stroke();
                ctx.restore();
            }
        }
        uiBTN.help = { x: bx0, y: by2, w: bs, h: bs };
        uiBTN.restart = { x: bx0 + bs + bgap, y: by2, w: bs, h: bs };
        uiBTN.pause = { x: bx0 + (bs + bgap) * 2, y: by2, w: bs, h: bs };

        // 第四关标题单独下移一行并严格居中，避免与顶部按钮挤在一起。
        const titleIsLower = currentLevelIndex === 3;
        sketchBold(_playingCustom ? ((levelData && levelData.name) || '无名秘境') : (FANTASY_TITLES[currentLevelIndex] || (levelData && levelData.name) || '风在门后等待'),
                   titleIsLower ? W / 2 : W / 2 + 120,
                   titleIsLower ? 190 : 74, 58);
    }

    // 画实心三角形（手绘感，带轻微抖动，默认白色，底部按键传黑色）
    function _fillTri(cx, cy, size, dir, seed = 0, color = '#fff0bd') {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        if (dir === 'left') {
            ctx.moveTo(cx + size * 0.45 + wobbleStatic(seed+1, 1.5), cy - size * 0.55 + wobbleStatic(seed+2, 1.5));
            ctx.lineTo(cx - size * 0.55 + wobbleStatic(seed+3, 1.5), cy + wobbleStatic(seed+4, 1.5));
            ctx.lineTo(cx + size * 0.45 + wobbleStatic(seed+5, 1.5), cy + size * 0.55 + wobbleStatic(seed+6, 1.5));
        } else if (dir === 'right') {
            ctx.moveTo(cx - size * 0.45 + wobbleStatic(seed+1, 1.5), cy - size * 0.55 + wobbleStatic(seed+2, 1.5));
            ctx.lineTo(cx + size * 0.55 + wobbleStatic(seed+3, 1.5), cy + wobbleStatic(seed+4, 1.5));
            ctx.lineTo(cx - size * 0.45 + wobbleStatic(seed+5, 1.5), cy + size * 0.55 + wobbleStatic(seed+6, 1.5));
        } else {
            ctx.moveTo(cx + wobbleStatic(seed+1, 1.5), cy - size * 0.55 + wobbleStatic(seed+2, 1.5));
            ctx.lineTo(cx + size * 0.55 + wobbleStatic(seed+3, 1.5), cy + size * 0.45 + wobbleStatic(seed+4, 1.5));
            ctx.lineTo(cx - size * 0.55 + wobbleStatic(seed+5, 1.5), cy + size * 0.45 + wobbleStatic(seed+6, 1.5));
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // 略带手绘偏差的削角面板。按钮碰撞区仍使用原矩形，不改变操作手感。
    function _cutCornerPanelPath(x, y, w, h, cut = 14, seed = 0) {
        const n = (i, amp = 1.2) => wobbleStatic(seed + i, amp);
        ctx.beginPath();
        ctx.moveTo(x + cut + n(1), y + n(2));
        ctx.lineTo(x + w - cut + n(3), y + n(4));
        ctx.lineTo(x + w + n(5), y + cut + n(6));
        ctx.lineTo(x + w + n(7), y + h - cut + n(8));
        ctx.lineTo(x + w - cut + n(9), y + h + n(10));
        ctx.lineTo(x + cut + n(11), y + h + n(12));
        ctx.lineTo(x + n(13), y + h - cut + n(14));
        ctx.lineTo(x + n(15), y + cut + n(16));
        ctx.closePath();
    }

    function drawBottomControls() {
        // 参考稿：底部三个黑色手绘大按键，白色粗线箭头；左右键分开，跳跃键靠右。
        const by = H - 172;
        const sz = 132;
        const r = 30;
        const x1 = 190;
        const x2 = 455;
        const x3 = W - 190 - sz;

        function drawBigBtn(x, y, seed) {
            // 削角纸片：减少旧版规则虚线边框的机械感，点击区域保持不变。
            ctx.save();
            ctx.fillStyle = 'rgba(255,240,189,.26)';
            _cutCornerPanelPath(x, y, sz, sz, 22, seed); ctx.fill();
            ctx.strokeStyle = '#17343a'; ctx.lineWidth = 6;
            _cutCornerPanelPath(x, y, sz, sz, 22, seed); ctx.stroke();
            ctx.strokeStyle = 'rgba(23,52,58,.35)'; ctx.lineWidth = 3;
            _cutCornerPanelPath(x + 9, y + 9, sz - 18, sz - 18, 15, seed + 80); ctx.stroke();
            // 两个短角记号保留一点手绘感，但不再绕整圈使用规律虚线。
            _fantasyLine([[x - 8, y + 30], [x - 8, y + 12], [x + 10, y + 12]], '#17343a', 3);
            _fantasyLine([[x + sz - 10, y + sz - 12], [x + sz + 8, y + sz - 12], [x + sz + 8, y + sz - 30]], '#17343a', 3);
            ctx.restore();
        }
        drawBigBtn(x1, by, 7001);
        drawBigBtn(x2, by, 7002);
        drawBigBtn(x3, by, 7003);

        function drawChevron(cx, cy, dir, seed) {
            const arm = dir === 'up' ? 36 : 33;
            ctx.save();
            ctx.strokeStyle = '#17343a';
            ctx.lineWidth = 15;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            if (dir === 'left') {
                ctx.moveTo(cx + arm * 0.45 + wobbleStatic(seed, 1.5), cy - arm);
                ctx.lineTo(cx - arm * 0.55, cy);
                ctx.lineTo(cx + arm * 0.45 + wobbleStatic(seed + 1, 1.5), cy + arm);
            } else if (dir === 'right') {
                ctx.moveTo(cx - arm * 0.45 + wobbleStatic(seed, 1.5), cy - arm);
                ctx.lineTo(cx + arm * 0.55, cy);
                ctx.lineTo(cx - arm * 0.45 + wobbleStatic(seed + 1, 1.5), cy + arm);
            } else {
                ctx.moveTo(cx - arm, cy + arm * 0.4 + wobbleStatic(seed, 1.5));
                ctx.lineTo(cx, cy - arm * 0.55);
                ctx.lineTo(cx + arm, cy + arm * 0.4 + wobbleStatic(seed + 1, 1.5));
            }
            ctx.stroke();
            ctx.restore();
        }
        drawChevron(x1 + sz / 2, by + sz / 2, 'left', 8001);
        drawChevron(x2 + sz / 2, by + sz / 2, 'right', 8002);
        drawChevron(x3 + sz / 2, by + sz / 2, 'up', 8003);

        uiBTN.left   = { x: x1, y: by, w: sz, h: sz };
        uiBTN.right  = { x: x2, y: by, w: sz, h: sz };
        uiBTN.jump   = { x: x3, y: by, w: sz, h: sz };
    }
    const uiBTN = { left: null, right: null, jump: null, help: null, restart: null, pause: null, pauseLevelSelect: null, pauseResume: null, start: null, creator: null, exportLog: null, levelSelect_btns: [], creatorBtns: [], creatorConfirmBtns: [], editorTools: [], passwordKeys: [] };

    function drawGameplayMessage() {
        if (!helpVisible && gameState !== 'paused') return;
        const isPaused = gameState === 'paused';
        const boxW = 760, boxH = isPaused ? 260 : 150;
        const boxX = (W - boxW) / 2, boxY = 180;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.96)';
        _wonkyRectPath(boxX, boxY, boxW, boxH, 26, 73001, 2.5); ctx.fill();
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 6;
        _wonkyRectPath(boxX, boxY, boxW, boxH, 26, 73001, 2.5); ctx.stroke();
        ctx.restore();
        if (isPaused) {
            sketchBold('已暂停', W / 2, boxY + 52, 42);
            const btnW = 270, btnH = 82, gap = 36;
            const leftX = W / 2 - gap / 2 - btnW;
            const rightX = W / 2 + gap / 2;
            const btnY = boxY + 125;
            ctx.save();
            ctx.fillStyle = '#fff0bd';
            ctx.strokeStyle = '#17343a';
            ctx.lineWidth = 5;
            _wonkyRectPath(leftX, btnY, btnW, btnH, 22, 73101, 2.3); ctx.fill(); ctx.stroke();
            _wonkyRectPath(rightX, btnY, btnW, btnH, 22, 73201, 2.3); ctx.fill(); ctx.stroke();
            ctx.restore();
            sketchBold(_playingCustom ? '回到创造秘境' : '回到选关', leftX + btnW / 2, btnY + btnH / 2 + 7, _playingCustom ? 23 : 27);
            sketchBold('返回游戏', rightX + btnW / 2, btnY + btnH / 2 + 7, 27);
            uiBTN.pauseLevelSelect = { x: leftX, y: btnY, w: btnW, h: btnH };
            uiBTN.pauseResume = { x: rightX, y: btnY, w: btnW, h: btnH };
        } else {
            uiBTN.pauseLevelSelect = null;
            uiBTN.pauseResume = null;
            sketchBold('提示', W / 2, boxY + 48, 36);
            const hint = levelData && levelData.description && levelData.description.hint_l1
                ? levelData.description.hint_l1 : '按 ← → 移动，点击右下按钮跳跃。';
            sketchBold(hint, W / 2, boxY + 104, 25);
        }
    }

    function drawKnockEffects() {
        const now = performance.now();
        _knockEffects = _knockEffects.filter(effect => now - effect.startedAt < 620);
        for (const effect of _knockEffects) {
            const t = Math.min(1, (now - effect.startedAt) / 620);
            const eased = 1 - Math.pow(1 - t, 3);
            ctx.save();
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = '#17343a';
            ctx.lineWidth = 7 - t * 3;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, 25 + eased * 58, -0.85, 0.85);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, 40 + eased * 75, -0.7, 0.7);
            ctx.stroke();
            sketchBold('咚', effect.x - 74 - eased * 12, effect.y - 12 - eased * 28, 46);
            ctx.restore();
        }
    }

    function _drawFlower(cx, cy, scale = 1, alpha = 1) {
        ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff0bd'; ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
            ctx.beginPath(); ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    function drawQuestionBlocks() {
        const now = performance.now();
        for (let i = 0; i < _questionBlocks.length; i++) {
            const b = _questionBlocks[i], x = b.x - b.w / 2, y = b.y - b.h / 2;
            ctx.save(); ctx.fillStyle = '#f2efe6';
            _wonkyRectPath(x, y, b.w, b.h, 14, 84000 + i * 91, 2); ctx.fill();
            ctx.strokeStyle = '#17343a'; ctx.lineWidth = 6;
            _wonkyRectPath(x, y, b.w, b.h, 14, 84000 + i * 91, 2); ctx.stroke(); ctx.restore();
            sketchBold(b.remaining > 0 ? '?' : '×', b.x, b.y + 6, 58);
        }
        _flowerBursts = _flowerBursts.filter(f => now - f.at < 650);
        for (const f of _flowerBursts) {
            const t = (now - f.at) / 650;
            _drawFlower(f.x, f.y - t * 90, 0.8 + t * 0.35, 1 - t);
        }
    }
    function drawPasswordPanel() {
        if (!_passwordVisible) return;
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0,0,W,H); ctx.restore();
        const pw = 620, ph = 850, px = (W-pw)/2, py = 105;
        ctx.save(); ctx.fillStyle = '#fff0bd'; _wonkyRectPath(px,py,pw,ph,34,85001,3); ctx.fill(); ctx.strokeStyle='#17343a';ctx.lineWidth=7;_wonkyRectPath(px,py,pw,ph,34,85001,3);ctx.stroke();ctx.restore();
        sketchBold('密码是？', W/2, py+65, 48);
        uiBTN.passwordKeys = [];
        const closeBtn={x:px+pw-72,y:py+22,w:48,h:48,key:'close'};
        ctx.save();ctx.strokeStyle='#17343a';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(closeBtn.x+8,closeBtn.y+8);ctx.lineTo(closeBtn.x+40,closeBtn.y+40);ctx.moveTo(closeBtn.x+40,closeBtn.y+8);ctx.lineTo(closeBtn.x+8,closeBtn.y+40);ctx.stroke();ctx.restore();
        uiBTN.passwordKeys.push(closeBtn);
        const slotW=105,gap=22,start=W/2-(slotW*4+gap*3)/2;
        for(let i=0;i<4;i++){const sx=start+i*(slotW+gap);ctx.save();ctx.fillStyle='#111';_wonkyRectPath(sx,py+105,slotW,90,15,85100+i,1.5);ctx.fill();ctx.restore();sketchBold(_passwordInput[i]||'',sx+slotW/2,py+152,50,'center','#fff0bd');}
        const labels=['1','2','3','4','5','6','7','8','9','0','←','清'];
        for(let i=0;i<labels.length;i++){const col=i%3,row=Math.floor(i/3),bw=135,bh=105,bx=px+75+col*170,by=py+235+row*135;ctx.save();ctx.fillStyle='#fff0bd';_wonkyRectPath(bx,by,bw,bh,22,85200+i,2);ctx.fill();ctx.strokeStyle='#17343a';ctx.lineWidth=5;_wonkyRectPath(bx,by,bw,bh,22,85200+i,2);ctx.stroke();ctx.restore();sketchBold(labels[i],bx+bw/2,by+bh/2+5,45);uiBTN.passwordKeys.push({x:bx,y:by,w:bw,h:bh,key:labels[i]});}
        if(performance.now()<_passwordErrorUntil) sketchBold('密码不对，再数数花朵',W/2,py+800,28,'center','#d33');
    }
    function _expectedFlowerPassword() {
        const blocks=(levelData&&levelData.question_blocks)||[];
        return blocks.length ? blocks.map(b=>Math.max(0,Math.min(9,Number(b.count)||0))).join('') : String((levelData&&levelData.password)||'');
    }

    // ===== v4.9.6 选关 + 通关存档 =====
    const TOTAL_LEVELS = 10;
    const LS_KEY = 'fantasy_full_save_v1';
    // v4.9.6 关卡加载缓存（死亡重来的同步保证，必须声明在最前面避免 TDZ）
    const _cachedLevels = {};

    // v4.9.6 关卡 fallback 生成函数（必须声明在 probeAvailableLevels 之前！）
    function _makeLevelFallback(idx) {
        // ⚠️ 平台格式必须和 physicsStep/drawPlatforms 一致：{ x, y, w, h, kind }
        //   x = 平台中心x, y = 平台中心y, w = 宽度, h = 厚度（AABB：x-w/2 到 x+w/2，y-h/2 到 y+h/2）
        //   （physicsStep L593 用 p.x - p.w/2 计算左上角，fallback 必须用旧{中心式}格式，否则碰撞失效直接掉下去死循环！）
        const GROUND_Y = 1090;
        return {
            id: idx,
            name: '第 ' + (idx + 1) + ' 关',
            type: 'side',
            spawn: { x: 300, y: 793 },
            platforms: [
                { x: 960,  y: GROUND_Y, w: 1920, h: 440, kind: 'ground' },
                { x: 820,  y: 650,      w: 330,  h: 52,  kind: 'step1'  },
                { x: 1390, y: 520,      w: 380,  h: 52,  kind: 'step2'  },
            ],
            doors: [{
                id: 'goal_door_' + idx,
                is_goal: true,
                x: 1450, y: 389, w: 150, h: 210
            }],
            decor: []
        };
    }

    function loadProgress() {
        try {
            const s = localStorage.getItem(LS_KEY);
            const parsed = s ? JSON.parse(s) : { unlocked: 1, completed: [] };
            // v4.9.7a G类：localStorage 读取成功/失败详情
            logStep('progress', 'loadProgress-success', {
                key: LS_KEY, raw_bytes: (s||'').length,
                unlocked: parsed.unlocked,
                completed_count: (parsed.completed||[]).length,
                completed: JSON.stringify(parsed.completed||[])
            });
            return parsed;
        } catch(e) {
            logStep('fatal', 'loadProgress-error', { key: LS_KEY, err: e.message, stack: String(e.stack||'').slice(0,200) });
            return { unlocked: 1, completed: [] };
        }
    }
    function saveProgress() {
        try {
            const before = localStorage.getItem(LS_KEY);
            const payload = JSON.stringify(_progress);
            localStorage.setItem(LS_KEY, payload);
            const after = localStorage.getItem(LS_KEY);
            logStep('progress', 'saveProgress-success', {
                key: LS_KEY,
                unlocked_before: before ? (()=>{try{return JSON.parse(before).unlocked}catch(e){return null}})() : null,
                unlocked_after: _progress.unlocked,
                completed_before_count: before ? (()=>{try{return (JSON.parse(before).completed||[]).length}catch(e){return null}})() : null,
                completed_after_count: (_progress.completed||[]).length,
                completed_after: JSON.stringify(_progress.completed||[]),
                payload_bytes: payload.length,
                written_matches: after === payload
            });
        } catch(e) {
            logStep('fatal', 'saveProgress-error', {
                key: LS_KEY, err: e.message, stack: String(e.stack||'').slice(0,200),
                unlocked: _progress.unlocked, completed: JSON.stringify(_progress.completed||[])
            });
        }
    }
    let _progress = loadProgress();
    let currentLevelIndex = 0;
    let _availableLevels = [];  // 已存在JSON文件的关卡列表，启动时探测

    // ===== v17.0 毫秒级真实时间戳（根治掉帧导致"卡几秒"）+ 全套可视化 debug 工具 =====
    //   以前用"帧计数15帧"当0.25秒 → 浏览器掉帧15fps时15帧=整整1秒！主观感觉"卡几秒"。
    //   现在：goal-hit触发瞬间记录_goalHitStartMs=performance.now()，每帧对比「now-startMs >= GOAL_HIT_JUMP_MS」才跳，与FPS无关。
    //   同时暴露 window.__debug.simulateGoalHit() / dumpLatencyReport()，用户现场一键测
    const GOAL_HIT_JUMP_MS = 250;   // 0.25 秒 = 250 毫秒（真实时间）
    let _goalHitStartMs = 0;        // goal-hit触发时的 performance.now()（绝对毫秒，0=未触发）
    let _goalHitLevelIndex = -1;    // 触发时的 levelIndex
    let _goalHitJumped = false;     // 是否已跳（避免多次跳转）
    // 最近 3 次通关的完整时间线（dumpLatencyReport 用）
    const _LATENCY_HISTORY_MAX = 3;
    let _latencyHistory = [];
    // 实时 FPS 计算：
    let _fpsLastFrameMs = performance.now();
    let _fpsSmoothed = 60;

    // ===== v4.9.6 complete页转圈动画 =====
    let _completeTimer = 0;   // completeIntro 阶段倒计时（帧）
    let _completeRotAngle = 0; // completeIntro 转圈角度
    // v17.0：帧计数已废弃，改为真实毫秒级 GOAL_HIT_JUMP_MS（绝对时间戳，不受FPS掉帧影响）
    const GOAL_HIT_TO_JUMP_FRAMES = 15;   // 保留旧变量名兼容，但现在逻辑不用它了

    // ===== window.__debug 全套工具函数（用户按 F12 或在屏幕顶部直接触发）=====
    window.__debug = window.__debug || {};
    window.__debug.VERSION = GAME_CODE_VERSION;
    // 一键模拟 goal-hit：不用真的走到门口，立刻启动 250ms 倒计时看准不准
    window.__debug.simulateGoalHit = function () {
        if (gameState !== 'playing') {
            return { ok: false, err: '当前不是 playing 状态，先进入第0关再测', state: gameState };
        }
        showSuccess = true;
        successTimer = SUCCESS_TOTAL;
        _goalHitStartMs = performance.now();
        _goalHitLevelIndex = currentLevelIndex;
        _goalHitJumped = false;
        showDead = false;
        if (player) { player.vx = 0; player.vy = 0; player.onGround = true; }
        const entry = {
            kind: 'simulate',
            hit_ms: _goalHitStartMs,
            hit_f: frameCount,
            levelIndex: currentLevelIndex,
            jump_ms: null, jump_f: null, delta_ms: null, fps: null,
        };
        _latencyHistory.push(entry);
        if (_latencyHistory.length > _LATENCY_HISTORY_MAX) _latencyHistory.shift();
        logStep('debug', 'simulateGoalHit-start', { startMs: Math.round(_goalHitStartMs), targetJumpMs: GOAL_HIT_JUMP_MS });
        return { ok: true, started: true, hitMs: Math.round(_goalHitStartMs), targetMs: GOAL_HIT_JUMP_MS, expectJumpMs: Math.round(_goalHitStartMs + GOAL_HIT_JUMP_MS) };
    };
    // 最近3次通关的完整时间线（goal-hit→jump实际毫秒数/FPS对比），复制到console就有证据
    window.__debug.dumpLatencyReport = function () {
        const rows = _latencyHistory.slice().reverse().map((r, i) => ({
            rank: '最近第' + (i+1) + '次',
            kind: r.kind || 'real',
            hit_f: r.hit_f, jump_f: r.jump_f,
            hit_ms: r.hit_ms ? Math.round(r.hit_ms) : null,
            jump_ms: r.jump_ms ? Math.round(r.jump_ms) : null,
            actual_delta_ms: r.delta_ms ? Math.round(r.delta_ms) : null,
            target_ms: GOAL_HIT_JUMP_MS,
            fps_when_jumped: r.fps ? Math.round(r.fps) : null,
            error_cmp_target_ms: r.delta_ms ? (Math.round(r.delta_ms) - GOAL_HIT_JUMP_MS) + 'ms' : null,
            result: r.delta_ms ? (
                Math.abs(r.delta_ms - GOAL_HIT_JUMP_MS) <= 40 ? '✅ 误差≤40ms正常' :
                Math.abs(r.delta_ms - GOAL_HIT_JUMP_MS) <= 120 ? '⚠️ 误差≤120ms略卡' :
                '❌ 大于120ms，真的卡！'
            ) : '（未完成跳转）'
        }));
        const summary = {
            code_v: GAME_CODE_VERSION,
            GOAL_HIT_JUMP_MS,
            current_fps: Math.round(_fpsSmoothed),
            current_state: gameState,
            current__goalHitStartMs: _goalHitStartMs ? Math.round(_goalHitStartMs) : 0,
            now_minus_start__ms: _goalHitStartMs ? Math.round(performance.now() - _goalHitStartMs) : 0,
            last3: rows
        };
        console.table(summary.last3);
        console.info('%c=== 通关耗时完整报告：','font-size:16px;color:red', JSON.stringify(summary, null, 2));
        return summary;
    };
    window.__debug.getPlayerSnaps = () => _playerRing.slice();

    // ===== AABB 碰撞检测 =====
    function rectVsRect(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }
    // 计算两个矩形的重叠面积（返回 0 或正数）
    function rectOverlapArea(ax, ay, aw, ah, bx, by, bw, bh) {
        const ox = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
        const oy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
        return ox * oy;
    }

    function physicsStep(dt) {
        // v4.9.7a C类：物理帧快照（每帧） + 环形buffer 推入（死亡前10帧回溯）
        _pushPlayerRing();
        updateKeys(dt);
        if (!levelData || !player.alive) {
            logStep('fatal', 'physicsStep-early-return', {
                hasLevel: !!levelData, alive: player.alive,
                levelIndex: currentLevelIndex,
                levelName: levelData && levelData.name,
                px: Math.round(player.x), py: Math.round(player.y)
            });
            return;
        }
        if (_passwordVisible) { player.vx = 0; player.vy = 0; return; }

        // ① 最高优先级：只有 gameState==='playing' 才运行物理！其他状态一律冻结。
        if (gameState !== 'playing') {
            if (showSuccess && doorOpenT < 1) {
                doorOpenT = Math.min(1, doorOpenT + dt * 3.0);
            }
            if (showSuccess) {
                const k = Math.min(1, dt * 10);
                player.sH = player.sH + (0 - player.sH) * k;
                player.sF = player.sF + (0 - player.sF) * k;
            }
            player.vx = 0;
            player.vy = 0;
            showDead = showSuccess ? false : showDead;
            return;
        }

        // C类：每帧 player + 当前输入快照（调试可查玩家这帧想干啥）
        logStep('physics', 'frame-snap', {
            dt: Math.round(dt*1000),
            px: Math.round(player.x), py: Math.round(player.y),
            vx: Math.round(player.vx), vy: Math.round(player.vy),
            onGround: player.onGround, moveDir: player.moveDir, wantJump: !!player.wantJump,
            in_left: !!input.left, in_right: !!input.right,
            jumpHeld: !!input.jumpHeld, jumpPressed: !!input.jumpPressed,
            plats_count: levelData ? (levelData.platforms||[]).length : 0,
            doors_count: levelData ? (levelData.doors||[]).length : 0
        });

        _updateMovingTargets(dt);
        // ② 进门判定（playing状态下才检查，命中后立刻冻结+return）
        const PLAYER_HALF_AREA = HALF_W * 2 * HALF_H * 2 * 0.5;
        // v4.9.7a E类：门碰撞日志（每个门每帧 overlap 详情，排查"蛋在门口没触发过关"最关键）
        //   只对距离 <= 600px 的门打（避免 10 关 10 门全打太冗余），命中门直接 goal-hit（已打）
        const doors = levelData.doors || [];
        for (let di = 0; di < doors.length; di++) {
            const d = doors[di];
            const dx = d.x - d.w/2, dy = d.y - d.h/2;
            const overlap = rectOverlapArea(
                player.x - HALF_W, player.y - HALF_H, HALF_W*2, HALF_H*2,
                dx, dy, d.w, d.h);
            // 蛋心到门心的距离（曼哈顿）
            const distX = Math.abs(player.x - d.x);
            const distY = Math.abs(player.y - d.y);
            const near = (distX < 600 && distY < 600);
            // 命中：原有 goal-hit 分支会打详细日志
            if (near || overlap > 0) {
                logStep('collide', 'door-overlap', {
                    door_id: d.id || ('door'+di),
                    is_goal: !!d.is_goal, door_index: di,
                    overlap: Math.round(overlap),
                    overlap_pct: Math.round(overlap / PLAYER_HALF_AREA * 100),
                    threshold: PLAYER_HALF_AREA,
                    hit: overlap >= PLAYER_HALF_AREA,
                    px: Math.round(player.x), py: Math.round(player.y),
                    door_cx: Math.round(d.x), door_cy: Math.round(d.y - d.h/2),
                    door_w: d.w, door_h: d.h,
                    dx_manhattan: Math.round(distX), dy_manhattan: Math.round(distY)
                });
            }
        }
        for (const d of doors) {
            const dx = d.x - d.w / 2, dy = d.y - d.h / 2;
            const overlap = rectOverlapArea(
                player.x - HALF_W, player.y - HALF_H, HALF_W * 2, HALF_H * 2,
                dx, dy, d.w, d.h);
            const doorLocked = !!d.locked && !unlockedDoors.has(d.id);
            const knockGateOpen = !_hasMechanic('knock_twice') || _validKnockCount >= 2;
            const passwordGateOpen = !_hasMechanic('flower_password') || _passwordSolved;
            const movingGateOpen = !_hasMechanic('hold_to_stop') || !d.hold_to_stop || _isMovingHeld(d);
            if (d.is_goal && _hasMechanic('flower_password') && !_passwordSolved && performance.now() >= _passwordDismissUntil && overlap >= PLAYER_HALF_AREA) {
                _passwordVisible = true; player.vx = 0; input.left = false; input.right = false;
                logStep('puzzle','password-panel-open',{input:_passwordInput, revealed:_questionBlocks.map(b=>b.revealed)});
                return;
            }
            if (d.is_goal && !doorLocked && knockGateOpen && passwordGateOpen && movingGateOpen && overlap >= PLAYER_HALF_AREA) {
                // v19.0 简化阻断：只阻断「倒计时进行中（_goalHitStartMs>0）」的重复触发
                //   v18 阻断了 _goalHitJumped=true（上一次已经跳完的标志）→ 但跳完后下一关进入前，loadLevelAndStart 会清零这个标志
                //   双重保险：这里只看「现在是否在倒计时中」→ 更安全（即便 loadLevel 清零遗漏也不会卡 goal-hit）
                if (_goalHitStartMs > 0) {
                    return;
                }
                logStep('door', 'goal-hit', {
                    overlap: Math.round(overlap),
                    threshold: PLAYER_HALF_AREA,
                    px: Math.round(player.x), py: Math.round(player.y),
                    dx: Math.round(d.x), dy: Math.round(d.y - d.h/2),
                    dw: d.w, dh: d.h
                });
                showSuccess = true;
                successTimer = SUCCESS_TOTAL;
                playSfx('success');
                showDead = false;
                player.vx = 0;
                player.vy = 0;
                player.onGround = true;
                if (doorOpenT < 1) doorOpenT = Math.min(1, doorOpenT + dt * 3.0);
                // v4.9.5 记录蛋吸入动画起点和门中心（目标）
                _animStartX = player.x;
                _animStartY = player.y;
                _animTargetX = d.x;
                _animTargetY = d.y - d.h * 0.15;  // 门上部（离底部偏上一点）
                _animTargetDoor = d;
                // ===== v17.0 关键：goal-hit 触发瞬间记录绝对毫秒 timeStamp（performance.now()），不再数帧 → 15fps/60fps/1fps 都准0.25秒跳 =====
                _goalHitStartMs = performance.now();       // 触发瞬间的绝对时间戳
                _goalHitLevelIndex = currentLevelIndex;    // 触发时的关卡索引
                _goalHitJumped = false;                    // 防重复跳
                const hitEntry = {
                    kind: 'real',
                    hit_ms: _goalHitStartMs,
                    hit_f: frameCount,
                    levelIndex: currentLevelIndex,
                    jump_ms: null, jump_f: null, delta_ms: null, fps: null,
                };
                _latencyHistory.push(hitEntry);
                if (_latencyHistory.length > _LATENCY_HISTORY_MAX) _latencyHistory.shift();
                logStep('success', 'success-start', {
                    successTimer, showSuccess, SUCCESS_TOTAL,
                    goalHitJumpMs: GOAL_HIT_JUMP_MS,                         // v17: 真实毫秒数（250）
                    goalHitTotalMs: GOAL_HIT_JUMP_MS + 'ms',                // v17: 直观写 "250ms"
                    expectJumpAtMs: Math.round(_goalHitStartMs + GOAL_HIT_JUMP_MS), // 预期跳转绝对毫秒
                    elapsed: SUCCESS_TOTAL - successTimer,
                    fromX: Math.round(_animStartX), fromY: Math.round(_animStartY),
                    toX: Math.round(_animTargetX), toY: Math.round(_animTargetY)
                });
                return;
            }
        }

        // ③ 正常物理流程（只有 playing 且 没进门时才跑到这里）
        let md = 0;
        if (input.left) md -= 1;
        if (input.right) md += 1;
        player.moveDir = md;
        // v20.0：跳跃触发规则（严格：只有 onGround=true 当下按跳才生效，空中按跳直接丢弃，落地后不补跳！）
        //   v19 bug（=「jump buffer/落地补跳」，用户明确禁止）：
        //     L829 if(input.jumpPressed){ player.wantJump=true; ... } → 不管 onGround 真假，只要按了就缓存 wantJump=true
        //     L833 if(player.wantJump && player.onGround){ ... } → 在空中按的 wantJump=true 保留到落地瞬间，自动跳=补跳！
        //   v20 修改：
        //     - onGround=true 当下按 jumpPressed：正常 wantJump=true（立刻消费跳）
        //     - onGround=false 当下按 jumpPressed：直接丢弃，wantJump=false（不缓存，落地后绝不补跳！）
        //     - onGround=false 时若 wantJump 残留 true：也清空（防止之前有 onGround=true 的 wantJump 没消费又离地）
        if (input.jumpPressed) {
            if (player.onGround) {
                // 站在地上按跳：正常允许（只有当前这帧落地 + 按跳，才允许跳）
                player.wantJump = true;
            } else if (levelData.double_jump && player.jumpsLeft > 0) {
                // 第四关专属：离地后还剩一次空中跳跃机会。
                player.wantJump = true;
            } else {
                // 空中按跳：**直接丢弃**，不缓存，不补跳！（用户明确要求）
                player.wantJump = false;
                logStep('input', 'jump-discarded-in-air', {
                    f: frameCount,
                    px: Math.round(player.x), py: Math.round(player.y),
                    vy: Math.round(player.vy * 100) / 100,
                    onGround: player.onGround
                });
            }
            input.jumpPressed = false;   // 无论地面/空中都消费 jumpPressed（避免下一帧重复触发）
        }
        // 再额外兜底：onGround=false 时如果 wantJump 有残留 true，清空！
        if (!player.onGround && player.wantJump && !levelData.double_jump) {
            player.wantJump = false;
        }

        player.vy += GRAVITY * dt;
        if (player.vy > MAX_FALL) player.vy = MAX_FALL;
        if (player.wantJump && (player.onGround || (levelData.double_jump && player.jumpsLeft > 0))) {
            player.vy = JUMP_VELOCITY;
            player.wantJump = false;
            if (levelData.double_jump) player.jumpsLeft = Math.max(0, player.jumpsLeft - 1);
            playSfx('jump');
            logStep('input', 'jump-fired', {
                f: frameCount,
                px: Math.round(player.x), py: Math.round(player.y),
                vy_after: Math.round(player.vy * 100) / 100
            });
        }
        player.vx = player.moveDir * MOVE_SPEED;

        const plats = levelData.platforms || [];
        // 木箱重力与平台碰撞。木箱可坠落，重开关卡时由 JSON 初始位置恢复。
        for (const c of crates) {
            if(c.hold_to_stop&&_isMovingHeld(c)){c.vy=0;continue;}
            if (levelData.no_fall&&!levelData.infinite_horizontal){const mb=_mapBounds(levelData);c.x=Math.max(mb.minX+c.w/2,Math.min(mb.maxX-c.w/2,c.x));}
            c.vy = Math.min(MAX_FALL, c.vy + GRAVITY * dt);
            c.y += c.vy * dt;
            if (levelData.no_fall && c.y > H + 200) {
                c.x = c.spawnX; c.y = c.spawnY; c.vy = 0;
            }
            c.onGround = false;
            for (const p of plats) {
                const px = p.x - p.w / 2, py = p.y - p.h / 2;
                if (!rectVsRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, px, py, p.w, p.h)) continue;
                if (c.vy >= 0) {
                    c.y = py - c.h / 2;
                    c.vy = 0;
                    c.onGround = true;
                } else {
                    c.y = py + p.h + c.h / 2;
                    c.vy = 0;
                }
            }
        }
        // X 方向
        player.x += player.vx * dt;
        if (levelData.no_fall && !levelData.infinite_horizontal) {
            const mb=_mapBounds(levelData);
            player.x = Math.max(mb.minX+HALF_W, Math.min(mb.maxX-HALF_W, player.x));
        }
        player.onGround = false;
        for (const p of plats) {
            const px = p.x - p.w / 2, py = p.y - p.h / 2;
            if (rectVsRect(player.x - HALF_W, player.y - HALF_H, HALF_W * 2, HALF_H * 2,
                            px, py, p.w, p.h)) {
                if (player.vx > 0) player.x = px - HALF_W;
                else if (player.vx < 0) player.x = px + p.w + HALF_W;
                player.vx = 0;
            }
        }
        // 玩家左右接触木箱时推动它；平台或另一只木箱挡住时停止。
        for (const c of crates) {
            if (!rectVsRect(player.x - HALF_W, player.y - HALF_H, HALF_W * 2, HALF_H * 2,
                            c.x - c.w / 2, c.y - c.h / 2, c.w, c.h)) continue;
            if (player.vx === 0) continue;
            const desiredX = player.vx > 0 ? player.x + HALF_W + c.w / 2 : player.x - HALF_W - c.w / 2;
            const oldX = c.x;
            const mbPush=_mapBounds(levelData);
            c.x = levelData.no_fall&&!levelData.infinite_horizontal
                ? Math.max(mbPush.minX+c.w/2, Math.min(mbPush.maxX-c.w/2, desiredX))
                : desiredX;
            let blocked = false;
            for (const p of plats) {
                const px = p.x - p.w / 2, py = p.y - p.h / 2;
                if (rectVsRect(c.x - c.w / 2, c.y - c.h / 2 + 1, c.w, c.h - 2, px, py, p.w, p.h)) {
                    blocked = true; break;
                }
            }
            if (!blocked) {
                for (const other of crates) {
                    if (other === c) continue;
                    if (rectVsRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h,
                                   other.x - other.w / 2, other.y - other.h / 2, other.w, other.h)) {
                        blocked = true; break;
                    }
                }
            }
            if (blocked) {
                c.x = oldX;
                player.x = player.vx > 0 ? c.x - c.w / 2 - HALF_W : c.x + c.w / 2 + HALF_W;
                player.vx = 0;
            }
        }
        // Y 方向
        player.y += player.vy * dt;
        const landingSpeed = player.vy;
        if (player.vy < 0 && _questionBlocks.length) {
            for (const b of _questionBlocks) {
                const bx=b.x-b.w/2, by=b.y-b.h/2;
                if (!rectVsRect(player.x-HALF_W,player.y-HALF_H,HALF_W*2,HALF_H*2,bx,by,b.w,b.h)) continue;
                player.y = by + b.h + HALF_H; player.vy = 0;
                if (b.remaining > 0) {
                    b.remaining--; b.revealed++;
                    _flowerBursts.push({x:b.x,y:by,at:performance.now()});
                    playSfx('unlock');
                    logStep('puzzle','flower-block-hit',{id:b.id,remaining:b.remaining,revealed:b.revealed,total:b.count});
                } else logStep('puzzle','empty-block-hit',{id:b.id});
                break;
            }
        }
        for (const p of plats) {
            const px = p.x - p.w / 2, py = p.y - p.h / 2;
            if (rectVsRect(player.x - HALF_W, player.y - HALF_H, HALF_W * 2, HALF_H * 2,
                            px, py, p.w, p.h)) {
                if (player.vy > 0) {
                    player.y = py - HALF_H;
                    player.vy = 0;
                    player.onGround = true;
                    player.jumpsLeft = levelData.double_jump ? 2 : 1;
                    if (landingSpeed > 260) playSfx('land');
                } else if (player.vy < 0) {
                    player.y = py + p.h + HALF_H;
                    player.vy = 0;
                }
            }
        }
        // 木箱也是可站立的动态平台。
        for (const c of crates) {
            if (!rectVsRect(player.x - HALF_W, player.y - HALF_H, HALF_W * 2, HALF_H * 2,
                            c.x - c.w / 2, c.y - c.h / 2, c.w, c.h)) continue;
            if (player.vy > 0) {
                player.y = c.y - c.h / 2 - HALF_H;
                player.vy = 0;
                player.onGround = true;
                player.jumpsLeft = levelData.double_jump ? 2 : 1;
                if (landingSpeed > 260) playSfx('land');
            } else if (player.vy < 0) {
                player.y = c.y + c.h / 2 + HALF_H;
                player.vy = 0;
            }
        }

        // 门判定（已移到顶部，这里不再重复）

        // 门打开动画：只有在非showSuccess状态才在物理里推进（showSuccess时由最顶部分支推进）
        if (showSuccess) {
            // 已经在顶部分支推进了，这里跳过
        } else if (doorOpenT < 1 && !showSuccess) {
            // 正常状态下不推进门开启动画（开门是触发showSuccess后才有的）
        }

        // 走路摆动手脚时间参数
        const speed = Math.abs(player.vx);
        const walking = player.onGround && speed > 10;
        if (walking) {
            // 慢节奏小跳步：满速约1.45步/秒，不再使用原来的高速碎步。
            const freq = 1.05 + Math.min(0.40, (speed / MOVE_SPEED) * 0.40);
            player.walkT += dt * freq * Math.PI * 2;
        }
        // 目标摆动值（sin驱动）
        const swinging = Math.sin(player.walkT);
        const tgtH = walking ? swinging * 0.32 : 0;  // 手 ±18° ≈ ±0.32rad
        const tgtF = walking ? -swinging * 0.27 : 0; // 脚 ±15° ≈ ±0.27rad（对侧反向）
        // 10Hz lerp 回0（松开键自然复位）
        const k = Math.min(1, dt * 10);
        player.sH = player.sH + (tgtH - player.sH) * k;
        player.sF = player.sF + (tgtF - player.sF) * k;
        // 无限关卡以出生点为镜头原点，左右移动都保持人物在稳定的屏幕位置。
        const mbCamera=_mapBounds(levelData),hasWideMap=levelData.infinite_horizontal||mbCamera.e.left>0||mbCamera.e.right>0;
        const rawCameraX=hasWideMap?player.x-420:0;
        const targetCamera=levelData.infinite_horizontal?rawCameraX:Math.max(mbCamera.minX,Math.min(mbCamera.maxX-W,rawCameraX));
        _cameraX+=(targetCamera-_cameraX)*Math.min(1,dt*7);
        const targetCameraY=(levelData.expand_up||mbCamera.e.up>0)?Math.max(mbCamera.minY,Math.min(0,player.y-810)):0;
        _cameraY+=(targetCameraY-_cameraY)*Math.min(1,dt*7);

        // 跌落致死判定：只有没成功时才检查（showSuccess时永远不会触发死亡）
        if (levelData.no_fall && player.y > H + 120) {
            // 无坠落关卡的最后兜底：异常离开地面时回到出生点，不进入死亡流程。
            player.x = levelData.spawn.x;
            player.y = levelData.spawn.y;
            player.vx = 0; player.vy = 0; player.onGround = false;
        } else if (!showSuccess && !showDead && player.y > H + 400) {
            // v4.9.7a F类：死亡事件详细日志（含死亡前10帧快照 ring buffer，直接回溯跌落过程）
            const prev10 = _playerRing.slice();
            logStep('dead', 'fall-off-world', {
                px: Math.round(player.x), py: Math.round(player.y),
                threshold: H + 400, H_scr: H,
                levelIndex: currentLevelIndex,
                levelName: levelData && levelData.name,
                platforms_count: levelData ? (levelData.platforms||[]).length : 0,
                platform_format_ok: levelData && levelData.platforms && levelData.platforms[0] && ('w' in levelData.platforms[0]),
                spawn_x: levelData && levelData.spawn && levelData.spawn.x,
                spawn_y: levelData && levelData.spawn && levelData.spawn.y,
                last_10_frames: prev10  // 死亡前10帧快照（x/y/vx/vy/onGround/wantJump/moveDir）
            });
            showDead = true;
            // 冻结玩家速度
            player.vx = 0; player.vy = 0;
        }
    }

    // 手绘抖动线（两两点之间插值加抖动）
    function _sketchLine(x1, y1, x2, y2, lw = 3, seed = 0, amp = 1.8) {
        ctx.save();
        ctx.strokeStyle = '#17343a';
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        const segs = Math.max(4, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 14));
        ctx.beginPath();
        for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const px = x1 + (x2 - x1) * t + wobbleStatic(seed + i, amp);
            const py = y1 + (y2 - y1) * t + wobbleStatic(seed + 1000 + i, amp);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
    }

    // 画小草：闭合叶片只描边，内部保持白色，呈空心轮廓。
    function _drawGrassPair(cx, cy, seed = 0) {
        ctx.save();
        ctx.fillStyle = '#fff0bd';
        ctx.strokeStyle = '#17343a';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const leaves = [{ lean: -7 }, { lean: 7 }];
        for (let i = 0; i < leaves.length; i++) {
            const leaf = leaves[i];
            const s = seed + i * 5;
            const height = 11 + wobbleStatic(s, 1.2);
            const baseX = cx + wobbleStatic(s + 1, 0.6);
            const tipX = baseX + leaf.lean + wobbleStatic(s + 2, 0.7);
            const halfWidth = 2.3;
            ctx.beginPath();
            ctx.moveTo(baseX - halfWidth, cy);
            ctx.quadraticCurveTo(tipX - halfWidth, cy - height * 0.55, tipX, cy - height);
            ctx.quadraticCurveTo(tipX + halfWidth, cy - height * 0.55, baseX + halfWidth, cy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawPlatforms() {
        for (let pi = 0; pi < (levelData && levelData.platforms || []).length; pi++) {
            const p = levelData.platforms[pi];
            let x = p.x - p.w / 2, y = p.y - p.h / 2;
            let w = p.w, h = p.h;
            const kind = p.kind || 'ground';
            if(levelData.infinite_horizontal&&kind==='ground'){x=_cameraX-200;w=W+400;}
            const seedBase = 10000 + pi * 317;

            if (kind === 'ground') {
                // === 图2的地面：双层黑线夹白色 + 底部厚黑带 + 顶部小草 ===
                const bandThick = 5.5;          // 上下两条黑线的厚度
                const whiteH = 26;              // 中间白色高度
                const topLineY = y;             // 上线条位置
                const whiteTop = y + bandThick; // 白色上沿
                const whiteBot = y + bandThick + whiteH; // 白色下沿
                const blackBandTop = whiteBot;  // 黑色厚土层顶部
                const blackBandBot = y + h;     // 最底部

                // 1) 上线条 + 中线条 （手绘抖动粗线）
                _sketchLine(x, topLineY, x + w, topLineY, 7.5, seedBase, 2.0);
                _sketchLine(x, whiteBot, x + w, whiteBot, 5.5, seedBase + 100, 2.0);
                // 2) 中间白色填充
                ctx.save();
                ctx.fillStyle = '#fff0bd';
                ctx.fillRect(x, whiteTop, w, whiteH);
                ctx.restore();
                // 3) 参考稿地面下方是大块白色控制区，不再铺灰色土层。
                ctx.save();
                ctx.fillStyle = '#fff0bd';
                ctx.fillRect(x, blackBandTop, w, blackBandBot - blackBandTop);
                // 分段地面形成悬崖时，左右侧壁必须有清晰的黑色竖轮廓。
                const cliffBottom = Math.min(H + 8, blackBandBot);
                if (x > 1) _sketchLine(x, topLineY, x, cliffBottom, 7, seedBase + 260, 1.8);
                if (x + w < W - 1) _sketchLine(x + w, topLineY, x + w, cliffBottom, 7, seedBase + 280, 1.8);
                // 底部边缘加手绘抖动线（仍用黑色描边，层次分明）
                ctx.strokeStyle = '#17343a';
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                const segs = Math.floor(w / 22);
                for (let i = 0; i <= segs; i++) {
                    const t = i / segs;
                    const px = x + w * t;
                    const py = blackBandBot + wobbleStatic(seedBase + 200 + i, 2.5);
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.stroke();
                ctx.restore();
                // 4) 顶部表面线上散列小草对
                if(levelData.infinite_horizontal){
                    // 草固定在世界坐标中，镜头追随时会反向滚动，作为持续奔跑的参照物。
                    const spacing=150;
                    const first=Math.floor((_cameraX-180)/spacing)*spacing;
                    const last=_cameraX+W+180;
                    for(let gx=first;gx<=last;gx+=spacing){
                        const gi=Math.floor(gx/spacing);
                        _drawGrassPair(gx+wobbleStatic(seedBase+500+gi,4),topLineY,seedBase+600+gi*7);
                    }
                }else{
                    const grassCount = Math.floor(w / 110);
                    for (let gi = 0; gi < grassCount; gi++) {
                        const gx = x + 60 + gi * (w - 120) / (grassCount - 1);
                        const gy = topLineY;
                        _drawGrassPair(gx + wobbleStatic(seedBase + 500 + gi, 4), gy, seedBase + 600 + gi * 7);
                    }
                }
            } else {
                // === 台阶：手绘长条胶囊（扁椭圆），两端各一组小草芽 ===
                const rCaps = h / 2;
                const cx = p.x, cy = p.y;
                const amp = 1.6;
                // 1) 白色填充（手绘扁胶囊轮廓）
                ctx.save();
                ctx.fillStyle = '#fff0bd';
                ctx.beginPath();
                const s = 20;
                // 上半 + 右端半圆 + 下半 + 左端半圆（带抖动）
                // 顶部直线
                for (let i = 0; i <= s; i++) {
                    const t = i / s;
                    const px = (cx - w / 2 + rCaps) + (w - rCaps * 2) * t + wobbleStatic(seedBase + i, amp);
                    const py = (cy - rCaps) + wobbleStatic(seedBase + 100 + i, amp);
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                // 右端半圆
                for (let i = 0; i <= s; i++) {
                    const t = -Math.PI / 2 + Math.PI * (i / s);
                    const px = (cx + w / 2 - rCaps) + Math.cos(t) * rCaps + wobbleStatic(seedBase + 200 + i, amp);
                    const py = cy + Math.sin(t) * rCaps + wobbleStatic(seedBase + 300 + i, amp);
                    ctx.lineTo(px, py);
                }
                // 底部直线
                for (let i = 0; i <= s; i++) {
                    const t = i / s;
                    const px = (cx + w / 2 - rCaps) - (w - rCaps * 2) * t + wobbleStatic(seedBase + 400 + i, amp);
                    const py = (cy + rCaps) + wobbleStatic(seedBase + 500 + i, amp);
                    ctx.lineTo(px, py);
                }
                // 左端半圆
                for (let i = 0; i <= s; i++) {
                    const t = Math.PI / 2 + Math.PI * (i / s);
                    const px = (cx - w / 2 + rCaps) + Math.cos(t) * rCaps + wobbleStatic(seedBase + 600 + i, amp);
                    const py = cy + Math.sin(t) * rCaps + wobbleStatic(seedBase + 700 + i, amp);
                    ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4.5;
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.stroke();
                ctx.restore();
                // 参考图：厚黑草皮几乎覆盖整段顶边，下沿带手绘起伏。
                _sketchLine(x + 16, y + 3, x + w - 16, y + 3, 17, seedBase + 760, 3.2);
                // 两簇空心双叶芽。
                _drawGrassPair(x + w * 0.20, y - 4, seedBase + 800);
                _drawGrassPair(x + w * 0.82, y - 4, seedBase + 900);
                // 主体内保留两条浅淡横向手绘纹理。
                ctx.save();
                ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                _sketchLine(x + w * 0.20, cy + 8, x + w * 0.29, cy + 7, 2.2, seedBase + 1000, 1.1);
                _sketchLine(x + w * 0.70, cy + 7, x + w * 0.78, cy + 6, 2.2, seedBase + 1100, 1.1);
                ctx.restore();
            }
        }
    }

    function drawDoors() {
        // v4.9.5 门打开动画：每帧推进 doorOpenT 0→1（阶段1的前40帧内完成，平滑）
        if (showSuccess && doorOpenT < 1) {
            doorOpenT = Math.min(1, doorOpenT + 1 / 40);
        } else if (!showSuccess) {
            doorOpenT = Math.max(0, doorOpenT - 0.1);
        }
        for (const d of (levelData && levelData.doors || [])) {
            const w = d.w, h = d.h;
            const x = d.x - w / 2, y = d.y - h / 2;
            const seed = 20000 + (d.id || 'door').length * 7;
            const opening = d.is_goal && showSuccess ? doorOpenT : 0;

            // === 1. 图2 式 T 字形门楣（横条中间 + 两端 T 型端盖，永远不动）===
            const overhang = 16;  // 每侧突出16（比原来更宽，端盖明显）
            const headerH = 22;
            const headerW = w + overhang * 2;
            const hx = x - overhang;
            const hy = y - headerH + 2;  // 门楣底部和门身顶部对齐
            // 1a. 主横条（wonky白底黑描边）
            ctx.save();
            ctx.fillStyle = '#fff0bd';
            _wonkyRectPath(hx, hy, headerW, headerH, 5, seed + 1, 1.8); ctx.fill();
            ctx.strokeStyle = '#17343a'; ctx.lineWidth = 6.5;
            _wonkyRectPath(hx, hy, headerW, headerH, 5, seed + 1, 1.8); ctx.stroke();
            ctx.restore();
            // 1b. 左侧 T 端盖（横条左端下方多出垂直向下的小方块=端盖底，像T字左端）
            ctx.save();
            ctx.fillStyle = '#fff0bd';
            const capW = 12, capH = 10;
            ctx.fillRect(hx - 2, hy + headerH - 4, capW, capH);
            ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4.0;
            ctx.strokeRect(hx - 2 + 2, hy + headerH - 4, capW - 4, capH);
            ctx.restore();
            // 1c. 右侧 T 端盖（对称）
            ctx.save();
            ctx.fillStyle = '#fff0bd';
            ctx.fillRect(hx + headerW - capW + 2, hy + headerH - 4, capW, capH);
            ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4.0;
            ctx.strokeRect(hx + headerW - capW + 4, hy + headerH - 4, capW - 4, capH);
            ctx.restore();

            // === 2. 门后的黑色洞口（开门后露出的内部）===
            if (opening > 0) {
                ctx.save();
                ctx.fillStyle = '#17343a';
                ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
                // 微弱的深浅渐变（上暗下深，增加"深处"感）
                const grad = ctx.createLinearGradient(x, y, x, y + h);
                grad.addColorStop(0, '#0a0a0a');
                grad.addColorStop(1, '#17343a');
                ctx.fillStyle = grad;
                ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
                ctx.restore();
            }

            // === 3. 门身主体（未开状态=完整wonky矩形；开门后=门身向右整体滑出）===
            // 门身的平移：向右滑 opening × (w + 24)
            const bodyShift = opening * (w + 24);
            // 门身初始位置：x（左上角），高度 h（整个门身）
            const bx = x + bodyShift;
            if (bx < x + w + 4) {  // 只要门身还有一点点在门洞内，就画
                ctx.save();
                // 参考稿门身：顶部略窄、底部略宽的手绘梯形。
                ctx.fillStyle = '#fff0bd';
                ctx.beginPath();
                ctx.moveTo(bx + 12 + wobbleStatic(seed + 11, 2), y + wobbleStatic(seed + 12, 2));
                ctx.lineTo(bx + w - 12 + wobbleStatic(seed + 13, 2), y + wobbleStatic(seed + 14, 2));
                ctx.lineTo(bx + w + wobbleStatic(seed + 15, 2), y + h + wobbleStatic(seed + 16, 2));
                ctx.lineTo(bx + wobbleStatic(seed + 17, 2), y + h + wobbleStatic(seed + 18, 2));
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#17343a'; ctx.lineWidth = 6;
                ctx.lineJoin = 'round';
                ctx.stroke();
                ctx.restore();
                // 内侧轻微错位轮廓，模拟参考图重复描线的手绘门框。
                ctx.save();
                ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(bx + 21, y + 12);
                ctx.lineTo(bx + w - 21, y + 12);
                ctx.lineTo(bx + w - 11, y + h - 7);
                ctx.lineTo(bx + 11, y + h - 7);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
                // 参考稿把手位于门身左侧中部。
                const kbw = 18, kbh = 32;
                const kx = bx + w * 0.30 - kbw / 2;
                const ky = y + h * 0.48;
                // 外空心描边方块（不是fill白，是描边空心！）
                ctx.save();
                ctx.fillStyle = '#fff0bd';
                _roundPath(kx, ky, kbw, kbh, 5); ctx.fill();
                ctx.strokeStyle = '#17343a'; ctx.lineWidth = 3;
                _roundPath(kx, ky, kbw, kbh, 5); ctx.stroke();
                ctx.restore();
                // 内部 L 形（左下直角 └ 而不是右下 ┘）
                ctx.save();
                ctx.strokeStyle = '#17343a';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(kx + kbw * 0.30, ky + kbh * 0.30);  // 左上
                ctx.lineTo(kx + kbw * 0.30, ky + kbh * 0.72);  // 下
                ctx.lineTo(kx + kbw * 0.72, ky + kbh * 0.72);  // 右
                ctx.stroke();
                ctx.restore();
            }
            // 只有逃跑中的门才长出小脚；门身跑动时上提，脚底保持在地面轮廓上方。
            if(d.hold_to_stop&&d._isRunning&&d._runLift>18&&!_isMovingHeld(d)&&gameState==='playing'){
                ctx.save();
                ctx.strokeStyle='#17343a';ctx.lineWidth=6;ctx.lineCap='round';ctx.lineJoin='round';
                const step=Math.sin(frameCount*0.28)*9;
                const footY=y+h+18;
                ctx.beginPath();
                ctx.moveTo(d.x-w*0.27,y+h-2);ctx.lineTo(d.x-w*0.27+step,footY);ctx.lineTo(d.x-w*0.27-9+step,footY+2);
                ctx.moveTo(d.x+w*0.27,y+h-2);ctx.lineTo(d.x+w*0.27-step,footY);ctx.lineTo(d.x+w*0.27+9-step,footY+2);
                ctx.stroke();ctx.restore();
            }
            // 第三关锁门：钥匙到达前显示手绘锁链和挂锁，到达后自动消失。
            if (d.locked && !unlockedDoors.has(d.id)) {
                ctx.save();
                ctx.strokeStyle = '#17343a';
                ctx.lineWidth = 7;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(x - 7, y + h * 0.26);
                ctx.quadraticCurveTo(d.x, y + h * 0.52, x + w + 7, y + h * 0.25);
                ctx.stroke();
                for (let i = 0; i < 7; i++) {
                    const lx = x + 5 + i * ((w - 10) / 6);
                    const ly = y + h * (0.28 + 0.13 * Math.sin((i / 6) * Math.PI));
                    ctx.beginPath();
                    ctx.ellipse(lx, ly, 13, 8, i % 2 ? 0.45 : -0.45, 0, Math.PI * 2);
                    ctx.stroke();
                }
                const lockX = d.x, lockY = y + h * 0.58;
                ctx.fillStyle = '#fff0bd';
                ctx.beginPath();
                ctx.arc(lockX, lockY - 16, 19, Math.PI, 0);
                ctx.stroke();
                _roundPath(lockX - 25, lockY - 15, 50, 45, 8); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#17343a';
                ctx.beginPath(); ctx.arc(lockX, lockY + 2, 6, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(lockX - 3, lockY + 3, 6, 13);
                ctx.restore();
            }
        }
    }

    function drawDecor() {
        // === 图2完全清空 decor：没有文字提示/云/箭头/旗子 ===
        // 所有装饰改为代码内置（地面/平台的小草、吊牌竖杆等）
    }

    function drawCrates() {
        for (let ci = 0; ci < crates.length; ci++) {
            const c = crates[ci];
            const x = c.x - c.w / 2, y = c.y - c.h / 2;
            const seed = 42000 + ci * 97;
            ctx.save();
            ctx.fillStyle = '#fff0bd';
            ctx.strokeStyle = '#17343a';
            ctx.lineWidth = 6;
            ctx.lineJoin = 'round';
            _wonkyRectPath(x, y, c.w, c.h, 5, seed, 2.2); ctx.fill(); ctx.stroke();
            // 上下木条与两侧立柱。
            _wonkyRectPath(x - 4, y - 3, c.w + 8, 24, 3, seed + 20, 1.5); ctx.fill(); ctx.stroke();
            _wonkyRectPath(x - 4, y + c.h - 21, c.w + 8, 24, 3, seed + 30, 1.5); ctx.fill(); ctx.stroke();
            _sketchLine(x + 18, y + 20, x + 18, y + c.h - 20, 5, seed + 40, 1.2);
            _sketchLine(x + c.w - 18, y + 20, x + c.w - 18, y + c.h - 20, 5, seed + 50, 1.2);
            // 中间几条横向木纹。
            for (let i = 0; i < 3; i++) {
                const yy = y + 42 + i * ((c.h - 82) / 2);
                _sketchLine(x + 28, yy, x + c.w - 28, yy + wobbleStatic(seed + 60 + i, 3), 2.2, seed + 70 + i * 11, 1.3);
            }
            ctx.restore();
        }
    }

    function drawKeys() {
        for (const k of keyItems) {
            if (k.state === 'collected') continue;
            const bob = k.state === 'idle' ? Math.sin(performance.now() * 0.004) * 5 : 0;
            ctx.save();
            ctx.translate(k.x, k.y + bob);
            ctx.rotate(-0.55 + (k.state === 'flying' ? k.flyT * Math.PI * 4 : 0));
            ctx.fillStyle = '#f2efe6';
            ctx.strokeStyle = '#17343a';
            ctx.lineWidth = 6;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.arc(0, -22, 25, 0, Math.PI * 2);
            ctx.moveTo(-8, 0);
            ctx.lineTo(-8, 54);
            ctx.lineTo(8, 64);
            ctx.lineTo(18, 50);
            ctx.lineTo(8, 43);
            ctx.lineTo(8, 0);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff0bd';
            ctx.beginPath(); ctx.ellipse(0, -22, 12, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    }

    function drawPlayer() {
        // === v4.9.5 进门吸入动画（showSuccess 阶段2）：lerp + 缩放 ===
        let ax = player.x, ay = player.y;
        let scale = 1.0;
        if (showSuccess) {
            const elapsed = SUCCESS_TOTAL - successTimer;  // 已过帧数 0..120
            if (elapsed >= 40 && elapsed < 100) {
                const phaseT = (elapsed - 40) / 60;  // 0..1
                const eased = phaseT * phaseT;       // easeIn（越吸越快，被吞感）
                ax = _animStartX + (_animTargetX - _animStartX) * eased;
                ay = _animStartY + (_animTargetY - _animStartY) * eased;
                scale = 1 - eased;
            } else if (elapsed >= 100) {
                // 阶段3 蛋消失
                return;
            }
        }
        const inAir = !player.onGround;
        const walking = player.onGround && Math.abs(player.vx) > 10;
        const rising = inAir && player.vy < -180;
        const falling = inAir && !rising;
        const poseClock = performance.now() * 0.001;
        // 待机轻呼吸、走路上下弹动；只改视觉，不影响物理碰撞。
        // 走路每个周期只向上弹一次，形成“走一步、蹦一下”的节奏。
        const walkHop = -Math.max(0, Math.sin(player.walkT)) * 9;
        const poseBob = inAir ? 0 : (walking ? walkHop : Math.sin(poseClock * 2.4) * 1.8);
        const x = ax, y = ay - 23 * scale + poseBob * scale;
        // 参考稿的角色是竖向圆润“豆蛋”：身体更高、脸部更开朗。
        const rx = HALF_W * 1.08 * scale, ry = HALF_H * 0.95 * scale;
        const seed = 30000;
        const amp = 1.5 * Math.max(0.3, scale);

        // === 1. 主体：Q弹更圆的手绘蛋形（横向加宽，纵向缩短）===
        ctx.save();
        if (scale < 0.001 || ry < 1) { ctx.restore(); return; }
        ctx.fillStyle = '#fff0bd';
        ctx.beginPath();
        const pts = 48;
        for (let i = 0; i <= pts; i++) {
            const t = (i / pts) * Math.PI * 2;
            // 上窄下圆的豆蛋轮廓：顶部收窄，脸颊和下腹更饱满。
            const vertical = Math.sin(t);
            const widthFactor = 0.82 + (vertical + 1) * 0.11;
            const px = x + Math.cos(t) * rx * widthFactor + wobbleStatic(seed + i, amp);
            const py = y + vertical * ry + wobbleStatic(seed + 500 + i, amp);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.lineWidth = 4.6 * Math.max(0.2, scale); ctx.strokeStyle = '#17343a';
        ctx.lineJoin = 'round'; ctx.stroke();
        ctx.restore();

        if (scale < 0.25) return;   // 缩放太小 手脚眼不画了

        // === 2. 头顶呆毛（比原来短约30%，不那么翘）===
        ctx.save();
        ctx.strokeStyle = '#17343a';
        ctx.lineWidth = 3.5 * Math.max(0.3, scale);
        ctx.lineCap = 'round';
        const browPulse = Math.sin(poseClock * (walking ? 9 : 2.8));
        const browLift = (rising ? -7 : falling ? 2 : browPulse * 1.8) * scale;
        const browSpread = (walking ? browPulse * 2.2 : rising ? 3 : 0) * scale;
        ctx.beginPath();
        ctx.moveTo(x - 20 * scale - browSpread + wobbleStatic(seed+1, 0.5), y - ry - 3 * scale + browLift);
        ctx.quadraticCurveTo(x - 20 * scale - browSpread, y - ry - 18 * scale + browLift,
                             x - 7 * scale, y - ry - 17 * scale + browLift);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 20 * scale + browSpread + wobbleStatic(seed+2, 0.5), y - ry - 3 * scale + browLift);
        ctx.quadraticCurveTo(x + 20 * scale + browSpread, y - ry - 18 * scale + browLift,
                             x + 7 * scale, y - ry - 17 * scale + browLift);
        ctx.stroke();
        ctx.restore();

        // === 3. 眼睛：待机会眨眼；走路/跳跃保持不同神态 ===
        ctx.save();
        ctx.fillStyle = '#17343a';
        ctx.strokeStyle = '#17343a';
        ctx.lineWidth = 3.6 * scale;
        ctx.lineCap = 'round';
        const eyY = y - 13 * scale;
        const eyOffX = rx * 0.34;
        const blinking = !walking && !inAir && (poseClock % 3.6) > 3.32;
        if (falling) {
            // 下落姿势参考图：两眼用有力的内收折线表现眯眼。
            ctx.beginPath();
            ctx.moveTo(x - eyOffX - 8 * scale, eyY - 5 * scale);
            ctx.lineTo(x - eyOffX + 7 * scale, eyY);
            ctx.lineTo(x - eyOffX - 7 * scale, eyY + 5 * scale);
            ctx.moveTo(x + eyOffX + 8 * scale, eyY - 5 * scale);
            ctx.lineTo(x + eyOffX - 7 * scale, eyY);
            ctx.lineTo(x + eyOffX + 7 * scale, eyY + 5 * scale);
            ctx.stroke();
        } else if (blinking) {
            ctx.beginPath();
            ctx.moveTo(x - eyOffX - 7 * scale, eyY);
            ctx.quadraticCurveTo(x - eyOffX, eyY + 5 * scale, x - eyOffX + 7 * scale, eyY);
            ctx.moveTo(x + eyOffX - 7 * scale, eyY);
            ctx.quadraticCurveTo(x + eyOffX, eyY + 5 * scale, x + eyOffX + 7 * scale, eyY);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.ellipse(x - eyOffX, eyY, 6.5 * scale, (inAir ? 11 : 10) * scale, -0.08, 0, Math.PI * 2);
            ctx.ellipse(x + eyOffX, eyY, 6.5 * scale, (inAir ? 11 : 10) * scale, 0.08, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // === 4. 嘴：待机/跳跃露齿笑，走路切换为轻松弧线嘴 ===
        ctx.save();
        const mouthW = 34 * scale, mouthH = 20 * scale;
        const mouthX = x - mouthW / 2, mouthY = y + 7 * scale;
        ctx.fillStyle = '#fff0bd';
        ctx.strokeStyle = '#17343a';
        ctx.lineWidth = 3.6 * scale;
        ctx.lineCap = 'round';
        if (walking) {
            ctx.beginPath();
            ctx.moveTo(x - 14 * scale, mouthY + 5 * scale);
            ctx.quadraticCurveTo(x + 2 * scale, mouthY + 13 * scale, x + 16 * scale, mouthY + 1 * scale);
            ctx.stroke();
        } else {
            const corner = 4 * scale;
            ctx.beginPath();
            ctx.moveTo(mouthX + corner, mouthY + 1 * scale);
            ctx.bezierCurveTo(mouthX + 10 * scale, mouthY + 3 * scale,
                              x - 7 * scale, mouthY + 7 * scale,
                              x, mouthY + 7 * scale);
            ctx.bezierCurveTo(x + 7 * scale, mouthY + 7 * scale,
                              mouthX + mouthW - 10 * scale, mouthY + 3 * scale,
                              mouthX + mouthW - corner, mouthY + 1 * scale);
            // 圆润 C 形端头：控制点沿轮廓切线连续，不产生夹角。
            ctx.bezierCurveTo(mouthX + mouthW, mouthY + 1 * scale,
                              mouthX + mouthW + 1 * scale, mouthY + 4 * scale,
                              mouthX + mouthW, mouthY + 8 * scale);
            ctx.bezierCurveTo(mouthX + mouthW - 2 * scale, mouthY + mouthH - 2 * scale,
                              x + 8 * scale, mouthY + mouthH,
                              x, mouthY + mouthH);
            ctx.bezierCurveTo(x - 8 * scale, mouthY + mouthH,
                              mouthX + 2 * scale, mouthY + mouthH - 2 * scale,
                              mouthX, mouthY + 8 * scale);
            ctx.bezierCurveTo(mouthX - 1 * scale, mouthY + 4 * scale,
                              mouthX, mouthY + 1 * scale,
                              mouthX + corner, mouthY + 1 * scale);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // 两颗门牙的分隔线近似竖直，只保留很轻的手绘弧度。
            for (const toothX of [x - 6 * scale, x + 6 * scale]) {
                ctx.beginPath();
                ctx.moveTo(toothX, mouthY + 6 * scale);
                ctx.quadraticCurveTo(toothX + 0.7 * scale, mouthY + 12 * scale,
                                     toothX, mouthY + mouthH - 2 * scale);
                ctx.stroke();
            }
        }
        ctx.restore();

        // 下腹的小弧线是参考角色的固定识别细节。
        ctx.save();
        ctx.strokeStyle = '#17343a';
        ctx.lineWidth = 2.8 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + 7 * scale, y + ry * 0.55);
        ctx.quadraticCurveTo(x + 2 * scale, y + ry * 0.65, x - 4 * scale, y + ry * 0.58);
        ctx.stroke();
        ctx.restore();

        // === 5. 手：走路 对侧旋转小幅度；跳跃时 手抬起+上下波浪摆动
        // （跳跃在空中优先级更高，覆盖走路模式）===
        ctx.save();
        ctx.strokeStyle = '#17343a';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.fillStyle = '#17343a';
        const hx1 = x - rx * 0.90;
        const hy1 = y + ry * 0.25;
        const hx2 = x + rx * 0.90;
        const HLEN = 23;
        // 跳跃判定在角色绘制开头统一计算。
        // 走路模式：sH（0.32rad对侧摆动）
        // 跳跃模式：手抬起(上移) + 上下波浪（上下摆动）
        let hL_offX = 0, hL_offY = 0, hR_offX = 0, hR_offY = 0;
        let angHL = +player.sH;
        let angHR = -player.sH;
        let hLBaseX = -11, hLBaseY = HLEN;
        let hRBaseX = 11, hRBaseY = HLEN;
        if (rising) {
            // 起跳：双臂高举成参考图里的大 V。
            hLBaseX = -25;
            hLBaseY = -30;
            hRBaseX = 25;
            hRBaseY = -30;
            angHL = 0;
            angHR = 0;
        } else if (falling) {
            // 下落：双臂向两侧展开。
            hLBaseX = -31;
            hLBaseY = -12;
            hRBaseX = 31;
            hRBaseY = -12;
            angHL = 0;
            angHR = 0;
        }
        function rot(ang, dx, dy) {
            const c = Math.cos(ang), s = Math.sin(ang);
            return [dx*c - dy*s, dx*s + dy*c];
        }
        // 左手
        const [hLdx, hLdy] = rot(angHL, hLBaseX, hLBaseY);
        const hLx0 = hx1 + hL_offX, hLy0 = hy1 + hL_offY;
        const hLx1 = hx1 + hL_offX + hLdx, hLy1 = hy1 + hL_offY + hLdy;
        ctx.beginPath();
        ctx.moveTo(hLx0 + wobbleStatic(seed+31, 0.5), hLy0 + wobbleStatic(seed+32, 0.5));
        ctx.quadraticCurveTo(hLx0 - 12, hLy0 + 8,
                            hLx1 + wobbleStatic(seed+33, 0.5), hLy1 + wobbleStatic(seed+34, 0.5));
        ctx.stroke();
        // 右手
        const [hRdx, hRdy] = rot(angHR, hRBaseX, hRBaseY);
        const hRx0 = hx2 + hR_offX, hRy0 = hy1 + hR_offY;
        const hRx1 = hx2 + hR_offX + hRdx, hRy1 = hy1 + hR_offY + hRdy;
        ctx.beginPath();
        ctx.moveTo(hRx0 + wobbleStatic(seed+41, 0.5), hRy0 + wobbleStatic(seed+42, 0.5));
        ctx.quadraticCurveTo(hRx0 + 12, hRy0 + 8,
                            hRx1 + wobbleStatic(seed+43, 0.5), hRy1 + wobbleStatic(seed+44, 0.5));
        ctx.stroke();
        ctx.restore();

        // === 6. 脚：走路 左右平移（x方向分开/闭合，企鹅式左右摇摆）；跳跃时缩起
        ctx.save();
        ctx.strokeStyle = '#17343a';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        const fOffX0 = -16;   // 基础x
        const fOffX1 = +16;
        const fyTop = y + ry - 4;
        const fyBot = y + ry + 26;
        const FLEN = fyBot - fyTop;  // 再加长约6px，总长约30px
        // 走路时：左右平移±10（左脚+10时右脚-10，对侧），脚本身是直竖线不再旋转
        const swinging = Math.sin(player.walkT);
        // walking 在角色绘制开头统一计算。
        let fShL = 0, fShR = 0;
        if (walking) {
            fShL = +swinging * 10;   // 左脚 x 正方向（右）
            fShR = -swinging * 10;   // 右脚 x 负方向（左）
        }
        // 四张参考图对应：起跳张腿、下落长腿、走路时一脚弯曲抬起。
        let fOffY = 0;
        if (rising) {
            fOffY = -5;
            fShL = -15;
            fShR = 15;
        }
        const stepPhase = walking ? Math.sin(player.walkT) : 0;
        const liftLeft = walking && stepPhase > 0.15;
        const liftRight = walking && stepPhase < -0.15;
        // 左脚（x平移）
        const fx1 = x + fOffX0 + fShL;
        const fLx0 = fx1, fLy0 = fyTop + fOffY;
        const fLx1 = fx1 + (inAir ? -9 : 0), fLy1 = fyBot + fOffY;
        ctx.beginPath();
        ctx.moveTo(fLx0 + wobbleStatic(seed+51, 0.5), fLy0 + wobbleStatic(seed+52, 0.3));
        if (liftLeft) {
            ctx.quadraticCurveTo(fLx0 - 4, fLy0 + 13, fLx1 + 12, fLy1 - 10);
            ctx.quadraticCurveTo(fLx1 + 19, fLy1 - 14, fLx1 + 23, fLy1 - 9);
        } else {
            ctx.lineTo(fLx1 + wobbleStatic(seed+53, 0.5), fLy1 + wobbleStatic(seed+54, 0.3));
        }
        ctx.stroke();
        // 左脚底横短线（仍然水平，不旋转）
        ctx.beginPath();
        if (!liftLeft) {
            ctx.moveTo(fLx1 - 4 + wobbleStatic(seed+55, 0.4), fLy1 + wobbleStatic(seed+56, 0.3));
            ctx.lineTo(fLx1 + 5 + wobbleStatic(seed+57, 0.4), fLy1 + wobbleStatic(seed+58, 0.3));
            ctx.stroke();
        }
        // 右脚（x平移，对侧）
        const fx2 = x + fOffX1 + fShR;
        const fRx0 = fx2, fRy0 = fyTop + fOffY;
        const fRx1 = fx2 + (inAir ? 9 : 0), fRy1 = fyBot + fOffY;
        ctx.beginPath();
        ctx.moveTo(fRx0 + wobbleStatic(seed+61, 0.5), fRy0 + wobbleStatic(seed+62, 0.3));
        if (liftRight) {
            ctx.quadraticCurveTo(fRx0 + 4, fRy0 + 13, fRx1 - 12, fRy1 - 10);
            ctx.quadraticCurveTo(fRx1 - 19, fRy1 - 14, fRx1 - 23, fRy1 - 9);
        } else {
            ctx.lineTo(fRx1 + wobbleStatic(seed+63, 0.5), fRy1 + wobbleStatic(seed+64, 0.3));
        }
        ctx.stroke();
        // 右脚底横短线（水平）
        ctx.beginPath();
        if (!liftRight) {
            ctx.moveTo(fRx1 - 4 + wobbleStatic(seed+65, 0.4), fRy1 + wobbleStatic(seed+66, 0.3));
            ctx.lineTo(fRx1 + 5 + wobbleStatic(seed+67, 0.4), fRy1 + wobbleStatic(seed+68, 0.3));
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawSuccessOverlay() {
        if (!showSuccess) return;
        const totalFrames = SUCCESS_TOTAL;
        const p = 1 - successTimer / totalFrames;  // 整体进度 0..1
        // 弹窗淡入：最后 20 帧才淡入
        let overlayAlpha = 0;
        if (successTimer < 20) overlayAlpha = Math.min(1, (20 - successTimer) / 15);
        ctx.save();
        ctx.globalAlpha = overlayAlpha;
        // 成功弹窗（无投影白底简单圆角）
        const sx = W / 2 - 280, sy = H / 2 - 150, sw = 560, sh = 300;
        _wonkyRectPath(sx, sy, sw, sh, 28, 44444, 2.5);
        ctx.fillStyle = '#fff0bd'; ctx.fill();
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4.5; ctx.stroke();
        sketchBold('墨境已破！', W / 2, H / 2 - 50, 64);
        sketchBold('灵思 +1', W / 2, H / 2 + 20, 32);
        ctx.restore();
        if (successTimer <= 0) {
            logStep('state', 'transition-to-complete', {
                gameState, showSuccess, successTimer, currentLevelIndex
            });
            gameState = 'completeIntro';
            showSuccess = false;
            _completeTimer = COMPLETE_INTRO_TOTAL;
            _completeRotAngle = 0;
            // 保存通关进度
            if (!_progress.completed.includes(currentLevelIndex)) {
                _progress.completed.push(currentLevelIndex);
            }
            // 解锁下一关
            const nextUnlock = Math.min(TOTAL_LEVELS, Math.max(_progress.unlocked, currentLevelIndex + 2));
            _progress.unlocked = nextUnlock;
            saveProgress();
            logStep('state', 'progress-saved', { levelIndex: currentLevelIndex, completed: _progress.completed, unlocked: _progress.unlocked });
        }
    }

    function drawDeadOverlay() {
        if (!showDead) return;
        ctx.save();
        // 半透明蒙层（背景轻微压暗）
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(0, 0, W, H);
        // 失败弹窗：白底 wonky 矩形（比成功略高，因为有"重来"按钮）
        const sx = W / 2 - 290, sy = H / 2 - 180, sw = 580, sh = 360;
        _wonkyRectPath(sx, sy, sw, sh, 30, 44445, 2.6);
        ctx.fillStyle = '#fff0bd'; ctx.fill();
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4.5; ctx.stroke();
        sketchBold('掉下去了…', W / 2, H / 2 - 80, 56);
        sketchBold('😵 脑洞 -1', W / 2, H / 2 - 10, 30);
        // 「重来」按钮（wonky白底黑边，居中）
        const btw = DEAD_BTN.btw, bth = DEAD_BTN.bth;
        const btx = DEAD_BTN.btx = W / 2 - btw / 2;
        const bty = DEAD_BTN.bty = H / 2 + 40;
        ctx.save();
        ctx.fillStyle = '#fff0bd';
        _wonkyRectPath(btx, bty, btw, bth, 28, 60001, 2.5); ctx.fill();
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4.5;
        _wonkyRectPath(btx, bty, btw, bth, 28, 60001, 2.5); ctx.stroke();
        ctx.restore();
        sketchBold('重 来', btx + btw / 2, bty + bth / 2 + 8, 40);
        ctx.restore();
    }

    function drawMenu() {
        drawGrid();
        const logW = 250, logH = 76, logX = W - logW - 46, logY = 38;
        ctx.save(); ctx.fillStyle = '#fff0bd';
        _wonkyRectPath(logX, logY, logW, logH, 20, 55139, 2); ctx.fill();
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4;
        _wonkyRectPath(logX, logY, logW, logH, 20, 55139, 2); ctx.stroke(); ctx.restore();
        sketchBold('导出日志', logX + logW / 2, logY + logH / 2 + 5, 30);
        uiBTN.exportLog = { x: logX, y: logY, w: logW, h: logH };
        // 主菜单保持简单风格
        sketchBold('墨 境 旅 人', W / 2, H * 0.24, 100);
        sketchBold('机 关 七 卷', W / 2, H * 0.40, 112);
        const bw = W * 0.28, bh = 135, gap=70, bx = W/2-bw-gap/2, by = H * 0.58;
        // 开始按钮（不规则圆角方形白底黑描边）
        ctx.save();
        ctx.fillStyle = '#fff0bd';
        _wonkyRectPath(bx, by, bw, bh, 52, 55555, 2.5); ctx.fill();
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 5;
        _wonkyRectPath(bx, by, bw, bh, 52, 55555, 2.5); ctx.stroke();
        ctx.restore();
        sketchBold('踏 入 墨 境', bx + bw / 2, by + bh / 2 + 10, 50);
        const cbx=W/2+gap/2;
        ctx.save();ctx.fillStyle='#fff0bd';_wonkyRectPath(cbx,by,bw,bh,52,55595,2.5);ctx.fill();ctx.strokeStyle='#17343a';ctx.lineWidth=5;_wonkyRectPath(cbx,by,bw,bh,52,55595,2.5);ctx.stroke();ctx.restore();
        sketchBold('绘 制 新 卷',cbx+bw/2,by+bh/2+10,50);
        sketchText('© 2024 MVP Demo', W / 2, H - 52, 24, 'center', false, 'rgba(0,0,0,0.4)');
        uiBTN.start = { x: bx, y: by, w: bw, h: bh };
        uiBTN.creator = { x: cbx, y: by, w: bw, h: bh };
    }

    function _newCreatorDraft() {
        return { id:'custom-'+Date.now(), name:'我的脑洞关卡 '+(_creatorLevels.length+1), type:'custom', mechanics:[], no_fall:true, infinite_horizontal:false, expand_up:false, map_extent:{left:0,right:0,up:0}, description:{hint_l1:'找到办法进入终点门。'}, world_size:{w:1920,h:1080}, spawn:{x:300,y:810}, platforms:[{x:960,y:1090,w:1920,h:440,kind:'ground'}], doors:[{id:'custom_entry',x:300,y:765,w:150,h:210,is_goal:false},{id:'custom_goal',x:1540,y:765,w:150,h:210,is_goal:true}], crates:[], keys:[], question_blocks:[], decor:[] };
    }
    function _saveCreatorLevels() { localStorage.setItem(CREATOR_LS_KEY,JSON.stringify(_creatorLevels)); }
    function _saveCreatorDraftToList() {
        if(!_creatorDraft)return;
        const idx=_creatorLevels.findIndex(x=>x.id===_creatorDraft.id);
        const saved=JSON.parse(JSON.stringify(_creatorDraft));
        if(idx>=0)_creatorLevels[idx]=saved;else _creatorLevels.push(saved);
        _saveCreatorLevels();_creatorSavedUntil=performance.now()+1800;gameState='creatorList';
        logStep('creator','level-save',{id:saved.id,name:saved.name,mechanics:saved.mechanics,list_index:idx>=0?idx:_creatorLevels.length-1});
    }
    function _pushCreatorHistory() {
        if(!_creatorDraft)return;
        _creatorHistory.push(JSON.stringify(_creatorDraft));
        if(_creatorHistory.length>30)_creatorHistory.shift();
    }
    function _undoCreatorStep() {
        if(!_creatorHistory.length){logStep('creator','undo-empty',{});return;}
        _creatorDraft=JSON.parse(_creatorHistory.pop());
        _creatorMechanics=_mechanicsOf(_creatorDraft);
        logStep('creator','undo',{remaining_steps:_creatorHistory.length});
    }
    function _creatorEditableTargets() {
        if(!_creatorDraft)return [];
        return [
            ...(_creatorDraft.doors||[]).map(obj=>({obj,w:obj.w||150,h:obj.h||210,kind:obj.is_goal?'goal':'spawn'})),
            ...(_creatorDraft.platforms||[]).filter(obj=>obj.kind!=='ground').map(obj=>({obj,w:obj.w||260,h:obj.h||52,kind:'platform'})),
            ...(_creatorDraft.crates||[]).map(obj=>({obj,w:obj.w||130,h:obj.h||140,kind:'crate'})),
            ...(_creatorDraft.keys||[]).map(obj=>({obj,w:90,h:90,kind:'key'})),
            ...(_creatorDraft.question_blocks||[]).map(obj=>({obj,w:obj.w||105,h:obj.h||105,kind:'question'}))
        ];
    }
    function _creatorTargetAt(worldPoint) {
        return _creatorEditableTargets().reverse().find(t=>inRect(worldPoint,{x:t.obj.x-t.w/2-20,y:t.obj.y-t.h/2-20,w:t.w+40,h:t.h+40}))||null;
    }
    function _moveCreatorSelection(x,y) {
        if(!_creatorSelected)return;
        _pushCreatorHistory();
        const t=_creatorSelected,o=t.obj,from={x:o.x,y:o.y};
        o.x=x;o.y=y;
        if(t.kind==='spawn'){
            _creatorDraft.spawn={x,y:y+45};
        }
        logStep('creator','element-move',{kind:t.kind,id:o.id||o.kind,from,to:{x,y}});
    }
    function _toggleCreatorMechanic(kind) {
        if(kind==='hold_to_stop'){
            if(!_creatorMechanics.includes(kind))_creatorMechanics.push(kind);
            _creatorDraft.mechanics=[..._creatorMechanics];_creatorBindingMode=true;
            logStep('creator','moving-binding-mode-open',{});return;
        }
        _pushCreatorHistory();
        if(kind==='normal'){
            _creatorMechanics=[];_creatorBindingMode=false;
            for(const o of [...(_creatorDraft.platforms||[]),...(_creatorDraft.doors||[]),...(_creatorDraft.crates||[]),...(_creatorDraft.keys||[]),...(_creatorDraft.question_blocks||[])])delete o.hold_to_stop;
        }
        else if(_creatorMechanics.includes(kind))_creatorMechanics=_creatorMechanics.filter(x=>x!==kind);
        else _creatorMechanics.push(kind);
        _creatorDraft.mechanics=[..._creatorMechanics];_creatorDraft.mechanic=undefined;_creatorDraft.type='custom';
        _creatorDraft.double_jump=_creatorMechanics.includes('double_jump');
        if(!_creatorMechanics.includes('flower_password'))_creatorDraft.question_blocks=[];
        if(!_creatorMechanics.includes('key'))_creatorDraft.keys=[];
        if(_creatorMechanics.includes('flower_password')){
            _creatorDraft.password='3125';
            if(!(_creatorDraft.question_blocks||[]).length)_creatorDraft.question_blocks=[3,1,2,5].map((count,i)=>({id:'custom_q'+i,x:690+i*190,y:500,w:130,h:130,count}));
        }
        if(_creatorMechanics.includes('key')){
            if(!(_creatorDraft.keys||[]).length)_creatorDraft.keys=[{id:'custom_key',x:960,y:790,target_door:'custom_goal'}];
        }
        const labels={double_jump:'连续跳两次',knock_twice:'走到门前敲门两次',flower_password:'顶出花朵并记住密码',key:'找到钥匙',hold_to_stop:'按住会动的元素'};
        _creatorDraft.description.hint_l1=_creatorMechanics.length?_creatorMechanics.map(x=>labels[x]).join('，')+'。':'找到办法进入终点门。';
        const gd=_creatorDraft.doors.find(d=>d.is_goal); if(gd)gd.locked=_creatorMechanics.includes('key');
        logStep('creator','mechanic-toggle',{changed:kind,mechanics:_creatorMechanics});
    }
    function _button(x,y,w,h,label,seed,size=30){ctx.save();ctx.shadowColor='rgba(36,30,45,.28)';ctx.shadowBlur=0;ctx.shadowOffsetY=7;ctx.fillStyle='#fff0bd';_wonkyRectPath(x,y,w,h,22,seed,2);ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#17343a';ctx.lineWidth=4;_wonkyRectPath(x,y,w,h,22,seed,2);ctx.stroke();ctx.restore();sketchBold(label,x+w/2,y+h/2+5,size);return{x,y,w,h};}
    function _shareHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36).toUpperCase();}
    function _base64UrlEncode(s){const bytes=new TextEncoder().encode(s);let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
    function _base64UrlDecode(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
    function _makeShareLevel(lv){const clean=JSON.parse(JSON.stringify(lv));delete clean.id;delete clean._moveBaseY;return clean;}
    function _encodeLevelCode(lv){const json=JSON.stringify({v:1,min:148,level:_makeShareLevel(lv)}),payload=_base64UrlEncode(json);return'SE1-'+payload+'-'+_shareHash(payload);}
    function _decodeLevelCode(code){
        const raw=String(code||'').replace(/\s/g,'');if(raw.length>5000)throw new Error('关卡码太长');
        const m=/^SE1-([A-Za-z0-9_-]+)-([A-Z0-9]+)$/.exec(raw);if(!m)throw new Error('不是有效的 SE1 关卡码');
        if(_shareHash(m[1])!==m[2])throw new Error('关卡码不完整');
        const data=JSON.parse(_base64UrlDecode(m[1])),lv=data.level;if(!lv||!lv.spawn||!Array.isArray(lv.platforms)||!Array.isArray(lv.doors))throw new Error('关卡数据缺失');
        const all=[...(lv.platforms||[]),...(lv.doors||[]),...(lv.crates||[]),...(lv.keys||[]),...(lv.question_blocks||[])];if(all.length>80)throw new Error('关卡元素超过80个');
        if(!(lv.doors||[]).some(d=>d.is_goal))throw new Error('没有终点门');
        lv.id='imported-'+Date.now();lv.name=String(lv.name||'好友分享关卡').slice(0,20)+'（导入）';return lv;
    }
    function _copyText(text){
        if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).catch(()=>{});
        else{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
        _creatorSavedUntil=performance.now()+1800;logStep('creator','share-code-copy',{chars:text.length});
    }
    const _codeDialog=document.getElementById('level-code-dialog');
    const _codeInput=document.getElementById('level-code-input');
    const _codeError=document.getElementById('level-code-error');
    function _closeCodeInput(){
        if(!_codeDialog)return;
        _codeDialog.hidden=true;_codeInput.blur();_codeError.textContent='';
        logStep('creator','share-code-input-close',{});
    }
    function _submitCodeInput(){
        const raw=_codeInput.value.trim();
        if(!raw){_codeError.textContent='请先粘贴关卡码';_codeInput.focus();return;}
        try{
            _creatorImportPreview=_decodeLevelCode(raw);
            logStep('creator','share-code-read',{name:_creatorImportPreview.name,mechanics:_mechanicsOf(_creatorImportPreview)});
            _codeDialog.hidden=true;_codeInput.blur();_codeError.textContent='';
        }catch(e){
            _codeError.textContent='无法读取：'+e.message;
            logStep('creator','share-code-invalid',{reason:e.message});
            _codeInput.focus();
        }
    }
    function _openCodeInput(){
        if(!_codeDialog)return;
        _codeDialog.hidden=false;_codeInput.value='';_codeError.textContent='';
        // 必须由点击事件直接触发真实表单 focus，Android/iOS 才会拉起系统键盘。
        _codeInput.focus({preventScroll:true});
        setTimeout(()=>_codeInput.focus({preventScroll:true}),50);
        logStep('creator','share-code-input-open',{keyboard_focus:true});
    }
    if(_codeInput){
        document.getElementById('level-code-submit').addEventListener('click',_submitCodeInput);
        document.getElementById('level-code-cancel').addEventListener('click',_closeCodeInput);
        _codeInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();_submitCodeInput();}});
    }

    function _syncCreatorGround(){
        const b=_mapBounds(_creatorDraft),ground=(_creatorDraft.platforms||[]).find(p=>p.kind==='ground');
        if(ground){ground.x=(b.minX+b.maxX)/2;ground.w=b.maxX-b.minX;}
        _creatorDraft.world_size={w:b.maxX-b.minX,h:b.maxY-b.minY};
        _creatorDraft.expand_up=b.e.up>0;
        _creatorDraft.infinite_horizontal=false;
    }
    function _creatorObjectsOutside(bounds){
        const objects=[_creatorDraft.spawn,...(_creatorDraft.doors||[]),...(_creatorDraft.platforms||[]).filter(p=>p.kind!=='ground'),...(_creatorDraft.crates||[]),...(_creatorDraft.keys||[]),...(_creatorDraft.question_blocks||[])];
        return objects.some(o=>o&&(o.x<bounds.minX||o.x>bounds.maxX||o.y<bounds.minY||o.y>bounds.maxY));
    }
    function _changeCreatorMapEdge(edge,delta){
        if(!_creatorDraft)return;
        const old=_mapExtent(_creatorDraft),next={...old};
        next[edge]=Math.max(0,Math.min(99,next[edge]+delta));
        if(next[edge]===old[edge])return;
        const nextBounds={minX:-next.left*W,maxX:(next.right+1)*W,minY:-next.up*H,maxY:H,e:next};
        if(delta<0&&_creatorObjectsOutside(nextBounds)){
            _creatorRangeNotice='这一边还有元素，不能减少';_creatorRangeNoticeUntil=performance.now()+1800;
            logStep('creator','map-edge-reduce-blocked',{edge,next});return;
        }
        _pushCreatorHistory();_creatorDraft.map_extent=next;_syncCreatorGround();
        const b=_mapBounds(_creatorDraft);_creatorCameraX=Math.max(b.minX,Math.min(b.maxX-W,_creatorCameraX));_creatorCameraY=Math.max(b.minY,Math.min(0,_creatorCameraY));
        logStep('creator','map-edge-change',{edge,delta,map_extent:next});
    }
    function drawCreatorList() {
        sketchBold('创造秘境',W/2,100,66); sketchText('把脑洞做成可以分享的关卡',W/2,165,28);
        if(performance.now()<_creatorSavedUntil)sketchBold('已保存，点击“玩”开始体验',W/2,205,26,'center','#111');
        uiBTN.creatorBtns=[];uiBTN.creatorConfirmBtns=[];
        const cols=3,cw=480,ch=180,gap=45,startX=(W-(cols*cw+(cols-1)*gap))/2;
        _creatorLevels.forEach((lv,i)=>{
            const x=startX+(i%cols)*(cw+gap),y=235+Math.floor(i/cols)*(ch+35);
            ctx.save();ctx.fillStyle='#fff0bd';_wonkyRectPath(x,y,cw,ch,22,86000+i,2);ctx.fill();ctx.strokeStyle='#17343a';ctx.lineWidth=4;_wonkyRectPath(x,y,cw,ch,22,86000+i,2);ctx.stroke();ctx.restore();
            sketchBold(lv.name||('自定义关卡 '+(i+1)),x+cw/2,y+48,32);
            const ms=_mechanicsOf(lv),names={double_jump:'多跳',knock_twice:'敲门',flower_password:'顶花密码',key:'钥匙',hold_to_stop:'会动'};
            sketchText(ms.length?ms.map(x=>names[x]).join('＋'):'普通玩法',x+cw/2,y+88,20);
            let r=_button(x+38,y+112,115,52,'玩',86050+i,22);r.action='play';r.index=i;uiBTN.creatorBtns.push(r);
            r=_button(x+178,y+112,115,52,'编辑',86070+i,21);r.action='open';r.index=i;uiBTN.creatorBtns.push(r);
            r=_button(x+318,y+112,115,52,'分享',86080+i,21);r.action='share';r.index=i;uiBTN.creatorBtns.push(r);
            r=_button(x+cw-62,y+12,46,46,'×',86090+i,25);r.action='delete';r.index=i;uiBTN.creatorBtns.push(r);
        });
        const by=H-145,bw=420,bh=82;
        let r=_button(W/2-bw/2,by,bw,bh,'＋ 生成新的秘境',86100,30);r.action='new';uiBTN.creatorBtns.push(r);
        r=_button(W/2-bw/2,by-100,bw,bh,'输入关卡码',86101,30);r.action='import';uiBTN.creatorBtns.push(r);
        r=_button(55,45,220,80,'返回营地',86102,27);r.action='back';uiBTN.creatorBtns.push(r);
        if(_creatorDeleteConfirmIndex>=0&&_creatorLevels[_creatorDeleteConfirmIndex]){
            const lv=_creatorLevels[_creatorDeleteConfirmIndex];
            ctx.save();ctx.fillStyle='rgba(0,0,0,.36)';ctx.fillRect(0,0,W,H);ctx.restore();
            const mw=720,mh=330,mx=(W-mw)/2,my=(H-mh)/2;
            ctx.save();ctx.fillStyle='#fff0bd';_wonkyRectPath(mx,my,mw,mh,30,86500,3);ctx.fill();ctx.strokeStyle='#17343a';ctx.lineWidth=7;_wonkyRectPath(mx,my,mw,mh,30,86500,3);ctx.stroke();ctx.restore();
            sketchBold('确认删除这个关卡吗？',W/2,my+82,38);
            sketchText(lv.name||'未命名关卡',W/2,my+138,26);
            r=_button(mx+85,my+205,230,78,'取消',86501,28);r.action='cancel';uiBTN.creatorConfirmBtns.push(r);
            r=_button(mx+405,my+205,230,78,'确认删除',86502,27);r.action='confirm';uiBTN.creatorConfirmBtns.push(r);
        }
        if(_creatorShareCode){
            ctx.save();ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(0,0,W,H);ctx.restore();
            const mx=410,my=300,mw=1100,mh=420;ctx.save();ctx.fillStyle='#fff0bd';_wonkyRectPath(mx,my,mw,mh,30,86600,3);ctx.fill();ctx.strokeStyle='#17343a';ctx.lineWidth=7;_wonkyRectPath(mx,my,mw,mh,30,86600,3);ctx.stroke();ctx.restore();
            sketchBold('分享关卡',W/2,my+70,42);sketchText('关卡码只能复制粘贴',W/2,my+120,24);
            sketchText(_creatorShareCode.slice(0,72)+'…',W/2,my+185,19);
            r=_button(mx+190,my+270,280,85,'复制关卡码',86601,28);r.action='copy-share';uiBTN.creatorConfirmBtns.push(r);
            r=_button(mx+630,my+270,280,85,'关闭',86602,28);r.action='close-share';uiBTN.creatorConfirmBtns.push(r);
        }
        if(_creatorImportPreview){
            ctx.save();ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(0,0,W,H);ctx.restore();const mx=430,my=260,mw=1060,mh=500;
            ctx.save();ctx.fillStyle='#fff0bd';_wonkyRectPath(mx,my,mw,mh,30,86700,3);ctx.fill();ctx.strokeStyle='#17343a';ctx.lineWidth=7;_wonkyRectPath(mx,my,mw,mh,30,86700,3);ctx.stroke();ctx.restore();
            sketchBold('找到关卡',W/2,my+72,42);sketchBold(_creatorImportPreview.name,W/2,my+135,30);sketchText('玩法：'+(_mechanicsOf(_creatorImportPreview).join('＋')||'普通'),W/2,my+190,23);
            r=_button(mx+90,my+300,250,82,'立即玩',86701,27);r.action='play-import';uiBTN.creatorConfirmBtns.push(r);
            r=_button(mx+405,my+300,250,82,'保存到我的关卡',86702,23);r.action='save-import';uiBTN.creatorConfirmBtns.push(r);
            r=_button(mx+720,my+300,250,82,'取消',86703,27);r.action='cancel-import';uiBTN.creatorConfirmBtns.push(r);
        }
    }
    function _drawCreatorMapOverview(){
        uiBTN.editorTools=[];
        const b=_mapBounds(_creatorDraft),box={x:120,y:135,w:1680,h:700},pad=55;
        ctx.save();ctx.fillStyle='rgba(255,255,255,.96)';ctx.fillRect(0,0,W,H);ctx.restore();
        sketchBold('调整地图范围',W/2,70,44);
        sketchText('整张地图已缩小显示；每次点击增加或减少一整屏',W/2,112,23);
        const scale=Math.min((box.w-pad*2)/(b.maxX-b.minX),(box.h-pad*2)/(b.maxY-b.minY));
        const ox=box.x+(box.w-(b.maxX-b.minX)*scale)/2-b.minX*scale;
        const oy=box.y+(box.h-(b.maxY-b.minY)*scale)/2-b.minY*scale;
        ctx.save();ctx.beginPath();ctx.rect(box.x,box.y,box.w,box.h);ctx.clip();ctx.translate(ox,oy);ctx.scale(scale,scale);
        ctx.fillStyle='#fafafa';ctx.fillRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);
        ctx.strokeStyle='#17343a';ctx.lineWidth=Math.max(3/scale,2);ctx.strokeRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);
        ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=Math.max(2/scale,1);
        for(let x=Math.ceil(b.minX/W)*W;x<b.maxX;x+=W){ctx.beginPath();ctx.moveTo(x,b.minY);ctx.lineTo(x,b.maxY);ctx.stroke();}
        for(let y=Math.ceil(b.minY/H)*H;y<b.maxY;y+=H){ctx.beginPath();ctx.moveTo(b.minX,y);ctx.lineTo(b.maxX,y);ctx.stroke();}
        for(const p of _creatorDraft.platforms||[]){ctx.fillStyle=p.kind==='ground'?'#111':'#fff0bd';ctx.strokeStyle='#17343a';ctx.lineWidth=Math.max(4/scale,2);ctx.fillRect(p.x-p.w/2,p.y-p.h/2,p.w,p.h);ctx.strokeRect(p.x-p.w/2,p.y-p.h/2,p.w,p.h);}
        for(const d of _creatorDraft.doors||[]){ctx.fillStyle='#fff0bd';ctx.strokeStyle='#17343a';ctx.lineWidth=Math.max(5/scale,2);ctx.fillRect(d.x-d.w/2,d.y-d.h/2,d.w,d.h);ctx.strokeRect(d.x-d.w/2,d.y-d.h/2,d.w,d.h);}
        for(const c of _creatorDraft.crates||[]){ctx.strokeStyle='#17343a';ctx.lineWidth=Math.max(4/scale,2);ctx.strokeRect(c.x-c.w/2,c.y-c.h/2,c.w,c.h);}
        ctx.fillStyle='#17343a';ctx.beginPath();ctx.arc(_creatorDraft.spawn.x,_creatorDraft.spawn.y,Math.max(16/scale,12),0,Math.PI*2);ctx.fill();
        ctx.restore();
        sketchText(`左 ${b.e.left} 屏　右 ${b.e.right} 屏　上 ${b.e.up} 屏`,W/2,868,27);
        const actions=[['edge','＋左','left',1],['edge','－左','left',-1],['edge','＋右','right',1],['edge','－右','right',-1],['edge','＋上','up',1],['edge','－上','up',-1],['map-done','完成','',0]];
        actions.forEach((it,i)=>{const r=_button(205+i*220,910,190,70,it[1],86800+i,24);r.action=it[0];r.edge=it[2];r.delta=it[3];uiBTN.editorTools.push(r);});
        if(performance.now()<_creatorRangeNoticeUntil)sketchBold(_creatorRangeNotice,W/2,1025,25,'center','#b00020');
    }
    function drawCreatorEditor() {
        sketchBold('秘境编辑台',W/2,48,44); sketchText(_creatorDraft.name,W/2,92,23);
        const tools=[['select','选择'],['platform','平台'],['spawn','出生门'],['goal','终点门'],['crate','木箱'],['key','钥匙']];uiBTN.editorTools=[];
        tools.forEach((it,i)=>{const r=_button(38+i*158,120,142,68,it[1],86200+i,21);r.action='tool';r.tool=it[0];if(_creatorTool===it[0]){ctx.strokeStyle='#17343a';ctx.lineWidth=7;ctx.strokeRect(r.x+5,r.y+5,r.w-10,r.h-10);}uiBTN.editorTools.push(r);});
        [['save','保存'],['play','试玩'],['undo','撤销'],['back','返回']].forEach((it,i)=>{const r=_button(W-585+i*145,120,132,68,it[1],86300+i,21);r.action=it[0];uiBTN.editorTools.push(r);});
        sketchText('特殊玩法：',55,230,24,'left');
        const mechanics=[['normal','普通'],['double_jump','多跳'],['knock_twice','敲门'],['flower_password','顶花'],['key','钥匙'],['hold_to_stop','会动']];
        mechanics.forEach((it,i)=>{const r=_button(180+i*190,198,165,65,it[1],86400+i,22);r.action='mechanic';r.mechanic=it[0];const selected=it[0]==='normal'?!_creatorMechanics.length:_creatorMechanics.includes(it[0]);if(selected){ctx.strokeStyle='#17343a';ctx.lineWidth=7;ctx.strokeRect(r.x+5,r.y+5,r.w-10,r.h-10);}uiBTN.editorTools.push(r);});
        if(_creatorMapOverview){_drawCreatorMapOverview();return;}
        sketchText('地图范围：',55,312,23,'left');
        const ext=_mapExtent(_creatorDraft);
        let rr=_button(195,275,240,58,'调整地图',86480,21);rr.action='map-overview';uiBTN.editorTools.push(rr);
        sketchText(`左${ext.left} 右${ext.right} 上${ext.up}`,465,312,20,'left');
        sketchText('视野：'+Math.round(_creatorCameraX)+','+Math.round(_creatorCameraY),W-70,312,19,'right');
        ctx.save();ctx.strokeStyle='rgba(0,0,0,.35)';ctx.setLineDash([12,10]);ctx.strokeRect(45,350,W-90,530);ctx.restore();
        ctx.save();ctx.beginPath();ctx.rect(45,350,W-90,530);ctx.clip();ctx.translate(-_creatorCameraX,-_creatorCameraY);
        for(const p of _creatorDraft.platforms){const x=p.x-p.w/2,y=p.y-p.h/2;ctx.fillStyle='#fff0bd';ctx.fillRect(x,y,p.w,p.h);ctx.strokeStyle='#17343a';ctx.lineWidth=5;ctx.strokeRect(x,y,p.w,p.h);}
        for(const d of _creatorDraft.doors){ctx.strokeStyle='#17343a';ctx.lineWidth=6;ctx.strokeRect(d.x-d.w/2,d.y-d.h/2,d.w,d.h);sketchText(d.is_goal?'终':'生',d.x,d.y,28);}
        for(const c of _creatorDraft.crates||[]){ctx.strokeStyle='#17343a';ctx.lineWidth=5;ctx.strokeRect(c.x-c.w/2,c.y-c.h/2,c.w,c.h);sketchText('箱',c.x,c.y,24);}
        for(const k of _creatorDraft.keys||[]){sketchBold('🔑',k.x,k.y,35);}
        for(const q of _creatorDraft.question_blocks||[]){ctx.strokeStyle='#17343a';ctx.lineWidth=5;ctx.strokeRect(q.x-q.w/2,q.y-q.h/2,q.w,q.h);sketchBold('?',q.x,q.y+5,42);}
        const bound=[...(_creatorDraft.platforms||[]),...(_creatorDraft.doors||[]),...(_creatorDraft.crates||[]),...(_creatorDraft.keys||[]),...(_creatorDraft.question_blocks||[])].filter(x=>x.hold_to_stop);
        for(const o of bound)sketchBold('≋',o.x,o.y-(o.h||90)/2-24,30);
        if(_creatorSelected&&_creatorTool==='select'){
            const t=_creatorSelected,o=t.obj;
            ctx.save();ctx.strokeStyle='#efb400';ctx.lineWidth=9;ctx.setLineDash([18,10]);ctx.strokeRect(o.x-t.w/2-14,o.y-t.h/2-14,t.w+28,t.h+28);ctx.restore();
        }
        ctx.restore();
        const pans=[['pan-left','← 左移'],['pan-origin','回原点'],['pan-right','右移 →'],['pan-up','↑ 上移'],['pan-down','下移 ↓']];
        pans.forEach((it,i)=>{const r=_button(445+i*210,900,185,58,it[1],86520+i,20);r.action=it[0];uiBTN.editorTools.push(r);});
        if(_creatorBindingMode){ctx.save();ctx.fillStyle='rgba(0,0,0,.42)';ctx.fillRect(0,0,W,H);ctx.restore();sketchBold('选择要添加“会动，按住不动”的元素',W/2,335,38,'center','#fff0bd');sketchText('带 ≋ 的元素已绑定；再次选择可取消',W/2,382,24,'center',false,'#fff0bd');}
        sketchText(_creatorTool==='select'?'选择/移动：先点已有元素，再点目标位置。':'移动视野后可在上方、左侧、右侧继续摆放元素。',W/2,995,23);
    }
    function _playCreatorDraft() {
        _playingCustom=true; levelData=JSON.parse(JSON.stringify(_creatorDraft)); currentLevelIndex=-1;
        _cachedLevels[-1]=levelData; if(!_availableLevels.includes(-1))_availableLevels.push(-1); loadLevelAndStart();
        logStep('creator','custom-play',{id:levelData.id,name:levelData.name});
    }
    function _exportCreatorLevel(lv) {
        const text=JSON.stringify(lv,null,2),filename=(lv.name||'smart-egg-level')+'.json';
        if(window.AndroidLogExporter&&window.AndroidLogExporter.exportLog){window.AndroidLogExporter.exportLog(filename,text);}else{const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}logStep('creator','level-export',{id:lv.id,bytes:text.length});
    }

    function drawComplete() {
        drawGrid();
        sketchBold('第 ' + (currentLevelIndex + 1) + ' 关完成', W / 2, H * 0.18, 56);

        // ===== v4.9.6 complete 3 个按钮 =====
        // 返回菜单 / 选关页面 / 下一关
        // 布局：3 个按钮水平排列、居中
        uiBTN.complete_btns = [];
        const labels = ['返回菜单', '选关页面', '下一关'];
        const keys = ['menu', 'levelSelect', 'next'];
        const btnW = 260, btnH = 110, btnGap = 40;
        const totalW = btnW * 3 + btnGap * 2;
        const startX = (W - totalW) / 2;
        const startY = H * 0.48;
        const nxt = currentLevelIndex + 1;
        const nextOverflow = nxt >= TOTAL_LEVELS;
        const nextAvailable = _availableLevels.includes(nxt);
        const nextUnlocked = (nxt + 1) <= _progress.unlocked;

        for (let i = 0; i < 3; i++) {
            const bx = startX + i * (btnW + btnGap);
            const by = startY;
            let disabled = false;
            if (keys[i] === 'next') {
                disabled = nextOverflow || !nextAvailable || !nextUnlocked;
            }
            ctx.save();
            if (disabled) ctx.globalAlpha = 0.45;
            ctx.fillStyle = '#fff0bd';
            const seed = 30000 + i * 777;
            _wonkyRectPath(bx, by, btnW, btnH, 28, seed, 2.5); ctx.fill();
            ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4;
            _wonkyRectPath(bx, by, btnW, btnH, 28, seed, 2.5); ctx.stroke();
            ctx.restore();
            sketchBold(disabled ? '敬请期待' : labels[i], bx + btnW / 2, by + btnH / 2 + 8, 32);
            uiBTN.complete_btns.push({
                key: keys[i], label: labels[i],
                x: bx, y: by, w: btnW, h: btnH,
                disabled,
                nxt, nextOverflow, nextAvailable, nextUnlocked
            });
        }
    }

    // ===== v4.9.6 completeIntro 转圈动画 =====
    function drawCompleteIntroAnim() {
        const cx = W / 2, cy = H / 2 - 30;
        const baseR = 100;
        const ringCount = 3;
        // 外圈虚线环：3 层虚线，每层角速度不同
        ctx.save();
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        for (let r = 0; r < ringCount; r++) {
            const radius = baseR + r * 22;
            const speed = (r % 2 === 0 ? 1 : -1) * (0.04 + r * 0.015);
            const rot = _completeRotAngle * speed;
            ctx.strokeStyle = r === 0 ? '#17343a' : (r === 1 ? '#666' : '#333');
            ctx.setLineDash([28, 18]);
            ctx.beginPath();
            // 画一个圆环（虚线）
            const step = 0.2;
            for (let a = 0; a <= Math.PI * 2 + 0.01; a += step) {
                const ra = a + rot;
                const px = cx + Math.cos(ra) * radius;
                const py = cy + Math.sin(ra) * radius;
                if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();

        // 中心文字："🎉 恭喜通关！" + 关卡号
        const alpha = Math.min(1, (90 - _completeTimer) / 20);
        ctx.save();
        ctx.globalAlpha = alpha;
        sketchBold('🎉 恭喜通关！', W / 2, H * 0.22, 72);
        sketchBold('第 ' + (currentLevelIndex + 1) + ' 关', W / 2, cy + 195, 48);
        sketchBold('脑洞 +1', W / 2, H * 0.46, 56);
        ctx.restore();
    }

    // ===== v4.9.6 选关页面（2 排 × 5 列） =====
    function drawLevelSelect() {
        drawGrid();
        // 标题
        sketchBold('主 线 画 卷', W / 2, H * 0.12, 72);
        sketchText('已通关: ' + _progress.completed.length + ' / ' + TOTAL_LEVELS, W / 2, H * 0.18, 28, 'center', false, 'rgba(0,0,0,0.5)');

        // 布局：2 排 × 5 列
        const cols = 5, rows = 2;
        const cellW = 300, cellH = 200, gapX = 50, gapY = 50;
        const totalW = cellW * cols + gapX * (cols - 1);
        const totalH = cellH * rows + gapY * (rows - 1);
        const startX = (W - totalW) / 2;
        const startY = H * 0.30;

        uiBTN.levelSelect_btns = [];

        for (let idx = 0; idx < TOTAL_LEVELS; idx++) {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const bx = startX + col * (cellW + gapX);
            const by = startY + row * (cellH + gapY);

            const unlocked = idx + 1 <= _progress.unlocked;
            const completed = _progress.completed.includes(idx);
            const available = _availableLevels.includes(idx);

            // 未解锁但关卡内容存在的标记为"可解锁"
            // 规则：有 JSON + 前一关通关 才算解锁
            const canPlay = unlocked && available;

            // v4.9.6b 旧逻辑：canPlay=false 一律画锁🔒+未解锁（不区分没开发/未解锁）
            // 画单元格（wonky 白底黑描边）
            const seed = 90000 + idx * 13;
            ctx.save();
            if (canPlay) {
                ctx.fillStyle = completed ? '#d5f5d5' : '#fff0bd';
            } else {
                ctx.fillStyle = '#e8e8e8';
            }
            _wonkyRectPath(bx, by, cellW, cellH, 24, seed, 2); ctx.fill();
            ctx.strokeStyle = '#17343a'; ctx.lineWidth = 3.5;
            _wonkyRectPath(bx, by, cellW, cellH, 24, seed, 2); ctx.stroke();
            ctx.restore();

            // 画关卡编号
            if (canPlay) {
                sketchBold(String(idx + 1), bx + cellW / 2, by + cellH * 0.35, 56);
                sketchText(completed ? '✓ 已通关' : '未通关', bx + cellW / 2, by + cellH * 0.62, 26, 'center', false, completed ? '#2a8a2a' : 'rgba(0,0,0,0.5)');
                sketchText('第 ' + (idx + 1) + ' 关', bx + cellW / 2, by + cellH * 0.82, 22, 'center', false, 'rgba(0,0,0,0.4)');
            } else {
                // 不可玩：一律浅灰 + 锁图标 + 🔒未解锁/📝待开发 小字
                drawLockIcon(bx + cellW / 2, by + cellH / 2 - 10);
                sketchText(available ? '🔒 未解锁' : '📝 待开发', bx + cellW / 2, by + cellH * 0.82, 22, 'center', false, 'rgba(0,0,0,0.5)');
            }

            if (canPlay) {
                uiBTN.levelSelect_btns.push({ x: bx, y: by, w: cellW, h: cellH, levelIndex: idx });
            }
        }

        // 返回营地按钮
        const backW = 260, backH = 90;
        const backX = (W - backW) / 2;
        const backY = H * 0.88;
        ctx.save();
        ctx.fillStyle = '#fff0bd';
        _wonkyRectPath(backX, backY, backW, backH, 28, 99999, 2); ctx.fill();
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4;
        _wonkyRectPath(backX, backY, backW, backH, 28, 99999, 2); ctx.stroke();
        ctx.restore();
        sketchBold('返回卷首', backX + backW / 2, backY + backH / 2 + 6, 32);
        uiBTN.levelSelect_back = { x: backX, y: backY, w: backW, h: backH };
    }

    // 画锁图标
    function drawLockIcon(cx, cy) {
        ctx.save();
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // 锁身：矩形
        const bw = 36, bh = 28;
        ctx.fillStyle = '#aaa';
        _wonkyRectPath(cx - bw / 2, cy - 4, bw, bh, 5, 777, 1.5); ctx.fill();
        ctx.strokeStyle = '#17343a';
        _wonkyRectPath(cx - bw / 2, cy - 4, bw, bh, 5, 777, 1.5); ctx.stroke();
        // 锁环：半圆
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 14, Math.PI + 0.1, 2 * Math.PI - 0.1);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#17343a';
        ctx.stroke();
        ctx.restore();
    }

    // ===== 点击映射 =====
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        let cx, cy;
        if (e.touches && e.touches.length) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
        else if (e.changedTouches && e.changedTouches.length) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
        else { cx = e.clientX; cy = e.clientY; }
        return {
            x: (cx - rect.left) * (W / rect.width),
            y: (cy - rect.top) * (H / rect.height)
        };
    }
    function inRect(p, r) { return r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
    function pressInput(name, isDown) {
        if (name === 'jump') {
            if (isDown) { if (!input.jumpHeld) input.jumpPressed = true; input.jumpHeld = true; }
            else input.jumpHeld = false;
        } else input[name] = isDown;
    }
    function handleDown(p) {
        if (_passwordVisible) {
            for (const b of uiBTN.passwordKeys || []) if (inRect(p,b)) {
                if (b.key === 'close') { _passwordVisible=false; _passwordInput=''; _passwordDismissUntil=performance.now()+900; logStep('puzzle','password-panel-close',{}); return; }
                else if (b.key === '←') _passwordInput=_passwordInput.slice(0,-1);
                else if (b.key === '清') _passwordInput='';
                else if (_passwordInput.length < 4) _passwordInput += b.key;
                playSfx('knock');
                logStep('puzzle','password-key',{key:b.key,input:_passwordInput});
                if (_passwordInput.length === 4) {
                    const expectedPassword=_expectedFlowerPassword();
                    if (_passwordInput === expectedPassword) {
                        _passwordSolved=true; _passwordVisible=false; playSfx('unlock');
                        logStep('puzzle','password-correct',{input:_passwordInput,expected:expectedPassword});
                    } else { _passwordErrorUntil=performance.now()+1300; logStep('puzzle','password-wrong',{input:_passwordInput,expected:expectedPassword}); _passwordInput=''; }
                }
                return;
            }
            return;
        }
        if (gameState === 'menu') {
            if (inRect(p, uiBTN.exportLog)) {
                logStep('input', 'menu-export-log-click', { x: Math.round(p.x), y: Math.round(p.y) });
                exportDiagnosticLog();
                return;
            }
            if (inRect(p, uiBTN.start)) {
                gameState = 'levelSelect';
                logStep('state', 'menu→levelSelect', {});
            }
            if (inRect(p, uiBTN.creator)) { gameState='creatorList'; logStep('state','menu→creatorList',{}); }
            return;
        }
        if (gameState === 'creatorList') {
            if(_creatorShareCode||_creatorImportPreview){
                for(const b of uiBTN.creatorConfirmBtns||[])if(inRect(p,b)){
                    if(b.action==='copy-share')_copyText(_creatorShareCode);
                    else if(b.action==='close-share')_creatorShareCode='';
                    else if(b.action==='cancel-import')_creatorImportPreview=null;
                    else if(b.action==='save-import'){_creatorLevels.push(JSON.parse(JSON.stringify(_creatorImportPreview)));_saveCreatorLevels();_creatorImportPreview=null;_creatorSavedUntil=performance.now()+1800;}
                    else if(b.action==='play-import'){_creatorDraft=JSON.parse(JSON.stringify(_creatorImportPreview));_creatorMechanics=_mechanicsOf(_creatorDraft);_creatorImportPreview=null;_playCreatorDraft();}
                    return;
                }
                return;
            }
            if(_creatorDeleteConfirmIndex>=0){
                for(const b of uiBTN.creatorConfirmBtns||[])if(inRect(p,b)){
                    if(b.action==='cancel'){
                        logStep('creator','level-delete-cancel',{index:_creatorDeleteConfirmIndex});
                        _creatorDeleteConfirmIndex=-1;
                    } else if(b.action==='confirm'){
                        const removed=_creatorLevels.splice(_creatorDeleteConfirmIndex,1)[0];
                        _saveCreatorLevels();
                        logStep('creator','level-delete-confirm',{id:removed&&removed.id,name:removed&&removed.name,remaining:_creatorLevels.length});
                        _creatorDeleteConfirmIndex=-1;
                    }
                    return;
                }
                return;
            }
            for(const b of uiBTN.creatorBtns||[]) if(inRect(p,b)){
                if(b.action==='back') gameState='menu';
                else if(b.action==='new'){_creatorDraft=_newCreatorDraft();_creatorTool='platform';_creatorMechanics=[];_creatorHistory=[];_creatorBindingMode=false;_creatorCameraX=0;_creatorCameraY=0;_creatorMapOverview=false;gameState='creatorEdit';}
                else if(b.action==='open'){_creatorDraft=JSON.parse(JSON.stringify(_creatorLevels[b.index]));_creatorMechanics=_mechanicsOf(_creatorDraft);_creatorHistory=[];_creatorBindingMode=false;_creatorCameraX=0;_creatorCameraY=0;_creatorMapOverview=false;gameState='creatorEdit';}
                else if(b.action==='play'){_creatorDraft=JSON.parse(JSON.stringify(_creatorLevels[b.index]));_creatorMechanics=_mechanicsOf(_creatorDraft);_playCreatorDraft();}
                else if(b.action==='share'){_creatorShareIndex=b.index;_creatorShareCode=_encodeLevelCode(_creatorLevels[b.index]);logStep('creator','share-code-generate',{index:b.index,chars:_creatorShareCode.length});}
                else if(b.action==='import')_openCodeInput();
                else if(b.action==='delete'){_creatorDeleteConfirmIndex=b.index;logStep('creator','level-delete-request',{id:_creatorLevels[b.index]&&_creatorLevels[b.index].id,index:b.index});}
                return;
            }
            return;
        }
        if (gameState === 'creatorEdit') {
            if(_creatorBindingMode){
                const wp={x:p.x+_creatorCameraX,y:p.y+_creatorCameraY};
                const groups=[...(_creatorDraft.doors||[]).map(obj=>({obj,w:obj.w||150,h:obj.h||210})),...(_creatorDraft.platforms||[]).map(obj=>({obj,w:obj.w||260,h:obj.h||52})),...(_creatorDraft.crates||[]).map(obj=>({obj,w:obj.w||130,h:obj.h||140})),...(_creatorDraft.keys||[]).map(obj=>({obj,w:90,h:90})),...(_creatorDraft.question_blocks||[]).map(obj=>({obj,w:obj.w||105,h:obj.h||105}))];
                const hit=groups.reverse().find(t=>inRect(wp,{x:t.obj.x-t.w/2-20,y:t.obj.y-t.h/2-20,w:t.w+40,h:t.h+40}));
                if(hit){_pushCreatorHistory();hit.obj.hold_to_stop=!hit.obj.hold_to_stop;_creatorBindingMode=false;logStep('creator','moving-element-binding',{id:hit.obj.id||hit.obj.kind,bound:hit.obj.hold_to_stop});}
                return;
            }
            for(const b of uiBTN.editorTools||[]) if(inRect(p,b)){
                if(b.action==='tool'){_creatorTool=b.tool;if(b.tool!=='select')_creatorSelected=null;}
                else if(b.action==='mechanic') _toggleCreatorMechanic(b.mechanic);
                else if(b.action==='map-overview'){_creatorMapOverview=true;_creatorBindingMode=false;}
                else if(b.action==='edge')_changeCreatorMapEdge(b.edge,b.delta);
                else if(b.action==='map-done')_creatorMapOverview=false;
                else if(b.action==='pan-left'){const mb=_mapBounds(_creatorDraft);_creatorCameraX=Math.max(mb.minX,_creatorCameraX-W);}
                else if(b.action==='pan-right'){const mb=_mapBounds(_creatorDraft);_creatorCameraX=Math.min(mb.maxX-W,_creatorCameraX+W);}
                else if(b.action==='pan-up'){const mb=_mapBounds(_creatorDraft);_creatorCameraY=Math.max(mb.minY,_creatorCameraY-H);}
                else if(b.action==='pan-down')_creatorCameraY=Math.min(0,_creatorCameraY+H);
                else if(b.action==='pan-origin'){_creatorCameraX=0;_creatorCameraY=0;}
                else if(b.action==='back') gameState='creatorList';
                else if(b.action==='play') _playCreatorDraft();
                else if(b.action==='undo') _undoCreatorStep();
                else if(b.action==='save')_saveCreatorDraftToList();
                return;
            }
            if(p.x>45&&p.x<W-45&&p.y>350&&p.y<880){
                const wx=Math.round(p.x+_creatorCameraX),wy=Math.round(p.y+_creatorCameraY);
                if(_creatorTool==='select'){
                    const hit=_creatorTargetAt({x:wx,y:wy});
                    if(hit){_creatorSelected=hit;logStep('creator','element-select',{kind:hit.kind,id:hit.obj.id||hit.obj.kind,x:hit.obj.x,y:hit.obj.y});}
                    else if(_creatorSelected)_moveCreatorSelection(wx,wy);
                    return;
                }
                _pushCreatorHistory();
                if(_creatorTool==='platform') _creatorDraft.platforms.push({x:wx,y:wy,w:260,h:52,kind:'step_custom'});
                else if(_creatorTool==='spawn') {_creatorDraft.spawn={x:wx,y:wy};_creatorDraft.doors=_creatorDraft.doors.filter(d=>d.is_goal);_creatorDraft.doors.unshift({id:'custom_entry',x:wx,y:wy-45,w:150,h:210,is_goal:false});}
                else if(_creatorTool==='goal'){_creatorDraft.doors=_creatorDraft.doors.filter(d=>!d.is_goal);_creatorDraft.doors.push({id:'custom_goal',x:wx,y:wy,w:150,h:210,is_goal:true});}
                else if(_creatorTool==='crate') (_creatorDraft.crates||(_creatorDraft.crates=[])).push({id:'box_'+Date.now(),x:wx,y:wy,w:130,h:140});
                else if(_creatorTool==='key'){(_creatorDraft.keys||(_creatorDraft.keys=[])).push({id:'key_'+Date.now(),x:wx,y:wy,target_door:'custom_goal'});const gd=_creatorDraft.doors.find(d=>d.is_goal);if(gd)gd.locked=true;}
                logStep('creator','element-place',{tool:_creatorTool,x:wx,y:wy,cameraX:_creatorCameraX,cameraY:_creatorCameraY});
            }
            return;
        }
        if (gameState === 'levelSelect') {
            // 先检查返回按钮
            if (inRect(p, uiBTN.levelSelect_back)) {
                gameState = 'menu';
                logStep('state', 'levelSelect→menu', {});
                return;
            }
            // 检查关卡格子
            if (uiBTN.levelSelect_btns) {
                for (const b of uiBTN.levelSelect_btns) {
                    if (inRect(p, b)) {
                        loadLevelByIndex(b.levelIndex);
                        return;
                    }
                }
            }
            return;
        }
        if (gameState === 'complete' || gameState === 'completeIntro') {
            if (_completeTimer > 0) return;   // 转圈动画期间不响应
            if (uiBTN.complete_btns) {
                for (const b of uiBTN.complete_btns) {
                    if (inRect(p, b)) {
                        if (b.disabled) {
                            logStep('state', 'complete-btn-disabled-click', { key: b.key });
                            return;   // 置灰按钮完全不响应
                        }
                        if (b.key === 'menu') backToMenu();
                        else if (b.key === 'levelSelect') { gameState = 'levelSelect'; logStep('state','complete→levelSelect',{}); }
                        else if (b.key === 'next') {
                            // ===== 下一关前置拦截（3层保护防死循环）=====
                            const nxt = currentLevelIndex + 1;
                            const isAvailable = _availableLevels.includes(nxt);  // JSON 存在（=已开发）
                            const isUnlocked  = (nxt+1) <= _progress.unlocked;  // 规则同选关页
                            const isOverflow  = nxt >= TOTAL_LEVELS;
                            if (isOverflow || !(isAvailable && isUnlocked)) {
                                logStep('state', 'next-level-blocked', {
                                    next: nxt, isOverflow, isAvailable, isUnlocked,
                                    available: _availableLevels, unlocked: _progress.unlocked,
                                    reason: isOverflow ? '超过总关卡数' : (
                                        !isUnlocked ? '未解锁（前一关未通关）' : 'JSON不存在（没开发）'
                                    )
                                });
                                // 转选关页，让用户看到锁标记不迷茫
                                gameState = 'levelSelect';
                                logStep('state', 'blocked→levelSelect', { next: nxt });
                            } else {
                                loadLevelByIndex(nxt);
                            }
                        }
                        return;
                    }
                }
            }
            return;
        }
        // 顶部三个功能按钮：此前只有绘制，没有点击区域和事件绑定。
        if (gameState === 'playing' || gameState === 'paused') {
            if (gameState === 'paused' && inRect(p, uiBTN.pauseLevelSelect)) {
                helpVisible = false;
                handleUp();
                gameState = _playingCustom ? 'creatorList' : 'levelSelect';
                if (_playingCustom) _playingCustom=false;
                logStep('state', 'paused→list', { source: 'pause-menu', to:gameState });
                return;
            }
            if (gameState === 'paused' && inRect(p, uiBTN.pauseResume)) {
                helpVisible = false;
                handleUp();
                gameState = 'playing';
                logStep('state', 'paused→playing', { source: 'pause-menu-resume' });
                return;
            }
            if (inRect(p, uiBTN.help)) {
                helpVisible = !helpVisible;
                logStep('input', 'top-help-click', { visible: helpVisible, gameState });
                return;
            }
            if (inRect(p, uiBTN.restart)) {
                helpVisible = false;
                logStep('input', 'top-restart-click', { levelIndex: currentLevelIndex, fromState: gameState });
                loadLevelByIndex(currentLevelIndex);
                return;
            }
            if (inRect(p, uiBTN.pause)) {
                helpVisible = false;
                const wasPaused = gameState === 'paused';
                gameState = wasPaused ? 'playing' : 'paused';
                handleUp();
                logStep('state', wasPaused ? 'paused→playing' : 'playing→paused', { source: 'top-pause-button' });
                return;
            }
        }
        if (showDead) {
            const r = { x: DEAD_BTN.btx, y: DEAD_BTN.bty, w: DEAD_BTN.btw, h: DEAD_BTN.bth };
            if (inRect(p, r)) {
                // ===== 死亡重来前置拦截：当前关没开发（JSON不存在）→ 不重复加载，直接跳选关页，避免死循环 =====
                const cur = currentLevelIndex;
                const curAvail = _availableLevels.includes(cur);
                if (!curAvail) {
                    logStep('state', 'dead-retry-blocked-no-level', { idx: cur, reason: 'JSON不存在=没开发，不进入循环，跳选关页' });
                    showDead = false;
                    gameState = 'levelSelect';
                    return;
                }
                showDead = false;
                loadLevelByIndex(currentLevelIndex);
            }
            return;
        }
        if (gameState === 'playing') {
            if (levelData && _hasMechanic('knock_twice')) {
                const goalDoor = (levelData.doors || []).find(d => d.is_goal);
                if (goalDoor) {
                    const doorRect = {
                        x: goalDoor.x - goalDoor.w / 2 - 18,
                        y: goalDoor.y - goalDoor.h / 2 - 30,
                        w: goalDoor.w + 36,
                        h: goalDoor.h + 48
                    };
                    const worldTap={x:p.x+_cameraX,y:p.y+_cameraY};
                    if (inRect(worldTap, doorRect)) {
                        const playerAtDoor = Math.abs(player.x - goalDoor.x) <= 75
                            && Math.abs(player.y - goalDoor.y) <= 170;
                        playSfx('knock');
                        _knockEffects.push({
                            x: goalDoor.x - goalDoor.w * 0.36,
                            y: goalDoor.y - goalDoor.h * 0.12,
                            startedAt: performance.now(),
                            valid: playerAtDoor
                        });
                        if (playerAtDoor) _validKnockCount = Math.min(2, _validKnockCount + 1);
                        logStep('input', 'door-knock', {
                            valid: playerAtDoor,
                            validKnocks: _validKnockCount,
                            playerX: Math.round(player.x),
                            doorX: goalDoor.x
                        });
                        return;
                    }
                }
            }
            if (inRect(p, uiBTN.left)) pressInput('left', true);
            else if (inRect(p, uiBTN.right)) pressInput('right', true);
            else if (inRect(p, uiBTN.jump)) pressInput('jump', true);
        }
    }
    function handleUp() {
        pressInput('left', false); pressInput('right', false); pressInput('jump', false);
        _mouseMovingTarget=null;
    }
    canvas.addEventListener('mousedown', e => {const p=getMousePos(e),t=gameState==='playing'?_movingTargetAt(p):null;if(t){_mouseMovingTarget=t.obj;logStep('input','moving-element-hold',{kind:t.kind,id:t.obj.id,pointer:'mouse'});}else handleDown(p);});
    canvas.addEventListener('mouseup',   () => handleUp());
    canvas.addEventListener('mouseleave',() => handleUp());
    const _activeTouchControls = new Map();
    function _touchPos(touch) {
        const rect = canvas.getBoundingClientRect();
        return { x: (touch.clientX - rect.left) * (W / rect.width), y: (touch.clientY - rect.top) * (H / rect.height) };
    }
    function _controlAt(p) {
        if (inRect(p, uiBTN.left)) return 'left';
        if (inRect(p, uiBTN.right)) return 'right';
        if (inRect(p, uiBTN.jump)) return 'jump';
        return null;
    }
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        _ensureAudio(); _startBgm();
        for (const touch of Array.from(e.changedTouches)) {
            const p = _touchPos(touch);
            const moving = gameState === 'playing' ? _movingTargetAt(p) : null;
            if(moving){_heldMovingTargets.set(touch.identifier,moving.obj);logStep('input','moving-element-hold',{kind:moving.kind,id:moving.obj.id,pointer:touch.identifier});continue;}
            const control = gameState === 'playing' ? _controlAt(p) : null;
            if (control) {
                _activeTouchControls.set(touch.identifier, control);
                pressInput(control, true);
                logStep('input', 'touch-control-down', { id: touch.identifier, control, x: Math.round(p.x), y: Math.round(p.y), active: Array.from(_activeTouchControls.values()), input: { ...input } });
            } else {
                logStep('input', 'touch-action-down', { id: touch.identifier, x: Math.round(p.x), y: Math.round(p.y), state: gameState, touchCount: e.touches.length });
                handleDown(p);
            }
        }
    }, { passive: false });
    function _releaseChangedTouches(e, reason) {
        e.preventDefault();
        for (const touch of Array.from(e.changedTouches)) {
            if(_heldMovingTargets.has(touch.identifier)){const obj=_heldMovingTargets.get(touch.identifier);_heldMovingTargets.delete(touch.identifier);logStep('input','moving-element-release',{id:obj&&obj.id,pointer:touch.identifier,reason});continue;}
            const control = _activeTouchControls.get(touch.identifier);
            if (!control) continue;
            _activeTouchControls.delete(touch.identifier);
            const stillHeld = Array.from(_activeTouchControls.values()).includes(control);
            if (!stillHeld) pressInput(control, false);
            logStep('input', 'touch-control-up', { id: touch.identifier, control, reason, stillHeld, active: Array.from(_activeTouchControls.values()), input: { ...input } });
        }
    }
    canvas.addEventListener('touchend', e => _releaseChangedTouches(e, 'end'), { passive: false });
    canvas.addEventListener('touchcancel', e => _releaseChangedTouches(e, 'cancel'), { passive: false });

    // ===== 启动 =====
    async function probeAvailableLevels() {
        _availableLevels = [];
        const probeStart = performance.now();
        logStep('level-load', 'probe-start', { total: TOTAL_LEVELS, url_prefix: '../godot_project/levels/level_' });
        for (let i = 0; i < TOTAL_LEVELS; i++) {
            // Android WebView 的 file:// 页面可能禁止 fetch 本地 JSON；优先使用脚本内置关卡。
            if (window.__SMART_EGG_LEVELS__ && window.__SMART_EGG_LEVELS__[i]) {
                _cachedLevels[i] = window.__SMART_EGG_LEVELS__[i];
                _availableLevels.push(i);
                logStep('level-load', 'probe-inline-level', { idx: i, source: 'levels_bundle.js' });
                continue;
            }
            try {
                const url = '../godot_project/levels/level_' + i + '.json?v=' + GAME_CODE_VERSION;
                const t0 = performance.now();
                const resp = await fetch(url, { cache: 'no-store' });
                const ms = Math.round(performance.now() - t0);
                if (resp.ok) {
                    const data = await resp.json();
                    _cachedLevels[i] = data;
                    _availableLevels.push(i);
                    // v4.9.7a D类：探测到关卡 → 完整结构快照（门/平台/格式/中心式正确性）
                    const plats = data.platforms || [];
                    const drs   = data.doors     || [];
                    logStep('level-load', 'probe-found-level', {
                        idx: i, status: resp.status, fetch_ms: ms, url,
                        name: data.name || '(unnamed)',
                        spawn: data.spawn,
                        platforms_count: plats.length,
                        platform_format_center_style: plats.length===0 ? null :
                            ('w' in plats[0] && 'h' in plats[0] && !('x1' in plats[0])),
                        platform_sample: plats[0] || null,
                        doors_count: drs.length,
                        decor_count: (data.decor||[]).length
                    });
                } else {
                    // v4.9.7a D类：不存在（HTTP非200）→ 记录具体状态码（404 vs 500）+ 明确用 fallback
                    logStep('level-load', 'probe-missing-json', {
                        idx: i, status: resp.status, fetch_ms: ms, url,
                        using_fallback: true, reason: 'HTTP ' + resp.status
                    });
                    _cachedLevels[i] = _makeLevelFallback(i);
                }
            } catch(e) {
                // v4.9.7a D类：fetch 网络异常（CORS/离线/文件协议）也要明确打！
                logStep('fatal', 'probe-fetch-exception', {
                    idx: i, err: e.message, stack: String(e.stack||'').slice(0,200),
                    using_fallback: true
                });
                _cachedLevels[i] = _makeLevelFallback(i);
            }
        }
        const probeMs = Math.round(performance.now() - probeStart);
        logStep('level-load', 'probe-available-levels', {
            available: _availableLevels.slice(),
            available_count: _availableLevels.length,
            cached_count: Object.keys(_cachedLevels).length,
            total: TOTAL_LEVELS,
            missing_count: TOTAL_LEVELS - _availableLevels.length,
            probe_total_ms: probeMs
        });
    }

    function loadLevelByIndex(idx) {
        // v4.9.7a D类：从什么来源进入（选关页 / 通关自动跳 / 重来快捷键 / 死亡重来 / 死亡重来拦截）
        const _prev = gameState;
        currentLevelIndex = idx;
        const isAvail = _availableLevels.includes(idx);
        const isUnlocked = (idx+1) <= _progress.unlocked;
        // idx=0 例外（因为 fallback 也能用），其它没开发 = 提前打印 blocked 原因
        logStep('level-load', 'loadLevelByIndex-request', {
            idx,
            is_available: isAvail,
            is_unlocked: isUnlocked,
            prev_state: _prev,
            unlocked: _progress.unlocked,
            available_list: _availableLevels.slice(),
            will_blocked_by: (idx !== 0 && !isAvail) ? 'not-developed-JSON' :
                             (!isUnlocked) ? 'not-unlocked' : null
        });
        loadLevelAndStart();
    }

    async function loadLevelData() {
        try {
            const resp = await fetch('../godot_project/levels/level_0.json?v=' + GAME_CODE_VERSION, { cache: 'no-store' });
            if (resp.ok) {
                levelData = await resp.json();
                logStep('level-load', 'loadLevelData-success', {
                    level: 0, ok: resp.ok,
                    platforms_count: levelData.platforms ? levelData.platforms.length : 0,
                    doors_count: levelData.doors ? levelData.doors.length : 0
                });
            }
        } catch(e) { logStep('fatal','loadLevelData-exception', {level:0, err: e.message}); }
        if (!levelData) {
            levelData = {
                id: 0, name: '进门就过关了!',
                spawn: { x: 300, y: 793 },
                platforms: [
                    { x: 960, y: 1090, w: 1920, h: 440, kind: 'ground' },
                    { x: 820, y: 650, w: 330, h: 52, kind: 'step1' },
                    { x: 1390, y: 520, w: 380, h: 52, kind: 'step2' }
                ],
                doors: [{ id: 'goal', x: 1450, y: 389, w: 150, h: 210, is_goal: true }],
                decor: []
            };
            logStep('level-load', 'loadLevelData-fallback', { level: 0, reason: 'no JSON or fetch failed' });
        }
    }
    function loadLevelAndStart() {
        showSuccess = false; successTimer = SUCCESS_TOTAL; doorOpenT = 0; showDead = false;
        _validKnockCount = 0;
        _heldMovingTargets.clear();_mouseMovingTarget=null;_cameraX=0;_cameraY=0;
        _knockEffects = [];
        _passwordVisible = false; _passwordInput = ''; _passwordSolved = false;
        _completeTimer = 0;
        // v19.0 关键：每次进入新关卡，goal-hit状态机必须全部清零！（否则「_goalHitJumped=true」会遗留到下一关，physicsStep阻断命中导致goal-hit不触发！）
        _goalHitStartMs = 0;
        _goalHitJumped = false;
        _goalHitLevelIndex = -1;
        const idx = currentLevelIndex;
        // v4.9.6c 兜底0：当前关没开发+用户也知道要锁 → 不进入 playing，直接回 levelSelect
        const isAvail = _availableLevels.includes(idx);
        if (!isAvail && idx !== 0) {
            logStep('state', 'loadLevelAndStart-blocked-fallback-only', {
                idx, reason: 'JSON不存在=没开发，加载后必然坏关卡，拦截后跳 levelSelect'
            });
            gameState = 'levelSelect';
            return;
        }
        // v4.9.6 紧急修复（死循环根因）：不能用 async！
        //   之前 loadLevelDataByIndex 是 async/await，没 await 就跳过 player 复位
        //   导致死亡"重来"时 player.y 还是死亡时的高空值 → 立刻又死 → 循环
        // 改为：先同步用缓存或fallback，然后同步复位 player。fetch 异步加载。
        if (_cachedLevels[idx]) {
            // 运行关卡必须使用原始缓存的深拷贝；门、箱子等运行时坐标不能反写缓存。
            // 因此点击“重来”会重新获得初始位置，并清除 _moveActivated/_runLift 等临时状态。
            levelData = JSON.parse(JSON.stringify(_cachedLevels[idx]));
        } else {
            // 同步先用 fallback（保证立即生效），然后后台 fetch 更新缓存
            _cachedLevels[idx] = _makeLevelFallback(idx);
            levelData = JSON.parse(JSON.stringify(_cachedLevels[idx]));
            // 后台异步更新缓存（不阻塞）
            _fetchLevelIntoCache(idx);
        }
        // 现在同步设置 player 坐标（100% 生效！）
        player.x = levelData.spawn.x;
        player.y = levelData.spawn.y;
        player.vx = 0; player.vy = 0; player.onGround = false;
        player.jumpsLeft = levelData.double_jump ? 2 : 1;
        resetCratesFromLevel();
        resetKeysFromLevel();
        _questionBlocks = (levelData.question_blocks || []).map(b => ({ ...b, remaining: b.count, revealed: 0 }));
        _flowerBursts = [];
        _passwordDismissUntil = 0;
        // v4.9.6c 坏关卡保护：启动健康计数器（进入 playing 后 30 帧检查）
        _healthGuardFrames = 30;
        gameState = 'playing';
        logStep('state', 'enter-playing', {
            levelIndex: idx,
            hasLevelData: !!levelData,
            px: player.x, py: player.y,
            cacheHit: !!_cachedLevels[idx],
            isJSONAvailable: isAvail,
            healthGuardFrames: _healthGuardFrames
        });
    }

    async function _fetchLevelIntoCache(idx) {
        if (window.__SMART_EGG_LEVELS__ && window.__SMART_EGG_LEVELS__[idx]) {
            _cachedLevels[idx] = window.__SMART_EGG_LEVELS__[idx];
            return;
        }
        try {
            const url = '../godot_project/levels/level_' + idx + '.json?v=' + GAME_CODE_VERSION;
            const t0 = performance.now();
            const resp = await fetch(url, { cache: 'no-store' });
            const ms = Math.round(performance.now() - t0);
            if (resp.ok) {
                const data = await resp.json();
                const plats = data.platforms || [];
                const prevCached = !!_cachedLevels[idx];
                _cachedLevels[idx] = data;
                // v4.9.7a D类：后台异步 fetch 成功更新缓存的日志（覆盖 fallback 的证据链）
                logStep('level-load', '_fetchLevelIntoCache-updated', {
                    idx, status: resp.status, fetch_ms: ms, url,
                    replaced_previous_cache_type: prevCached ? 'previous-cache-existed→real-JSON' : 'no-cache→real-JSON',
                    platforms_count: plats.length,
                    platform_format_center_style: plats.length===0 ? null :
                        ('w' in plats[0] && 'h' in plats[0] && !('x1' in plats[0])),
                    levelName: data.name || null
                });
            } else {
                logStep('level-load', '_fetchLevelIntoCache-missing', {
                    idx, status: resp.status, fetch_ms: ms, url,
                    keep_old_cache: !!_cachedLevels[idx]
                });
            }
        } catch(e) {
            logStep('fatal', '_fetchLevelIntoCache-exception', { idx, err: e.message, stack: String(e.stack||'').slice(0,200) });
        }
    }

    async function loadLevelDataByIndex(idx) {
        // 保留兼容（旧调用方），但内部走缓存逻辑
        logStep('level-load', 'loadLevelDataByIndex-called', { idx, hit_cache_before: !!_cachedLevels[idx] });
        if (!_cachedLevels[idx]) {
            _cachedLevels[idx] = _makeLevelFallback(idx);
            logStep('level-load', 'loadLevelDataByIndex-sync-fallback', { idx, reason: 'cache miss → sync set fallback, then async fetch real JSON' });
            await _fetchLevelIntoCache(idx);
        }
        levelData = _cachedLevels[idx];
    }
    function backToMenu() {
        const from = gameState;
        showSuccess = false; successTimer = SUCCESS_TOTAL; doorOpenT = 0; showDead = false;
        gameState = 'menu';
        logStep('state', 'state-transition', {
            from, to: 'menu', reason: 'backToMenu()', showSuccess_before: false, showDead_before: false
        });
    }
    // v4.9.7a A类：统一状态转换日志（因为 gameState=xxx 散在代码各个角落，封装一个 helper）
    function _transitionTo(to, reason='unknown') {
        const from = gameState;
        if (from === to) return;
        gameState = to;
        logStep('state', 'state-transition', {
            from, to, reason,
            showSuccess: !!showSuccess, showDead: !!showDead,
            currentLevelIndex, levelName: levelData && levelData.name
        });
    }

    let last = performance.now();
    let _prevState = 'menu';
    function _fantasyLine(points,color='#17343a',width=5){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
    function drawFantasyPlatforms(){
        for(let i=0;i<(levelData&&levelData.platforms||[]).length;i++){
            const p=levelData.platforms[i],kind=p.kind||'ground';let x=p.x-p.w/2,w=p.w,y=p.y-p.h/2,h=p.h;if(levelData.infinite_horizontal&&kind==='ground'){x=_cameraX-200;w=W+400;}
            if(kind==='ground'){
                _fantasyLine([[x,y],[x+w,y]],'#17343a',6);_fantasyLine([[x,y+16],[x+w,y+16]],'rgba(23,52,58,.45)',3);
                if(x>1)_fantasyLine([[x,y],[x,y+h]],'#17343a',6);if(x+w<W-1)_fantasyLine([[x+w,y],[x+w,y+h]],'#17343a',6);
                // 稀疏、稳定的世界坐标草丛：间距、位置和高度各不相同，卷屏时不会闪烁。
                const grassCell=310,grassStart=levelData.infinite_horizontal?Math.floor((_cameraX-220)/grassCell):Math.floor((x+45)/grassCell),grassEnd=levelData.infinite_horizontal?Math.ceil((_cameraX+W+220)/grassCell):Math.ceil((x+w-45)/grassCell);
                for(let cell=grassStart;cell<=grassEnd;cell++){
                    if(Math.abs(cell*17+5)%5===1)continue;
                    const gx=cell*grassCell+132+wobbleStatic(18200+cell*19,58),blade=10+wobbleStatic(18400+cell*23,5);
                    if(gx<x+35||gx>x+w-35)continue;
                    _fantasyLine([[gx,y],[gx-4+wobbleStatic(18600+cell,2),y-blade]],'#242422',2.5);
                    if(Math.abs(cell)%3!==1)_fantasyLine([[gx+1,y],[gx+6+wobbleStatic(18800+cell,2),y-blade*.72]],'#242422',2.5);
                }
            }else{
                ctx.save();ctx.strokeStyle='#17343a';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(15,h*.25));ctx.stroke();ctx.strokeStyle='rgba(23,52,58,.48)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+12,y+10);ctx.lineTo(x+w-12,y+10);ctx.moveTo(x+w*.2,y+h*.67);ctx.lineTo(x+w*.42,y+h*.64);ctx.moveTo(x+w*.65,y+h*.7);ctx.lineTo(x+w*.8,y+h*.66);ctx.stroke();ctx.restore();
            }
        }
    }
    function drawFantasyDoors(){
        if(showSuccess&&doorOpenT<1)doorOpenT=Math.min(1,doorOpenT+1/40);else if(!showSuccess)doorOpenT=Math.max(0,doorOpenT-.1);
        for(const d of levelData&&levelData.doors||[]){const w=d.w,h=d.h,x=d.x-w/2,y=d.y-h/2,opening=d.is_goal&&showSuccess?doorOpenT:0;
            ctx.save();ctx.translate(d.x,y);ctx.strokeStyle='#17343a';ctx.lineJoin='round';ctx.lineCap='round';
            // 中式上翘屋檐，只有两条干净轮廓线。
            ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-w*.78,42);ctx.quadraticCurveTo(-w*.7,28,-w*.64,15);ctx.quadraticCurveTo(-w*.32,29,0,16);ctx.quadraticCurveTo(w*.32,29,w*.64,15);ctx.quadraticCurveTo(w*.7,28,w*.78,42);ctx.stroke();
            ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-w*.67,40);ctx.quadraticCurveTo(0,28,w*.67,40);ctx.stroke();
            // 双立柱与门槛。
            ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-w*.55,40);ctx.lineTo(-w*.55,h);ctx.moveTo(-w*.4,43);ctx.lineTo(-w*.4,h);ctx.moveTo(w*.4,43);ctx.lineTo(w*.4,h);ctx.moveTo(w*.55,40);ctx.lineTo(w*.55,h);ctx.moveTo(-w*.68,h);ctx.lineTo(w*.68,h);ctx.stroke();
            // 双开门板随通关动画向中间收拢，保留传统圆门环。
            ctx.save();ctx.scale(Math.max(.04,1-opening),1);ctx.lineWidth=4;ctx.beginPath();ctx.rect(-w*.38,48,w*.76,h-53);ctx.moveTo(0,48);ctx.lineTo(0,h-5);ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.arc(-w*.1,h*.52,8,0,Math.PI*2);ctx.arc(w*.1,h*.52,8,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.restore();
            if(d.hold_to_stop&&d._isRunning&&!_isMovingHeld(d)&&gameState==='playing'){const step=Math.sin(frameCount*.28)*9,fy=y+h+17;_fantasyLine([[d.x-w*.22,y+h],[d.x-w*.22+step,fy],[d.x-w*.22-8+step,fy]],'#17343a',6);_fantasyLine([[d.x+w*.22,y+h],[d.x+w*.22-step,fy],[d.x+w*.22+8-step,fy]],'#17343a',6);}
            if(d.locked&&!unlockedDoors.has(d.id)){ctx.save();ctx.strokeStyle='#17343a';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x-5,y+h*.3);ctx.quadraticCurveTo(d.x,y+h*.48,x+w+5,y+h*.3);ctx.stroke();ctx.beginPath();ctx.roundRect(d.x-24,y+h*.49,48,45,8);ctx.stroke();ctx.restore();}
        }
    }
    function drawFantasyCrates(){for(let i=0;i<crates.length;i++){const c=crates[i],x=c.x-c.w/2,y=c.y-c.h/2;ctx.save();ctx.strokeStyle='#17343a';ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(x,y,c.w,c.h,9);ctx.stroke();ctx.lineWidth=3;ctx.strokeRect(x+13,y+13,c.w-26,c.h-26);_fantasyLine([[x+18,y+18],[x+c.w-18,y+c.h-18]],'#17343a',5);_fantasyLine([[x+c.w-18,y+18],[x+18,y+c.h-18]],'#17343a',5);ctx.restore();}}
    function drawFantasyPlayer(){
        let ax=player.x,ay=player.y,scale=1;if(showSuccess){const e=SUCCESS_TOTAL-successTimer;if(e>=40&&e<100){const t=(e-40)/60,q=t*t;ax=_animStartX+(_animTargetX-_animStartX)*q;ay=_animStartY+(_animTargetY-_animStartY)*q;scale=1-q;}else if(e>=100)return;}
        const air=!player.onGround,walking=player.onGround&&Math.abs(player.vx)>10,rising=air&&player.vy<0,clock=performance.now()*.001,dir=player.vx<0?-1:1,bob=walking?-Math.max(0,Math.sin(player.walkT))*5:0;
        ctx.save();ctx.translate(ax,ay-24+bob);ctx.scale(dir*scale,scale);const lift=air?1:0;
        ctx.strokeStyle='#17343a';ctx.fillStyle='#f2efe6';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=5;
        // 恢复选择 4 号人物之前的圆润双眼忍者，以及放大、静止下垂的双尖披风。
        const moveRatio=Math.min(1,Math.abs(player.vx)/430),capeWave=walking?Math.sin(clock*11)*5.5:(lift?Math.sin(clock*7)*3:0),capeReach=moveRatio*23+lift*11,capeLift=lift*11;
        ctx.fillStyle='#f2efe6';ctx.beginPath();ctx.moveTo(-12,-7);ctx.bezierCurveTo(-21-capeReach*.14,1-capeLift*.25,-30-capeReach*.64,24-capeWave-capeLift*.65,-34-capeReach,61-capeReach*.22-capeLift);ctx.lineTo(-20-capeReach*.44,52-capeReach*.15-capeLift*.72);ctx.lineTo(-9-capeReach*.18,60-capeReach*.1-capeLift*.55);ctx.bezierCurveTo(-7,42-capeLift*.25,-7,12,-12,-7);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.save();ctx.strokeStyle='rgba(23,52,58,.5)';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-17,2);ctx.bezierCurveTo(-22-capeReach*.2,21-capeWave*.2-capeLift*.35,-24-capeReach*.34,38-capeWave*.3-capeLift*.55,-20-capeReach*.2,51-capeLift*.5);ctx.stroke();ctx.restore();
        ctx.fillStyle='#17343a';
        ctx.beginPath();ctx.moveTo(-18,-49);ctx.lineTo(-39,-56);ctx.lineTo(-33,-47);ctx.lineTo(-42,-39);ctx.lineTo(-18,-42);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.ellipse(0,-34,29,30,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.fillStyle='#f2efe6';ctx.beginPath();ctx.roundRect(-19,-44,38,20,10);ctx.fill();
        ctx.fillStyle='#17343a';ctx.beginPath();ctx.ellipse(-7,-34,3.7,4.5,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(7,-34,3.7,4.5,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#f2efe6';ctx.beginPath();ctx.arc(-6,-35.5,1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(8,-35.5,1,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#17343a';
        ctx.fillStyle='#f2efe6';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(-23,-4,46,42,7);ctx.fill();ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-18,-1);ctx.lineTo(18,23);ctx.moveTo(-22,25);ctx.lineTo(22,25);ctx.stroke();
        const arm=Math.sin(player.walkT||0)*6;_fantasyLine([[-22,4],[-38-(walking?arm:0),rising?-16:21]],'#17343a',5);_fantasyLine([[22,4],[38+(walking?arm:0),rising?-16:20]],'#17343a',5);
        const p=Math.sin(player.walkT||0),p2=-p,k1=[-10+p*4,58-Math.max(0,p)*4],f1=[-11+p*11,82-Math.max(0,p)*7],k2=[10+p2*4,58-Math.max(0,p2)*4],f2=[12+p2*11,82-Math.max(0,p2)*7];_fantasyLine([[-11,38],k1,f1],'#17343a',5);_fantasyLine([[11,38],k2,f2],'#17343a',5);_fantasyLine([[f1[0]-2,f1[1]],[f1[0]+6,f1[1]]],'#17343a',4);_fantasyLine([[f2[0]-2,f2[1]],[f2[0]+6,f2[1]]],'#17343a',4);ctx.restore();
    }

    function loop(now) {
        let dt = (now - last) / 1000;
        if (dt > 0.05) dt = 0.05;
        last = now;
        frameCount++;
        if (frameCount % 60 === 0) {
            logStep('snapshot', 'one-second-state', {
                gameState, levelIndex: currentLevelIndex, showSuccess, showDead,
                player: { x: Math.round(player.x), y: Math.round(player.y), vx: Math.round(player.vx), vy: Math.round(player.vy), onGround: player.onGround, jumpsLeft: player.jumpsLeft },
                input: { ...input }, validKnockCount: _validKnockCount,
                audioState: _audioCtx ? _audioCtx.state : 'not-created'
            });
        }

        // ===== v17.0 实时 FPS 平滑计算（debug 面板显示 & dumpLatencyReport 证据）=====
        if (now && _fpsLastFrameMs > 0) {
            const inst = 1000 / Math.max(1, now - _fpsLastFrameMs);   // 瞬时 FPS
            _fpsSmoothed = _fpsSmoothed * 0.92 + inst * 0.08;       // 指数平滑（抗抖动）
        }
        if (now) _fpsLastFrameMs = now;

        if (gameState !== _prevState) {
            logStep('state', 'state-change', {
                from: _prevState, to: gameState, showSuccess, showDead
            });
            _prevState = gameState;
        }

        // 帧钩子（外部自动化测试可通过 __debug.setFrameHandler 注入）
        if (window.__frameHook) {
            try { window.__frameHook(frameCount, gameState, player); } catch(e) {}
        }

        if (gameState === 'playing') {
            try {
                physicsStep(dt);
            } catch(e) {
                logStep('fatal', 'physicsStep-exception', {
                    msg: e.message,
                    stack: String(e.stack || '').substring(0, 200),
                    frame: frameCount
                });
                gameState = 'fatal';
            }
        }
        // ===== v18.0 goal-hit → 真实毫秒级跳（必须写在 successTimer/watchdog/completeIntro OLD流程前面！！goal-hit优先级最高）=====
        //   v17.0 根本 bug（用户直接命中：「倒计时一直不增加，你被骗了」）：
        //   ① v17 goal-hit判断写在 OLD successTimer/watchdog/completeIntro 扣减后面（250ms内，successTimer/watchdog会抢先把gameState变completeIntro/showSuccess=false）
        //   ② physicsStep goal-hit检测分支里没加「已触发不再重复」，showSuccess=true时gameState还是playing，蛋站在门口重叠区→每帧都重置_goalHitStartMs=performance.now()→elapsed永远=0→永远剩250ms
        //   v18.0 修复：a) physicsStep 分支里已经触发过goal-hit就return不再重复设置；b) 这里goal-hit绝对毫秒判断放最前面；c) goal-hit倒计时中，冻结 OLD successTimer/watchdog/completeIntro 全部扣减
        if (_goalHitStartMs > 0 && !_goalHitJumped) {
            const now = performance.now();
            const elapsed = now - _goalHitStartMs;
            if (elapsed >= GOAL_HIT_JUMP_MS) {
                const hist = _latencyHistory[_latencyHistory.length - 1] || null;
                if (hist && hist.jump_ms == null) {
                    hist.jump_ms = now;
                    hist.jump_f = frameCount;
                    hist.delta_ms = elapsed;
                    hist.fps = _fpsSmoothed;
                }
                const idx = _goalHitLevelIndex;
                if (_playingCustom) {
                    logStep('creator','custom-complete',{id:levelData&&levelData.id,elapsed_ms:Math.round(elapsed)});
                    showSuccess=false;showDead=false;gameState='creatorList';_playingCustom=false;
                    _goalHitJumped=true;_goalHitStartMs=0;_goalHitLevelIndex=-1;
                    requestAnimationFrame(loop); return;
                }
                const nxt = idx + 1;
                const overflow  = nxt >= TOTAL_LEVELS;
                const nAvail    = _availableLevels.includes(nxt);
                const nUnlocked = (nxt + 1) <= _progress.unlocked;
                const hasNext   = !overflow && nAvail && nUnlocked;
                if (!_progress.completed.includes(idx)) _progress.completed.push(idx);
                const nextUnlock = Math.min(TOTAL_LEVELS, Math.max(_progress.unlocked, idx + 2));
                _progress.unlocked = nextUnlock;
                saveProgress();
                logStep('state', 'progress-saved', { levelIndex: idx, completed: _progress.completed, unlocked: _progress.unlocked });
                const labelSec = (GOAL_HIT_JUMP_MS / 1000).toFixed(2) + 's';
                if (hasNext) {
                    logStep('state', 'goalHit(' + labelSec + ')→next', {
                        idx, nxt, elapsed_ms: Math.round(elapsed), target_ms: GOAL_HIT_JUMP_MS, fps: Math.round(_fpsSmoothed)
                    });
                    // v19.0 关键：下一关hasNext时也要reset（和 else 分支对称！）—— v18漏了！
                    //   v18 bug：hasNext分支没showSuccess=false → 下一关进门时showSuccess遗留true sT=120显示，大字变绿"已跳转完成"
                    showSuccess = false;
                    showDead = false;
                    gameState = 'playing';
                    currentLevelIndex = nxt;
                    loadLevelByIndex(nxt);
                } else {
                    logStep('state', 'goalHit(' + labelSec + ')→levelSelect', {
                        idx, nxt, overflow, nxt_available: nAvail, nxt_unlocked: nUnlocked,
                        reason: overflow ? '最后一关' : (!nAvail ? '下一关未开发' : '下一关未解锁'),
                        elapsed_ms: Math.round(elapsed), target_ms: GOAL_HIT_JUMP_MS, fps: Math.round(_fpsSmoothed),
                        error_ms: Math.round(elapsed - GOAL_HIT_JUMP_MS)
                    });
                    showSuccess = false;
                    showDead = false;
                    gameState = 'levelSelect';
                }
                _goalHitJumped = true;
                _goalHitStartMs = 0;
                _goalHitLevelIndex = -1;
            }
        }

        // ✅ successTimer 双保险扣减 + 日志（独立于物理，绝对不丢）
        // v18.0：goal-hit倒计时中（_goalHitStartMs>0 && !_goalHitJumped），冻结这段OLD流程，完全不扣减！
        if (!(_goalHitStartMs > 0 && !_goalHitJumped) && showSuccess && successTimer > 0) {
            const S = SUCCESS_TOTAL;
            const shouldTick =
                successTimer === S ||
                successTimer === 100 || successTimer === 80 || successTimer === 60 ||
                successTimer === 40 || successTimer === 20 || successTimer === 1;
            if (shouldTick) {
                logStep('success', 'success-tick', {
                    successTimer,
                    pct: Math.round((1 - successTimer / S) * 100),
                    showSuccess, gameState,
                    doorOpenT: Math.round(doorOpenT * 100) / 100,
                    phase: successTimer >= 80 ? '1(door)' : (successTimer >= 20 ? '2(egg)' : '3(overlay)')
                });
            }
            successTimer--;
            if (successTimer <= 0) {
                logStep('state', 'successTimer-zero', { showSuccess, gameState, successTimer });
                gameState = 'completeIntro';
                showSuccess = false;
                _completeTimer = COMPLETE_INTRO_TOTAL;
                _completeRotAngle = 0;
                // 保存通关进度
                if (!_progress.completed.includes(currentLevelIndex)) {
                    _progress.completed.push(currentLevelIndex);
                }
                const nextUnlock = Math.min(TOTAL_LEVELS, Math.max(_progress.unlocked, currentLevelIndex + 2));
                _progress.unlocked = nextUnlock;
                saveProgress();
                logStep('state', 'progress-saved', { levelIndex: currentLevelIndex, completed: _progress.completed, unlocked: _progress.unlocked });
            }
        }
        // ✅ 兜底保险：showSuccess 超过 SUCCESS_TOTAL×2（240帧=4秒）还没切到 complete，强行切！
        // v18.0：goal-hit倒计时中 → 不触发 watchdog 冻结（避免把goal-hit流程抢走）
        if (!(_goalHitStartMs > 0 && !_goalHitJumped) && showSuccess) {
            _successStuckCounter++;
            if (_successStuckCounter > SUCCESS_TOTAL * 2) {
                logStep('fatal', 'success-watchdog-forced-complete', {
                    stuckCounter: _successStuckCounter,
                    successTimer, showSuccess, gameState
                });
                showSuccess = false;
                showDead = false;
                gameState = 'completeIntro';
                _completeTimer = 90;
                _completeRotAngle = 0;
            }
        } else {
            _successStuckCounter = 0;
        }

        // v4.9.6 completeIntro 阶段：转圈倒计时
        // v18.0：goal-hit倒计时中 → 不触发 completeIntro / complete OLD 流程，完全冻结
        if (!(_goalHitStartMs > 0 && !_goalHitJumped) && _completeTimer > 0) {
            _completeTimer--;
            _completeRotAngle += 0.05;
            if (_completeTimer <= 0) {
                // v4.9.6b：completeIntro 结束 → 显示 complete 3 个按钮（用户可手动点）
                // v11.0 注：如果 goal-hit 倒计时（=1秒）还没跑完，则 completeIntro 不打断它；如果倒计时已经跑完且已经跳走，这里就到不了
                gameState = 'complete';
                logStep('state', 'completeIntro→complete', { currentLevelIndex });
            }
        }
        // ===== v17 goal-hit判断已移到 loop 最开头（L2033-L2082），此处删除避免重复 =====

        // v4.9.6c 兜底健康保护：进入 playing 后 30 帧还在往下掉超过 1100 且没 onGround
        // → 100% 平台格式不匹配 = 坏关卡！立刻冻结物理+跳选关页+打fatal日志（防止死亡循环）
        if (gameState === 'playing' && _healthGuardFrames > 0) {
            _healthGuardFrames--;
            // v4.9.7a H类：health-guard 每 10 帧打一次中间值（排查进入后为什么没拦截）
            if (_healthGuardFrames % 10 === 0 || _healthGuardFrames === 1) {
                logStep('guard', 'health-guard-tick', {
                    frames_left: _healthGuardFrames,
                    py: Math.round(player.y), onGround: player.onGround, vy: Math.round(player.vy),
                    px: Math.round(player.x),
                    trigger_thresh: 1100,
                    levelIndex: currentLevelIndex,
                    will_trigger: (_healthGuardFrames===0) && !player.onGround && player.y>1100
                });
            }
            if (_healthGuardFrames === 0 && !player.onGround && player.y > 1100) {
                // 触发前再附带死亡前 10 帧快照
                const prev10 = _playerRing.slice();
                logStep('fatal', 'health-guard-bad-level-detected', {
                    levelIndex: currentLevelIndex,
                    py: Math.round(player.y), onGround: player.onGround, vy: Math.round(player.vy),
                    platforms_count: levelData ? (levelData.platforms || []).length : 0,
                    platforms_format_ok: levelData && levelData.platforms && levelData.platforms[0] && ('w' in levelData.platforms[0]),
                    spawn_x: levelData && levelData.spawn && levelData.spawn.x,
                    spawn_y: levelData && levelData.spawn && levelData.spawn.y,
                    last_10_frames: prev10,
                    fix: '跳回levelSelect避免死循环'
                });
                showSuccess = false; showDead = false;
                gameState = 'levelSelect';
                // 重置player
                player.vx = 0; player.vy = 0; player.onGround = false;
            }
        }

        try {
            drawGrid();
            if (gameState === 'menu') drawMenu();
            else if (gameState === 'levelSelect') drawLevelSelect();
            else if (gameState === 'creatorList') drawCreatorList();
            else if (gameState === 'creatorEdit') drawCreatorEditor();
            else if (gameState === 'complete' || gameState === 'completeIntro') drawComplete();
            else {
                ctx.save();ctx.translate(-_cameraX,-_cameraY);
                drawFantasyPlatforms();
                drawDecor();
                drawFantasyCrates();
                drawKeys();
                drawFantasyDoors();
                drawQuestionBlocks();
                drawKnockEffects();
                drawFantasyPlayer();
                ctx.restore();
                drawLevelTopBar();
                drawBottomControls();
                drawGameplayMessage();
                drawSuccessOverlay();
                drawDeadOverlay();
                drawPasswordPanel();
            }
            // ✅ 屏幕内 Debug Overlay（左上角，便于一眼看出是否卡在哪一步）
            // 调试开关：URL加 ?debug=1 可见
            if (location.search.includes('debug=1')) {
                ctx.save();
                // v17.0 面板扩到 190px 高 + 480px宽：加2新行（实时FPS + 绝对毫秒倒计时剩余）
                ctx.fillStyle = 'rgba(0,0,0,0.75)';
                ctx.fillRect(8, 8, 480, 190);
                ctx.fillStyle = '#6f6';
                ctx.font = '14px monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText('f=' + frameCount, 20, 16);
                ctx.fillText('FPS=' + Math.round(_fpsSmoothed) + '  代码v' + GAME_CODE_VERSION, 20, 34);
                ctx.fillText('state=' + gameState, 20, 52);
                ctx.fillText('showSuccess=' + showSuccess, 20, 70);
                ctx.fillText('showDead=' + showDead, 20, 88);
                ctx.fillText('sT=' + successTimer + ' / T=' + SUCCESS_TOTAL + ' (pct=' + Math.round((1 - successTimer / SUCCESS_TOTAL) * 100) + '%)', 20, 106);
                ctx.fillText('doorOpenT=' + Math.round(doorOpenT * 100) / 100 + '  sStuck=' + _successStuckCounter, 20, 124);
                ctx.fillText('phase: ' + (showSuccess ? (successTimer >= 80 ? '1(door open)' : (successTimer >= 20 ? '2(egg in)' : '3(overlay)')) : 'none'), 20, 142);
                // v17.0：真实毫秒级 goal-hit 倒计时可视化（三态显示，不用开console）
                if (_goalHitStartMs > 0 && !_goalHitJumped) {
                    const now2 = performance.now();
                    const elapsed2 = now2 - _goalHitStartMs;
                    const pct2 = Math.min(100, Math.max(0, (elapsed2 / GOAL_HIT_JUMP_MS) * 100));
                    ctx.fillStyle = '#ff6';
                    ctx.fillText('⏱️ 剩余: ' + Math.max(0, GOAL_HIT_JUMP_MS - Math.round(elapsed2)) + 'ms / 目标' + GOAL_HIT_JUMP_MS + 'ms (' + Math.round(pct2) + '%)', 20, 160);
                    if (pct2 < 100) {
                        ctx.fillStyle = 'rgba(255,255,102,0.25)';
                        ctx.fillRect(20, 175, 440 * (pct2/100), 8);
                    }
                } else if (_goalHitJumped) {
                    ctx.fillStyle = '#6f6';
                    ctx.fillText('✅ 已跳转完成（_goalHitJumped=true，下次通关自动复位）', 20, 160);
                } else {
                    ctx.fillStyle = '#bbb';
                    ctx.fillText('⏱️ 未触发（进门玩触发，或 Console 调 window.__debug.simulateGoalHit()）', 20, 160);
                }
                ctx.restore();
            }
            // ===== v14.0 自动测试模式警告条（任何状态都画，让用户一眼知道为什么没按蛋也动）=====
            if (IS_AUTOTEST_MODE) {
                ctx.save();
                ctx.globalAlpha = 0.92;
                ctx.fillStyle = '#d73027';   // 红色底（醒目，避免用户困惑）
                const bannerH = 52;
                const textW = 860;   // 宽度够长，能塞下「删除 URL 的 ?autotest 参数即可手动操作」
                const bx = (W - textW) / 2;
                const by = 16;
                // 圆角背景（跟按钮风格一致，手绘感）
                ctx.beginPath();
                const radius = 14;
                ctx.moveTo(bx + radius, by);
                ctx.lineTo(bx + textW - radius, by);
                ctx.quadraticCurveTo(bx + textW, by, bx + textW, by + radius);
                ctx.lineTo(bx + textW, by + bannerH - radius);
                ctx.quadraticCurveTo(bx + textW, by + bannerH, bx + textW - radius, by + bannerH);
                ctx.lineTo(bx + radius, by + bannerH);
                ctx.quadraticCurveTo(bx, by + bannerH, bx, by + bannerH - radius);
                ctx.lineTo(bx, by + radius);
                ctx.quadraticCurveTo(bx, by, bx + radius, by);
                ctx.closePath();
                ctx.fillStyle = 'rgba(215,48,39,0.95)';
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#17343a';
                ctx.stroke();
                // 文字：两行 白字 居中
                ctx.fillStyle = '#fff0bd';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 22px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
                ctx.fillText('🔴 自动测试模式运行中（蛋会自己走/跳，不是你没按！）', W / 2, by + 20);
                ctx.font = 'bold 18px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
                ctx.fillText('→ 删除 URL 地址栏里的 ?autotest 即可手动操作', W / 2, by + 40);
                ctx.restore();
            }
            // ===== v15.0 右上角代码版本号显示（一眼看出是不是新代码，不用猜缓存）=====
            try {
                ctx.save();
                // 小灰色圆角矩形背景（右上角：离右/上边距各 16px，宽 ~120，高 32）
                const vbx = W - 16 - 120;
                const vby = 16;
                const vbw = 120, vbh = 32, vr = 10;
                ctx.beginPath();
                ctx.moveTo(vbx + vr, vby);
                ctx.lineTo(vbx + vbw - vr, vby);
                ctx.quadraticCurveTo(vbx + vbw, vby, vbx + vbw, vby + vr);
                ctx.lineTo(vbx + vbw, vby + vbh - vr);
                ctx.quadraticCurveTo(vbx + vbw, vby + vbh, vbx + vbw - vr, vby + vbh);
                ctx.lineTo(vbx + vr, vby + vbh);
                ctx.quadraticCurveTo(vbx, vby + vbh, vbx, vby + vbh - vr);
                ctx.lineTo(vbx, vby + vr);
                ctx.quadraticCurveTo(vbx, vby, vbx + vr, vby);
                ctx.closePath();
                ctx.globalAlpha = 0.75;
                ctx.fillStyle = '#17343a';
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#bbb';
                ctx.stroke();
                // 白字：代码 vXXX
                ctx.fillStyle = '#fff0bd';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 14px system-ui, "PingFang SC", sans-serif';
                ctx.fillText('忍者 M3.6', vbx + vbw / 2, vby + vbh / 2);
                ctx.restore();
            } catch(_vErr) { /* 不影响玩 */ }
            // ===== v17.0 debug=1：顶部大字彩色「通关状态机」标签（用户不看console也知道当前阶段）=====
            if (location.search.includes('debug=1')) {
                try {
                    ctx.save();
                    let bannerText = '';
                    let color = '#888';
                    if (_goalHitStartMs > 0 && !_goalHitJumped) {
                        const remain = Math.max(0, GOAL_HIT_JUMP_MS - Math.round(performance.now() - _goalHitStartMs));
                        bannerText = '🟡 GOAL HIT 倒计时中（剩余 ' + remain + 'ms）';
                        color = '#f7b500';
                    } else if (_goalHitJumped) {
                        bannerText = '✅ 通关跳转已完成（回选关页）';
                        color = '#2ecc71';
                    } else if (showSuccess) {
                        bannerText = '🟠 showSuccess=true，但 goalHit 未触发！（异常）';
                        color = '#e67e22';
                    } else {
                        bannerText = '⚪ 未触发（玩进门触发，或 Console: __debug.simulateGoalHit()）';
                        color = '#bbbbbb';
                    }
                    ctx.globalAlpha = 0.92;
                    ctx.fillStyle = '#17343a';
                    ctx.fillRect(W/2 - 360, 92, 720, 56);
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = color;
                    ctx.strokeRect(W/2 - 360, 92, 720, 56);
                    ctx.fillStyle = color;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = 'bold 24px system-ui, "PingFang SC", sans-serif';
                    ctx.fillText(bannerText, W/2, 120);
                    ctx.restore();
                } catch(_smErr) { /* 不影响玩 */ }
            }
            // ===== v17.0 debug=1：屏幕右下角「实时日志面板」（显示最近 12 条，不用开 Console 就能看）=====
            if (location.search.includes('debug=1')) {
                try {
                    ctx.save();
                    const logs = (window.__gameLogs || []).slice();
                    const recent = logs.slice(-12);
                    const panelW = 760, panelH = 320, px = W - panelW - 16, py = H - panelH - 16;
                    ctx.globalAlpha = 0.92;
                    ctx.fillStyle = 'rgba(10,10,10,0.92)';
                    ctx.fillRect(px, py, panelW, panelH);
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#555';
                    ctx.strokeRect(px, py, panelW, panelH);
                    // 标题：
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = '#6cf';
                    ctx.font = 'bold 16px system-ui, monospace';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText('📜 最近12条日志（共' + logs.length + '条。Console: __debug.dumpLatencyReport() 看通关报告）', px + 14, py + 10);
                    ctx.fillStyle = '#ddd';
                    ctx.font = '12px Menlo, Consolas, monospace';
                    for (let i = 0; i < recent.length; i++) {
                        const l = recent[i];
                        const line =
                            'f=' + String(l.f).padStart(5, ' ') +
                            '  | ' + String(l.tag || '').padEnd(28, ' ').slice(0, 28) +
                            '  | ' + (l.msg || '') +
                            (l.kv ? ('  KV=' + JSON.stringify(l.kv).replace(/"/g,'').slice(0,90)) : '');
                        ctx.fillText(line, px + 10, py + 34 + i * 22);
                    }
                    ctx.restore();
                } catch(_lErr) { /* 不影响玩 */ }
            }
        } catch(e) {
            logStep('fatal', 'draw-exception', {
                msg: e.message,
                stack: String(e.stack || '').substring(0, 200),
                frame: frameCount
            });
        }

        requestAnimationFrame(loop);
    }

    (async function main() {
        resize();
        logStep('lifecycle', 'session-start', _runtimeSnapshot());
        // v4.9.6 启动时探测所有可用关卡
        await probeAvailableLevels();
        // 预加载第 0 关数据（菜单页背景用不到，只是启动热身）
        await loadLevelData();
        // 开发模式：URL带 ?autotest 时自动跑通关流程并输出日志
        if (location.search.includes('autotest')) {
            logStep('debug', 'autotest-start', {});
            setTimeout(() => {
                loadLevelByIndex(0);
                gameState = 'playing';   // autotest强制转playing（避免 loadLevel 异步未完成就卡住）
                logStep('debug', 'autotest-level-loaded', { state: gameState, px: player.x, levelIndex: currentLevelIndex });
                const timer = setInterval(() => {
                    if (gameState === 'playing' && player) {
                        player.x += 5;
                        if (player.onGround) player.vy = -600;
                    }
                    if (gameState === 'complete') {
                        logStep('debug', 'autotest-reached-complete', { px: player ? player.x : 0, levelIndex: currentLevelIndex });
                        clearInterval(timer);
                    }
                }, 16);
            }, 800);
        }
        requestAnimationFrame(loop);
    })();
})();
