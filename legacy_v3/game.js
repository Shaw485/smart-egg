(() => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    const W = 360, H = 640;
    let gameState = 'menu';
    let currentLevel = 0;
    let showSuccess = false;
    let successTimer = 0;
    let frameCount = 0;
    let dpr = window.devicePixelRatio || 1;

    function resizeCanvas() {
        const ww = window.innerWidth;
        const wh = window.innerHeight;
        const baseRatio = W / H;
        const windowRatio = ww / wh;
        let cw, ch;
        if (windowRatio > baseRatio) {
            ch = wh;
            cw = ch * baseRatio;
        } else {
            cw = ww;
            ch = cw / baseRatio;
        }
        canvas.style.width = cw + 'px';
        canvas.style.height = ch + 'px';
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function wobble(seed, amp = 1.2) {
        return (Math.sin(seed * 12.9898 + frameCount * 0.03) * 43758.5453 % 1) * amp - amp / 2;
    }

    function sketchLine(x1, y1, x2, y2, w = 2, seed = 1) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const steps = Math.max(6, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 8));
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t + wobble(seed + i * 0.3, 1.5);
            const y = y1 + (y2 - y1) * t + wobble(seed + i * 0.5 + 100, 1.5);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    function sketchCircle(cx, cy, r, w = 2, seed = 1, fill = null) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        const steps = 40;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            const rr = r + wobble(seed + i * 0.2, 1.2);
            const x = cx + Math.cos(t) * rr;
            const y = cy + Math.sin(t) * rr;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        if (fill !== null) { ctx.fillStyle = fill; ctx.fill(); }
        ctx.stroke();
    }

    function sketchEllipse(cx, cy, rx, ry, w = 2, seed = 1, fill = null) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        const steps = 40;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            const rrx = rx + wobble(seed + i * 0.2, 1.0);
            const rry = ry + wobble(seed + i * 0.3 + 50, 1.0);
            const x = cx + Math.cos(t) * rrx;
            const y = cy + Math.sin(t) * rry;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        if (fill !== null) { ctx.fillStyle = fill; ctx.fill(); }
        ctx.stroke();
    }

    function sketchRect(x, y, w, h, lw = 2, seed = 1, fill = null) {
        if (fill !== null) {
            ctx.fillStyle = fill;
            ctx.beginPath();
            const s = seed;
            ctx.moveTo(x + wobble(s, 1), y + wobble(s + 1, 1));
            ctx.lineTo(x + w + wobble(s + 2, 1), y + wobble(s + 3, 1));
            ctx.lineTo(x + w + wobble(s + 4, 1), y + h + wobble(s + 5, 1));
            ctx.lineTo(x + wobble(s + 6, 1), y + h + wobble(s + 7, 1));
            ctx.closePath();
            ctx.fill();
        }
        sketchLine(x, y, x + w, y, lw, seed);
        sketchLine(x + w, y, x + w, y + h, lw, seed + 1);
        sketchLine(x + w, y + h, x, y + h, lw, seed + 2);
        sketchLine(x, y + h, x, y, lw, seed + 3);
    }

    function sketchRoundedRect(x, y, w, h, r, lw = 2, seed = 1, fill = null) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        if (fill !== null) { ctx.fillStyle = fill; ctx.fill(); }
        ctx.stroke();
    }

    function _roundedPath(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function stickerRect(x, y, w, h, r, shadow = 5, lw = 3.5, fill = '#ffffff', shadowColor = '#000000') {
        ctx.save();
        ctx.fillStyle = shadowColor;
        _roundedPath(x + shadow, y + shadow, w, h, r);
        ctx.fill();
        ctx.fillStyle = fill;
        _roundedPath(x, y, w, h, r);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        _roundedPath(x, y, w, h, r);
        ctx.stroke();
        ctx.restore();
    }

    function stickerCircle(cx, cy, r, shadow = 4, lw = 3.5, fill = '#ffffff') {
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx + shadow, cy + shadow, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function shadowText(text, x, y, size, align = 'center', shadow = 4) {
        sketchText(text, x + shadow, y + shadow, size, align, true, '#000000');
        sketchText(text, x, y, size, align, true, '#000000');
    }

    function sketchText(text, x, y, size = 24, align = 'center', bold = false, color = '#000') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(wobble(x + y, 0.012));
        ctx.translate(wobble(x * 0.01, 0.5), wobble(y * 0.01 + 10, 0.5));
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        const weight = bold ? '800 ' : '600 ';
        ctx.font = `${weight}${size}px -apple-system, "PingFang SC", "Helvetica Neue", sans-serif`;
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    function drawGridBackground() {
        ctx.fillStyle = '#FCFCFC';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 1;
        const step = 32;
        ctx.beginPath();
        for (let x = 0; x <= W; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
        }
        for (let y = 0; y <= H; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
        }
        ctx.stroke();
    }

    function drawStatusBar() {
        sketchText('20:38', 28, 22, 15, 'left', true);
        const sigX = W - 100;
        for (let i = 0; i < 4; i++) {
            const bh = 3 + i * 2.4;
            ctx.fillStyle = '#000';
            const rx = sigX + i * 4.8;
            const ry = 22;
            ctx.fillRect(rx, ry - bh, 3, bh);
        }
        const wx = sigX + 24;
        ctx.fillStyle = '#000';
        const cx = wx + 6, cy = 18;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, Math.PI * 1.2, Math.PI * 1.8);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 5, Math.PI * 1.25, Math.PI * 1.75);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 2.2, Math.PI * 1.3, Math.PI * 1.7);
        ctx.stroke();
        ctx.fillRect(cx - 1.2, cy + 3.5, 2.4, 2.4);
        const bx = sigX + 46;
        _roundedPath(bx, 14, 24, 13, 3.5);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.fillRect(bx + 24, 18, 2.5, 5);
        _roundedPath(bx + 2, 15.5, 20, 10, 2.5);
        ctx.fillStyle = '#FCFCFC';
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(bx + 4, 17, 12, 7);
    }

    let unlockedLevels = 2;

    function drawTopBar_Level(idx, title) {
        stickerRect(16, 38, 96, 42, 18, 5, 3.5);
        sketchText('第 ' + (idx + 1) + ' 关', 64, 59, 16, 'center', true);

        shadowText(title, W / 2, 105, 42);

        const by = 48, br = 19, gap = 12;
        const xs = [W - 16 - br * 2 - gap * 2, W - 16 - br * 2 - gap, W - 16 - br * 2];
        stickerCircle(xs[0] + br, by, br, 4, 3.5);
        sketchText('?', xs[0] + br, by + 1, 20, 'center', true);
        stickerCircle(xs[1] + br, by, br, 4, 3.5);
        sketchText('↻', xs[1] + br, by + 1, 22, 'center', true);
        stickerCircle(xs[2] + br, by, br, 4, 3.5);
        ctx.fillStyle = '#000';
        ctx.fillRect(xs[2] + br - 7, by - 6, 3, 12);
        ctx.fillRect(xs[2] + br + 4, by - 6, 3, 12);

        topBar_hintBtn = { cx: xs[0] + br, cy: by, r: br };
        topBar_restartBtn = { cx: xs[1] + br, cy: by, r: br };
        topBar_pauseBtn = { cx: xs[2] + br, cy: by, r: br };
    }
    let topBar_hintBtn = null, topBar_restartBtn = null, topBar_pauseBtn = null;

    function drawBottomControls() {
        const by = H - 94, sz = 60;
        const col1 = 28, col2 = col1 + sz + 14;
        const col3 = W - 28 - sz;
        const r = 14;
        stickerRect(col1, by, sz, sz, r, 4, 3.5, '#000000');
        stickerRect(col2, by, sz, sz, r, 4, 3.5, '#000000');
        stickerRect(col3, by, sz, sz, r, 4, 3.5, '#000000');
        ctx.fillStyle = '#fff';
        ctx.font = '800 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◀', col1 + sz / 2, by + sz / 2 + 1);
        ctx.fillText('▶', col2 + sz / 2, by + sz / 2 + 1);
        ctx.fillText('▲', col3 + sz / 2, by + sz / 2);

        ctrl_left = { x: col1, y: by, w: sz, h: sz };
        ctrl_right = { x: col2, y: by, w: sz, h: sz };
        ctrl_action = { x: col3, y: by, w: sz, h: sz };
    }
    let ctrl_left = null, ctrl_right = null, ctrl_action = null;

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        let cx, cy;
        if (e.touches && e.touches.length > 0) {
            cx = e.touches[0].clientX;
            cy = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            cx = e.changedTouches[0].clientX;
            cy = e.changedTouches[0].clientY;
        } else {
            cx = e.clientX;
            cy = e.clientY;
        }
        return {
            x: (cx - rect.left) * (W / rect.width),
            y: (cy - rect.top) * (H / rect.height)
        };
    }

    function inRect(px, py, x, y, w, h) {
        return px >= x && px <= x + w && py >= y && py <= y + h;
    }

    function inCircle(px, py, cx, cy, r) {
        return Math.hypot(px - cx, py - cy) <= r;
    }

    function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
        const ox = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
        const oy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
        return (ox * oy) / (aw * ah);
    }

    const toast = { text: '', timer: 0 };
    function showToast(text, duration = 80) {
        toast.text = text;
        toast.timer = duration;
    }

    function triggerSuccess() {
        showSuccess = true;
        successTimer = 120;
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    }

    function drawSuccessOverlay() {
        if (!showSuccess) return;
        const a = Math.min(1, (120 - successTimer) / 30);
        ctx.save();
        ctx.globalAlpha = a;
        stickerRect(W / 2 - 135, H / 2 - 100, 270, 200, 26, 8, 3.5);
        sketchText('大聪明！', W / 2, H / 2 - 35, 34, 'center', true);
        sketchText('脑洞 +1', W / 2, H / 2 + 15, 24);
        const p = 1 - (successTimer / 120);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2 + 60, 20, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function drawToast() {
        if (toast.timer <= 0) return;
        const a = Math.min(1, toast.timer / 20);
        ctx.save();
        ctx.globalAlpha = a;
        stickerRect(W / 2 - 122, H - 170, 244, 48, 16, 5, 3);
        sketchText(toast.text, W / 2, H - 146, 14);
        ctx.restore();
        toast.timer--;
    }

    function drawDoodleEgg(cx, cy, rx, ry, mood) {
        sketchEllipse(cx, cy, rx, ry, 3, 600, '#ffffff');
        if (mood === 'sleep') {
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(cx - rx * 0.33, cy - ry * 0.1, 3, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + rx * 0.33, cy - ry * 0.1, 3, Math.PI, 0); ctx.fill();
            sketchText('Z', cx + rx * 0.75, cy - ry * 0.55, 18);
            sketchText('z', cx + rx * 1.05, cy - ry * 0.8 + Math.sin(frameCount * 0.08) * 4, 13);
        } else if (mood === 'happy') {
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(cx - rx * 0.35, cy - ry * 0.15, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + rx * 0.35, cy - ry * 0.15, 4, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(cx, cy + ry * 0.15, 12, 0, Math.PI);
            ctx.stroke();
        } else if (mood === 'smile') {
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(cx - rx * 0.35, cy - ry * 0.1, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + rx * 0.35, cy - ry * 0.1, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy + ry * 0.2, 9, 0, Math.PI);
            ctx.stroke();
        }
    }

    const level1 = {
        name: '放鸭子',
        init() {
            this.pond = { x: 48, y: 420, w: 264, h: 100 };
            this.duck = { x: 180, y: 275, r: 30 };
            this.jia = { x: 50, y: 180, w: 78, h: 88 };
            this.bird = { x: 150, y: 180, w: 78, h: 88, dragging: false, originX: 150, originY: 180 };
            this.dragOffset = { x: 0, y: 0 };
            this.duckAnim = 0;
            this.solved = false;
        },
        draw() {
            drawStatusBar();
            drawTopBar_Level(0, this.name);

            const p = this.pond;
            sketchEllipse(p.x + p.w / 2, p.y + p.h / 2 + 8, p.w / 2, p.h / 2, 2.5, 610, '#ffffff');
            sketchEllipse(p.x + p.w / 2, p.y + p.h / 2, p.w / 2 - 12, p.h / 2 - 10, 2, 612, '#ffffff');
            for (let i = 0; i < 3; i++) {
                const wy = p.y + 26 + i * 18;
                const phase = frameCount * 0.05 + i;
                ctx.beginPath();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1.5;
                for (let x = 0; x < 50; x++) {
                    const px = p.x + 35 + x * 3.5;
                    const py = wy + Math.sin(x * 0.3 + phase) * 3;
                    if (x === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
            }

            const duckY = this.duck.y + (this.solved ? this.duckAnim : 0);
            const d = this.duck;
            sketchEllipse(d.x, duckY, d.r, d.r * 0.8, 2.5, 620, '#ffffff');
            sketchCircle(d.x + d.r * 0.65, duckY - d.r * 0.55, d.r * 0.42, 2.5, 630, '#ffffff');
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(d.x + d.r * 0.8, duckY - d.r * 0.6, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.moveTo(d.x + d.r * 0.98, duckY - d.r * 0.5);
            ctx.lineTo(d.x + d.r * 1.28, duckY - d.r * 0.42);
            ctx.lineTo(d.x + d.r * 0.98, duckY - d.r * 0.32);
            ctx.closePath();
            ctx.fill();
            sketchLine(d.x - d.r * 0.55, duckY + d.r * 0.6, d.x - d.r * 0.85, duckY + d.r * 0.92, 2, 640);
            sketchLine(d.x + d.r * 0.2, duckY + d.r * 0.6, d.x + d.r * 0.1, duckY + d.r * 0.92, 2, 641);

            const j = this.jia;
            sketchRect(j.x, j.y, j.w, j.h, 2.5, 650, '#ffffff');
            sketchText('甲', j.x + j.w / 2, j.y + j.h / 2 + 1, 48, 'center', true);

            const b = this.bird;
            ctx.save();
            if (b.dragging) {
                const s = 1 + Math.sin(frameCount * 0.2) * 0.025;
                ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
                ctx.scale(s, s);
                ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
            }
            sketchRect(b.x, b.y, b.w, b.h, 2.5, 660, '#ffffff');
            sketchText('鸟', b.x + b.w / 2, b.y + b.h / 2 + 1, 48, 'center', true);
            ctx.restore();

            drawBottomControls();
        },
        update() {
            if (this.solved) {
                this.duckAnim = Math.min(115, this.duckAnim + 2);
            }
        },
        onDown(pos) {
            if (inCircle(pos.x, pos.y, topBar_restartBtn.cx, topBar_restartBtn.cy, topBar_restartBtn.r)) {
                this.init(); return;
            }
            if (inCircle(pos.x, pos.y, topBar_hintBtn.cx, topBar_hintBtn.cy, topBar_hintBtn.r)) {
                showToast('试试拖动那个字？'); return;
            }
            const b = this.bird;
            if (inRect(pos.x, pos.y, b.x, b.y, b.w, b.h)) {
                b.dragging = true;
                this.dragOffset.x = pos.x - b.x;
                this.dragOffset.y = pos.y - b.y;
            } else if (inRect(pos.x, pos.y, this.duck.x - 30, this.duck.y - 30, 60, 60)) {
                showToast('鸭子太重啦，试试别的？');
            }
        },
        onMove(pos) {
            const b = this.bird;
            if (b.dragging) {
                b.x = pos.x - this.dragOffset.x;
                b.y = pos.y - this.dragOffset.y;
            }
        },
        onUp(pos) {
            const b = this.bird;
            if (b.dragging) {
                b.dragging = false;
                const ov = overlap(b.x, b.y, b.w, b.h, this.pond.x, this.pond.y, this.pond.w, this.pond.h);
                if (ov >= 0.4 && !this.solved) {
                    this.solved = true;
                    b.x = this.pond.x + this.pond.w / 2 - b.w / 2;
                    b.y = this.pond.y + 15;
                    triggerSuccess();
                    setTimeout(() => { gameState = 'between'; showSuccess = false; }, 2200);
                } else if (ov > 0) {
                    showToast('还差一点！再往池塘里放放');
                    b.x = b.originX; b.y = b.originY;
                } else {
                    b.x = b.originX; b.y = b.originY;
                }
            }
        }
    };

    const level2 = {
        name: '赶牛上山',
        init() {
            this.mountain = { x: 50, y: 370, w: 260, h: 160 };
            this.cow = { x: 195, y: 270, r: 44 };
            this.shan = { x: 46, y: 170, w: 86, h: 100, rot: 0, dragging: false };
            this.solved = false;
            this.cowAnim = 0;
        },
        draw() {
            drawStatusBar();
            drawTopBar_Level(1, this.name);

            const m = this.mountain;
            const baseY = m.y + m.h;
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(m.x + wobble(700, 1), baseY + wobble(701, 1));
            ctx.lineTo(m.x + m.w * 0.28 + wobble(702, 1), m.y + m.h * 0.45 + wobble(703, 1));
            ctx.lineTo(m.x + m.w * 0.5 + wobble(704, 1), m.y + wobble(705, 1));
            ctx.lineTo(m.x + m.w * 0.72 + wobble(706, 1), m.y + m.h * 0.52 + wobble(707, 1));
            ctx.lineTo(m.x + m.w + wobble(708, 1), baseY + wobble(709, 1));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            sketchLine(m.x + m.w * 0.4, m.y + m.h * 0.55, m.x + m.w * 0.32, m.y + m.h * 0.82, 1.5, 710);
            sketchLine(m.x + m.w * 0.5, m.y + m.h * 0.28, m.x + m.w * 0.46, m.y + m.h * 0.5, 1.5, 711);
            sketchLine(m.x + m.w * 0.6, m.y + m.h * 0.5, m.x + m.w * 0.66, m.y + m.h * 0.75, 1.5, 712);

            const cow = this.cow;
            const t = Math.min(1, this.cowAnim / 100);
            const cY = cow.y + ((m.y + 25) - cow.y) * t;
            const cX = cow.x + ((m.x + m.w * 0.5) - cow.x) * t;
            sketchEllipse(cX, cY, cow.r, cow.r * 0.78, 2.5, 720, '#ffffff');
            sketchEllipse(cX + cow.r * 0.72, cY - cow.r * 0.52, cow.r * 0.44, cow.r * 0.38, 2.5, 730, '#ffffff');
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(cX + cow.r * 0.88, cY - cow.r * 0.55, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cX + cow.r * 0.6, cY - cow.r * 0.55, 3, 0, Math.PI * 2); ctx.fill();
            sketchEllipse(cX + cow.r * 0.72, cY - cow.r * 0.22, cow.r * 0.2, cow.r * 0.1, 1.5, 740);
            if (!this.solved) {
                sketchLine(cX + cow.r * 0.5, cY - cow.r * 0.82, cX + cow.r * 0.36, cY - cow.r * 1.1, 2.5, 741);
                sketchLine(cX + cow.r * 0.86, cY - cow.r * 0.82, cX + cow.r, cY - cow.r * 1.1, 2.5, 742);
            }

            const s = this.shan;
            const ccx = s.x + s.w / 2, ccy = s.y + s.h / 2;
            ctx.save();
            ctx.translate(ccx, ccy);
            ctx.rotate(s.rot * Math.PI / 180);
            if (s.dragging) {
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = '#888';
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(s.w, s.h) * 0.72, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            sketchRect(-s.w / 2, -s.h / 2, s.w, s.h, 2.5, 750, '#ffffff');
            sketchText('山', 0, 1, 54, 'center', true);
            ctx.restore();

            if (!this.solved && Math.abs(s.rot) > 12) {
                sketchText('已旋转 ' + Math.round(((s.rot % 360) + 360) % 360) + '°', W / 2, 340, 14);
            }
            drawBottomControls();
        },
        update() {
            if (this.solved) {
                this.cowAnim = Math.min(100, this.cowAnim + 1.5);
            }
        },
        lastAngle: 0,
        getAngle(x, y, cx, cy) {
            return Math.atan2(y - cy, x - cx) * 180 / Math.PI;
        },
        onDown(pos) {
            if (inCircle(pos.x, pos.y, topBar_restartBtn.cx, topBar_restartBtn.cy, topBar_restartBtn.r)) {
                this.init(); return;
            }
            if (inCircle(pos.x, pos.y, topBar_hintBtn.cx, topBar_hintBtn.cy, topBar_hintBtn.r)) {
                showToast('试试旋转那个「山」字？'); return;
            }
            const s = this.shan;
            const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
            const hitR = Math.max(s.w, s.h) * 0.7;
            if (Math.hypot(pos.x - cx, pos.y - cy) <= hitR) {
                s.dragging = true;
                this.lastAngle = this.getAngle(pos.x, pos.y, cx, cy);
            } else if (inRect(pos.x, pos.y, this.cow.x - 40, this.cow.y - 40, 80, 80)) {
                showToast('牛太重了！让山动一动？');
            }
        },
        onMove(pos) {
            const s = this.shan;
            if (s.dragging) {
                const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
                const ang = this.getAngle(pos.x, pos.y, cx, cy);
                s.rot += ang - this.lastAngle;
                this.lastAngle = ang;
            }
        },
        onUp(pos) {
            const s = this.shan;
            if (s.dragging) {
                s.dragging = false;
                const normalized = ((s.rot % 360) + 360) % 360;
                const hit = (normalized >= 80 && normalized <= 100) || (normalized >= 260 && normalized <= 280);
                if (hit && !this.solved) {
                    this.solved = true;
                    s.rot = 90;
                    triggerSuccess();
                    setTimeout(() => { gameState = 'between'; showSuccess = false; }, 2200);
                } else if (Math.abs(s.rot) > 40) {
                    showToast('方向不对，再转一转～');
                }
            }
        }
    };

    const level3 = {
        name: '叫醒蛋蛋',
        init() {
            this.egg = { x: W / 2, y: 355, rx: 55, ry: 70 };
            this.pillow = { x: W / 2, y: 455, w: 220, h: 50 };
            this.pressing = false;
            this.pressProgress = 0;
            this.shake = 0;
            this.solved = false;
            this.crackAnim = 0;
        },
        draw() {
            drawStatusBar();
            drawTopBar_Level(2, this.name);

            const pl = this.pillow;
            sketchEllipse(pl.x, pl.y, pl.w / 2, pl.h / 2, 2.5, 800, '#ffffff');
            sketchLine(pl.x - pl.w / 2 + 22, pl.y, pl.x + pl.w / 2 - 22, pl.y, 1.5, 801);

            const e = this.egg;
            let sx = 0, sy = 0;
            if (this.shake > 0) {
                sx = Math.sin(frameCount * 0.8) * this.shake;
                sy = Math.cos(frameCount * 0.9) * this.shake * 0.6;
            }
            const eggX = e.x + sx;
            const eggY = e.y + sy - this.crackAnim * 1.2;
            sketchEllipse(eggX, eggY, e.rx, e.ry, 3, 810, '#ffffff');

            if (!this.solved) {
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(eggX - 16, eggY - 12, 3.5, Math.PI, 0); ctx.fill();
                ctx.beginPath(); ctx.arc(eggX + 16, eggY - 12, 3.5, Math.PI, 0); ctx.fill();
                sketchText('Zzz', eggX + 48, eggY - 44, 20);
                sketchText('z', eggX + 70, eggY - 62 + Math.sin(frameCount * 0.08) * 4, 14);
            } else {
                const cp = Math.min(1, this.crackAnim / 60);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(eggX - 22, eggY - 38);
                ctx.lineTo(eggX - 10, eggY - 18);
                ctx.lineTo(eggX, eggY - 33);
                ctx.lineTo(eggX + 10, eggY - 13);
                ctx.lineTo(eggX + 22, eggY - 28);
                ctx.stroke();
                if (cp > 0.5) {
                    const by = eggY - 48 - (cp - 0.5) * 52;
                    sketchEllipse(eggX, by, 26, 18, 2.5, 830, '#ffffff');
                    ctx.fillStyle = '#000';
                    ctx.beginPath(); ctx.arc(eggX - 8, by - 1, 2.5, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(eggX + 8, by - 1, 2.5, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(eggX, by + 6, 6, 0, Math.PI);
                    ctx.stroke();
                }
            }

            const barX = 58, barY = 540, barW = 244, barH = 22;
            sketchRoundedRect(barX, barY, barW, barH, 8, 2, 840, '#ffffff');
            const fillW = Math.max(0, Math.min(1, this.pressProgress / 3)) * (barW - 6);
            ctx.fillStyle = '#000';
            const rx = barX + 3, ry = barY + 3, rw = fillW, rh = barH - 6, rr = 5;
            ctx.beginPath();
            ctx.moveTo(rx + rr, ry);
            ctx.lineTo(rx + rw - rr, ry);
            ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
            ctx.lineTo(rx + rw, ry + rh - rr);
            ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
            ctx.lineTo(rx + rr, ry + rh);
            ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
            ctx.lineTo(rx, ry + rr);
            ctx.quadraticCurveTo(rx, ry, rx + rr, ry);
            ctx.closePath();
            ctx.fill();
            sketchText('长按震动', W / 2, 580, 14);
            if (this.pressing) sketchText('继续按住…', W / 2, 518, 14);

            drawBottomControls();
        },
        update() {
            if (this.pressing && !this.solved) {
                this.pressProgress += 1 / 60;
                this.shake = Math.min(8, this.shake + 0.2);
                if (this.pressProgress >= 3) {
                    this.solved = true;
                    this.pressing = false;
                    triggerSuccess();
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
                    setTimeout(() => { gameState = 'complete'; showSuccess = false; }, 2600);
                }
            } else if (!this.pressing) {
                this.pressProgress = Math.max(0, this.pressProgress - 0.02);
                this.shake = Math.max(0, this.shake - 0.3);
            }
            if (this.solved) {
                this.crackAnim = Math.min(60, this.crackAnim + 1);
            }
        },
        onDown(pos) {
            if (inCircle(pos.x, pos.y, topBar_restartBtn.cx, topBar_restartBtn.cy, topBar_restartBtn.r)) {
                this.init(); return;
            }
            if (inCircle(pos.x, pos.y, topBar_hintBtn.cx, topBar_hintBtn.cy, topBar_hintBtn.r)) {
                showToast('一直按住屏幕！'); return;
            }
            if (this.solved) return;
            this.pressing = true;
            this.pressStart = Date.now();
            if (navigator.vibrate) navigator.vibrate(50);
        },
        onMove(pos) { },
        onUp(pos) {
            if (!this.solved && this.pressing) {
                const held = (Date.now() - this.pressStart) / 1000;
                if (held < 3 && held > 0.5) showToast('再坚持一下！长按3秒');
            }
            this.pressing = false;
        }
    };

    const levels = [level1, level2, level3];
    const levelNames = ['第1关 · 放鸭子', '第2关 · 赶牛上山', '第3关 · 叫醒蛋蛋'];

    function drawMenu() {
        drawStatusBar();
        shadowText('大聪明', W / 2, 165, 54, 'center', 5);
        shadowText('脑洞蛋', W / 2, 245, 60, 'center', 6);

        const btnX = W / 2 - 128, btnY = 385, btnW = 256, btnH = 76;
        stickerRect(btnX, btnY, btnW, btnH, 38, 7, 4);
        sketchText('开始游戏', W / 2, btnY + btnH / 2 + 2, 30, 'center', true);
        menu.btn = { x: btnX, y: btnY, w: btnW, h: btnH };

        sketchText('© 2024 MVP Demo', W / 2, H - 40, 15, 'center', false, 'rgba(0,0,0,0.35)');
    }
    const menu = { btn: null };

    function drawLevelSelect() {
        drawStatusBar();
        sketchText('←', 40, 72, 30, 'center', true);
        levelSelect.backBtn = { x: 16, y: 50, w: 60, h: 46 };

        shadowText('关卡选择', W / 2, 78, 34);

        const titles = [
            { n: '第 1 关', t: '放鸭子' },
            { n: '第 2 关', t: '赶牛上山' },
            { n: '第 3 关', t: '叫醒蛋蛋' }
        ];
        for (let i = 0; i < 3; i++) {
            const x = 24, y = 130 + i * 126, w = W - 48, h = 104;
            const isLocked = i >= unlockedLevels;
            if (isLocked) {
                ctx.save();
                ctx.globalAlpha = 0.45;
                stickerRect(x, y, w, h, 20, 6, 3, '#ffffff');
                ctx.restore();
                sketchText(titles[i].n, x + 28, y + 36, 16, 'left', true, '#999');
                sketchText(titles[i].t, x + 28, y + 76, 30, 'left', true, '#999');
                ctx.fillStyle = '#999';
                ctx.font = '700 32px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔒', x + w - 44, y + h / 2);
            } else {
                stickerRect(x, y, w, h, 20, 6, 3.5);
                sketchText(titles[i].n, x + 28, y + 36, 16, 'left', true);
                sketchText(titles[i].t, x + 28, y + 76, 30, 'left', true);
                levelSelect.btns[i] = { x, y, w, h };
            }
        }

        sketchText(`进度 ${Math.min(unlockedLevels, 3)}/3`, W / 2, H - 42, 20, 'center', true, 'rgba(0,0,0,0.45)');
    }
    const levelSelect = { btns: [{}, {}, {}], backBtn: null };

    function drawBetween() {
        drawStatusBar();
        const next = currentLevel + 1;
        if (next >= levels.length) { gameState = 'complete'; return; }
        shadowText('脑洞 +1 ！', W / 2, 155, 38);
        sketchText('你成功过了第 ' + (currentLevel + 1) + ' 关', W / 2, 215, 18);

        drawDoodleEgg(W / 2, 365, 58, 76, 'happy');

        const bx = W / 2 - 115, by = 500, bw = 230, bh = 66;
        stickerRect(bx, by, bw, bh, 22, 6, 3.5);
        sketchText('进入下一关 →', W / 2, by + bh / 2 + 1, 24, 'center', true);
        between.nextBtn = { x: bx, y: by, w: bw, h: bh };
    }
    const between = { nextBtn: null };

    function drawComplete() {
        drawStatusBar();
        shadowText('🎉 恭喜通关！', W / 2, 155, 34);
        sketchText('大聪明脑洞 × 3', W / 2, 210, 20);

        const eggX = W / 2, eggY = 385;
        const t = frameCount * 0.05;
        drawDoodleEgg(eggX, eggY + Math.sin(t) * 8, 60, 80, 'happy');
        ctx.save();
        ctx.translate(eggX, eggY - 60 + Math.sin(t) * 8);
        ctx.rotate(Math.sin(t * 2) * 0.15);
        sketchEllipse(0, 0, 30, 22, 2.5, 1310, '#ffffff');
        ctx.restore();
        for (let i = 0; i < 6; i++) {
            const sa = t + i * 1.05;
            const sr = 112 + Math.sin(t * 2 + i) * 10;
            const sx = eggX + Math.cos(sa) * sr;
            const sy = eggY + Math.sin(sa) * sr * 0.85;
            sketchText(['✦', '★', '♪', '❀', '✿', '✧'][i], sx, sy, 16);
        }

        const bx = W / 2 - 108, by = 550, bw = 216, bh = 60;
        stickerRect(bx, by, bw, bh, 20, 6, 3.5);
        sketchText('再玩一次', W / 2, by + bh / 2 + 1, 24, 'center', true);
        complete.btn = { x: bx, y: by, w: bw, h: bh };
    }
    const complete = { btn: null };

    function initLevel(idx) {
        if (idx >= unlockedLevels) {
            showToast('先完成前两关解锁吧！', 100);
            return;
        }
        currentLevel = idx;
        levels[idx].init();
        gameState = 'playing';
        showSuccess = false;
    }

    function handleDown(pos) {
        if (gameState === 'menu') {
            if (menu.btn && inRect(pos.x, pos.y, menu.btn.x, menu.btn.y, menu.btn.w, menu.btn.h)) gameState = 'levels';
        } else if (gameState === 'levels') {
            if (levelSelect.backBtn && inRect(pos.x, pos.y, levelSelect.backBtn.x, levelSelect.backBtn.y, levelSelect.backBtn.w, levelSelect.backBtn.h)) {
                gameState = 'menu';
                return;
            }
            for (let i = 0; i < 3; i++) {
                if (i >= unlockedLevels) continue;
                const b = levelSelect.btns[i];
                if (b && inRect(pos.x, pos.y, b.x, b.y, b.w, b.h)) { initLevel(i); return; }
            }
            for (let i = 0; i < 3; i++) {
                if (i < unlockedLevels) continue;
                const x = 24, y = 130 + i * 126, w = W - 48, h = 104;
                if (inRect(pos.x, pos.y, x, y, w, h)) {
                    showToast('🔒 这关还没解锁哦！', 90);
                    return;
                }
            }
        } else if (gameState === 'playing') {
            levels[currentLevel].onDown(pos);
        } else if (gameState === 'between') {
            if (between.nextBtn && inRect(pos.x, pos.y, between.nextBtn.x, between.nextBtn.y, between.nextBtn.w, between.nextBtn.h)) {
                initLevel(currentLevel + 1);
            }
        } else if (gameState === 'complete') {
            if (complete.btn && inRect(pos.x, pos.y, complete.btn.x, complete.btn.y, complete.btn.w, complete.btn.h)) {
                gameState = 'menu'; currentLevel = 0;
            }
        }
    }
    function handleMove(pos) {
        if (gameState === 'playing') levels[currentLevel].onMove(pos);
    }
    function handleUp(pos) {
        if (gameState === 'playing') levels[currentLevel].onUp(pos);
    }

    canvas.addEventListener('mousedown', e => { e.preventDefault(); handleDown(getPos(e)); });
    canvas.addEventListener('mousemove', e => { e.preventDefault(); handleMove(getPos(e)); });
    canvas.addEventListener('mouseup', e => { e.preventDefault(); handleUp(getPos(e)); });
    canvas.addEventListener('touchstart', e => { e.preventDefault(); handleDown(getPos(e)); }, { passive: false });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); handleMove(getPos(e)); }, { passive: false });
    canvas.addEventListener('touchend', e => { e.preventDefault(); handleUp(getPos(e)); }, { passive: false });

    function loop() {
        frameCount++;
        drawGridBackground();

        if (gameState === 'menu') drawMenu();
        else if (gameState === 'levels') drawLevelSelect();
        else if (gameState === 'playing') {
            levels[currentLevel].draw();
            levels[currentLevel].update();
            drawSuccessOverlay();
            if (showSuccess) successTimer--;
        } else if (gameState === 'between') drawBetween();
        else if (gameState === 'complete') drawComplete();

        drawToast();
        requestAnimationFrame(loop);
    }
    loop();
})();
