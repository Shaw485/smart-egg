(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const state = { x: .18, y: 0, vy: 0, dir: 0, grounded: true, knocks: 0, doorOpen: 0, time: 0, motes: [], ripples: [] };
  const input = { left: false, right: false };
  let W = 1280, H = 720, floorY = 560, last = performance.now(), audio, musicTimer = 0, musicStarted = false;

  function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; canvas.width = W*d; canvas.height = H*d; ctx.setTransform(d,0,0,d,0,0); floorY = H*.73; }
  addEventListener('resize', resize); resize();
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function line(points, color='#173b40', width=5) { ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke(); }
  function roundRect(x,y,w,h,r,fill,stroke='#173b40',sw=4){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}}

  function mountain(x,y,s,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-s,y);ctx.lineTo(x,y-s*.72);ctx.lineTo(x+s,y);ctx.closePath();ctx.fill();line([[x-s,y],[x,y-s*.72],[x+s,y]],'#4b3f59',3);}
  function drawWorld(){
    const sky=ctx.createLinearGradient(0,0,0,floorY);sky.addColorStop(0,'#6f5479');sky.addColorStop(.5,'#d47a6c');sky.addColorStop(1,'#f3bd75');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    const glow=ctx.createRadialGradient(W*.76,H*.27,8,W*.76,H*.27,145);glow.addColorStop(0,'rgba(255,238,157,.95)');glow.addColorStop(.45,'rgba(255,171,101,.48)');glow.addColorStop(1,'rgba(255,136,92,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,floorY);
    ctx.fillStyle='#ffd990';ctx.beginPath();ctx.arc(W*.76,H*.27,46,0,Math.PI*2);ctx.fill();
    for(let i=0;i<7;i++)mountain(i*W/6,floorY,W*.2,i%2?'#66556f':'#554c68');
    ctx.fillStyle='#394a45';ctx.beginPath();ctx.moveTo(0,floorY);for(let x=0;x<=W;x+=60)ctx.lineTo(x,floorY-32-Math.sin(x*.015)*17);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
    // 简洁地面：一层草坡、一条暖色边缘、少量扁石
    ctx.fillStyle='#657456';ctx.fillRect(0,floorY,W,H-floorY);
    ctx.fillStyle='#91a665';ctx.fillRect(0,floorY,W,28);
    ctx.fillStyle='#d9b668';ctx.fillRect(0,floorY,W,8);
    for(let x=24;x<W;x+=92){const sway=Math.sin(x)*5;line([[x,floorY+2],[x+sway,floorY-13]],'#35473d',3);}
    for(let i=0;i<6;i++){const x=(i*223+80)%W,y=floorY+48+(i%2)*32;ctx.fillStyle=i%2?'#59645a':'#73786a';ctx.beginPath();ctx.ellipse(x,y,30,10,-.06,0,7);ctx.fill();}
  }
  function drawDoor(){
    const x=W*.82, h=Math.min(205,H*.32), w=h*.58, y=floorY-h;
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle='#6c806d';ctx.beginPath();ctx.moveTo(-w*.62,h);ctx.lineTo(-w*.52,30);ctx.quadraticCurveTo(0,-40,w*.52,30);ctx.lineTo(w*.62,h);ctx.closePath();ctx.fill();line([[-w*.62,h],[-w*.52,30],[0,-35],[w*.52,30],[w*.62,h]],'#173b40',7);
    roundRect(-w*.41,35,w*.82,h-35,[w*.35,w*.35,w*.42,w*.42],'#283f3e','#f1d487',5);
    ctx.save();ctx.translate(w*.34,0);ctx.scale(Math.max(.05,1-state.doorOpen),1);ctx.fillStyle='#526b5c';ctx.fillRect(-w*.75,39,w*.75,h-43);ctx.strokeStyle='#172f32';ctx.lineWidth=5;ctx.strokeRect(-w*.75,39,w*.75,h-43);ctx.restore();
    ctx.strokeStyle='#f2d57d';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,h*.43,22,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(0,h*.21);ctx.lineTo(0,h*.65);ctx.stroke();
    ctx.restore();
    for(const r of state.ripples){ctx.strokeStyle=`rgba(255,231,144,${1-r.t})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y+h*.45,25+r.t*70,0,7);ctx.stroke();}
    return {x,y,w,h};
  }
  function drawHero(){
    const x=state.x*W, bob=state.grounded&&state.dir?Math.sin(state.time*12)*3:0, y=floorY-74-state.y+bob;
    ctx.save();ctx.translate(x,y);if(state.dir<0)ctx.scale(-1,1);
    // 红披风：静止时垂落，走动时向身后抬起并产生波浪
    const run=Math.abs(state.dir),air=state.grounded?0:1,wave=Math.sin(state.time*15)*7*run+Math.sin(state.time*8)*3*air;
    ctx.fillStyle='#b83f3f';ctx.beginPath();ctx.moveTo(-8,25);ctx.bezierCurveTo(-30-run*22-air*13,36-wave-air*8,-50-run*34-air*18,58-wave*.45-air*13,-35-run*26-air*14,79-run*18-air*17);ctx.quadraticCurveTo(-7-run*17,70+wave*.25-air*8,18,68);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#3b3040';ctx.lineWidth=5;ctx.stroke();
    // 短上衣、腰带与裤子，避免裙摆轮廓
    ctx.fillStyle='#f6d999';ctx.beginPath();ctx.ellipse(0,16,28,30,0,0,7);ctx.fill();ctx.strokeStyle='#173b40';ctx.lineWidth=5;ctx.stroke();
    ctx.fillStyle='#2d7770';ctx.beginPath();ctx.moveTo(-23,41);ctx.lineTo(25,41);ctx.lineTo(27,72);ctx.quadraticCurveTo(0,78,-26,72);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#d6aa55';ctx.fillRect(-26,67,53,9);ctx.strokeStyle='#173b40';ctx.lineWidth=4;ctx.strokeRect(-26,67,53,9);ctx.fillStyle='#f1cf72';ctx.fillRect(-5,66,12,11);ctx.strokeRect(-5,66,12,11);
    ctx.fillStyle='#334b52';ctx.beginPath();ctx.moveTo(-22,76);ctx.lineTo(-2,76);ctx.lineTo(-5,88);ctx.lineTo(-24,88);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(2,76);ctx.lineTo(23,76);ctx.lineTo(25,88);ctx.lineTo(5,88);ctx.closePath();ctx.fill();ctx.stroke();
    // 短碎发轻摆：走路左右晃，跳跃时整体微微上扬
    const hairSwing=Math.sin(state.time*(run?12:7))*(run?3:1)+Math.sin(state.time*8)*air*2;
    ctx.save();ctx.translate(0,-air*2);ctx.rotate(hairSwing*.012);
    ctx.fillStyle='#68432f';ctx.beginPath();ctx.moveTo(-27,8);ctx.quadraticCurveTo(-22,-21,3,-20);ctx.quadraticCurveTo(28,-17,28,7);ctx.lineTo(19,3);ctx.lineTo(13,15);ctx.lineTo(4,7);ctx.lineTo(-4,18);ctx.lineTo(-13,9);ctx.lineTo(-22,17);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.ellipse(-26,8,9,18,-.25+hairSwing*.018,0,7);ctx.fill();ctx.beginPath();ctx.moveTo(-25,17);ctx.quadraticCurveTo(-40-hairSwing,28-air*5,-30-hairSwing,38-air*7);ctx.quadraticCurveTo(-15,31,-20,17);ctx.fill();ctx.restore();
    ctx.fillStyle='#173b40';ctx.beginPath();ctx.arc(8,16,3.5,0,7);ctx.fill();
    // 双手与脚使用相同的深色线条
    const armSwing=state.dir?Math.sin(state.time*11)*7:0;
    line([[-23,50],[-42-armSwing,72]],'#263943',6);line([[23,50],[42+armSwing,69]],'#263943',6);
    // 两段式腿部步态：膝盖先摆，脚尖随后落地
    const phase=state.dir?Math.sin(state.time*11):0,phase2=state.dir?Math.sin(state.time*11+Math.PI):0;
    const kneeL=[-13+phase*5,96-Math.max(0,phase)*4],footL=[-14+phase*12,106-Math.max(0,phase)*6];
    const kneeR=[14+phase2*5,96-Math.max(0,phase2)*4],footR=[16+phase2*12,106-Math.max(0,phase2)*6];
    line([[-14,87],kneeL,footL],'#173b40',6);line([[15,87],kneeR,footR],'#173b40',6);line([[footL[0]-2,footL[1]],[footL[0]+6,footL[1]]],'#173b40',5);line([[footR[0]-2,footR[1]],[footR[0]+6,footR[1]]],'#173b40',5);
    ctx.restore();
  }
  function drawMotes(dt){
    if(Math.random()<dt*8)state.motes.push({x:Math.random()*W,y:floorY-Math.random()*H*.5,t:0,s:1+Math.random()*2});
    state.motes=state.motes.filter(m=>(m.t+=dt)<3);for(const m of state.motes){ctx.fillStyle=`rgba(255,238,151,${Math.sin(m.t/3*Math.PI)*.8})`;ctx.beginPath();ctx.arc(m.x+Math.sin(m.t*2)*8,m.y-m.t*10,m.s,0,7);ctx.fill();}
  }
  function update(dt){
    state.time+=dt;state.dir=(input.right?1:0)-(input.left?1:0);state.x=clamp(state.x+state.dir*dt*.22,.04,.94);
    if(!state.grounded){state.vy-=dt*2.7;state.y+=state.vy*H*.35*dt;if(state.y<=0){state.y=0;state.vy=0;state.grounded=true;}}
    state.ripples=state.ripples.filter(r=>(r.t+=dt*1.8)<1);const doorTarget=state.knocks>=2?1:0;state.doorOpen+=(doorTarget-state.doorOpen)*Math.min(1,dt*4);
  }
  function frame(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);drawWorld();drawMotes(dt);drawDoor();drawHero();requestAnimationFrame(frame);}requestAnimationFrame(frame);

  function bindHold(id,key){const el=document.getElementById(id),on=e=>{e.preventDefault();startMusic();input[key]=true;el.classList.add('active');},off=e=>{e.preventDefault();input[key]=false;el.classList.remove('active');};el.addEventListener('pointerdown',on);addEventListener('pointerup',off);addEventListener('pointercancel',off);}
  bindHold('left','left');bindHold('right','right');
  function jump(){if(state.grounded){state.grounded=false;state.vy=1.25;tone(360,.1);}}
  document.getElementById('jump').addEventListener('pointerdown',e=>{e.preventDefault();startMusic();jump();});
  addEventListener('keydown',e=>{startMusic();if(e.code==='ArrowLeft'||e.code==='KeyA')input.left=true;if(e.code==='ArrowRight'||e.code==='KeyD')input.right=true;if(e.code==='Space'||e.code==='ArrowUp')jump();});
  addEventListener('keyup',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')input.left=false;if(e.code==='ArrowRight'||e.code==='KeyD')input.right=false;});
  function tone(freq,dur){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=freq;o.type='triangle';g.gain.setValueAtTime(.12,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur);}catch{}}
  function musicPhrase(){if(!audio)return;const now=audio.currentTime,notes=[293.66,369.99,440,554.37,440,369.99,329.63,293.66];notes.forEach((f,i)=>{const o=audio.createOscillator(),v=audio.createGain();o.type=i%3?'triangle':'sine';o.frequency.value=f;v.gain.setValueAtTime(.0001,now+i*.38);v.gain.exponentialRampToValueAtTime(.035,now+i*.38+.05);v.gain.exponentialRampToValueAtTime(.0001,now+i*.38+.34);o.connect(v).connect(audio.destination);o.start(now+i*.38);o.stop(now+i*.38+.36)});[146.83,220,164.81,220].forEach((f,i)=>{const o=audio.createOscillator(),v=audio.createGain();o.type='sine';o.frequency.value=f;v.gain.setValueAtTime(.0001,now+i*.76);v.gain.exponentialRampToValueAtTime(.018,now+i*.76+.08);v.gain.exponentialRampToValueAtTime(.0001,now+i*.76+.68);o.connect(v).connect(audio.destination);o.start(now+i*.76);o.stop(now+i*.76+.7)})}
  function startMusic(){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();if(musicStarted)return;musicStarted=true;musicPhrase();musicTimer=setInterval(musicPhrase,3200)}catch{}}
  function toast(text){const t=document.getElementById('toast');t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1600);}
  canvas.addEventListener('pointerdown',e=>{startMusic();const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;if(x>.72&&y>.28&&y<.76){const near=Math.abs(state.x-.82)<.12;state.ripples.push({t:0});tone(near?115:80,.16);if(near){state.knocks++;toast(state.knocks===1?'咚——门纹亮了一半':'咚——古门开启');if(state.knocks>=2)setTimeout(()=>document.getElementById('finish').hidden=false,650);}else toast('太远了，门只传来微弱回声');}});
  document.getElementById('hint').onclick=()=>toast('先走到石门前，再轻触石门两次');
  function reset(){state.x=.18;state.y=0;state.vy=0;state.knocks=0;state.doorOpen=0;state.ripples=[];document.getElementById('finish').hidden=true;}
  document.getElementById('restart').onclick=reset;document.getElementById('again').onclick=reset;
})();
