(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const state = { x: .18, y: 0, vy: 0, dir: 0, grounded: true, knocks: 0, doorOpen: 0, time: 0, motes: [], ripples: [] };
  const input = { left: false, right: false };
  let W = 1280, H = 720, floorY = 560, last = performance.now(), audio;

  function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; canvas.width = W*d; canvas.height = H*d; ctx.setTransform(d,0,0,d,0,0); floorY = H*.73; }
  addEventListener('resize', resize); resize();
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function line(points, color='#173b40', width=5) { ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke(); }
  function roundRect(x,y,w,h,r,fill,stroke='#173b40',sw=4){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}}

  function mountain(x,y,s,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-s,y);ctx.lineTo(x,y-s*.72);ctx.lineTo(x+s,y);ctx.closePath();ctx.fill();line([[x-s,y],[x,y-s*.72],[x+s,y]],'#39757a',3);}
  function drawWorld(){
    const sky=ctx.createLinearGradient(0,0,0,floorY);sky.addColorStop(0,'#78bdc8');sky.addColorStop(1,'#d9e8bf');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,245,190,.55)';ctx.beginPath();ctx.arc(W*.76,H*.19,55,0,Math.PI*2);ctx.fill();
    for(let i=0;i<7;i++)mountain(i*W/6,floorY,W*.2,i%2?'#78aaa2':'#65979a');
    ctx.fillStyle='#416d59';ctx.beginPath();ctx.moveTo(0,floorY);for(let x=0;x<=W;x+=60)ctx.lineTo(x,floorY-35-Math.sin(x*.015)*18);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
    ctx.fillStyle='#9bc174';ctx.fillRect(0,floorY,W,H-floorY);ctx.fillStyle='#c9d98b';ctx.fillRect(0,floorY,W,12);
    for(let x=20;x<W;x+=72){const sway=Math.sin(x*1.7)*7;line([[x,floorY+4],[x+sway,floorY-15]],'#285447',3);ctx.fillStyle='#f6da79';ctx.beginPath();ctx.arc(x+sway,floorY-18,4,0,7);ctx.fill();}
    // foreground stones
    for(let i=0;i<8;i++){const x=(i*173+50)%W;ctx.fillStyle='#6e8f70';ctx.beginPath();ctx.ellipse(x,H-25,60,25,0,0,7);ctx.fill();}
  }
  function drawDoor(){
    const x=W*.82, h=Math.min(255,H*.39), w=h*.58, y=floorY-h;
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
    // cape
    ctx.fillStyle='#d46d4c';ctx.beginPath();ctx.moveTo(-8,24);ctx.quadraticCurveTo(-48,45,-35,79);ctx.lineTo(18,69);ctx.closePath();ctx.fill();line([[-8,24],[-35,79],[18,69]],'#173b40',4);
    // body and tunic
    ctx.fillStyle='#f6d999';ctx.beginPath();ctx.ellipse(0,16,28,30,0,0,7);ctx.fill();ctx.strokeStyle='#173b40';ctx.lineWidth=5;ctx.stroke();
    ctx.fillStyle='#2d7770';ctx.beginPath();ctx.moveTo(-24,42);ctx.lineTo(26,42);ctx.lineTo(35,82);ctx.lineTo(-30,82);ctx.closePath();ctx.fill();ctx.stroke();
    // hair and face
    ctx.fillStyle='#7b4a2b';ctx.beginPath();ctx.arc(-4,3,28,Math.PI,Math.PI*2);ctx.lineTo(22,18);ctx.lineTo(11,12);ctx.lineTo(2,22);ctx.lineTo(-8,12);ctx.lineTo(-22,20);ctx.closePath();ctx.fill();
    ctx.fillStyle='#173b40';ctx.beginPath();ctx.arc(8,16,3.5,0,7);ctx.fill();
    // scarf tail and sword hint
    line([[15,39],[42,52],[54,47]],'#f4d46e',7);line([[-23,50],[-42,75]],'#d9e2bb',5);
    const stride=state.dir?Math.sin(state.time*11)*8:0;line([[-12,80],[-14+stride,99]],'#173b40',6);line([[17,80],[18-stride,99]],'#173b40',6);
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

  function bindHold(id,key){const el=document.getElementById(id),on=e=>{e.preventDefault();input[key]=true;el.classList.add('active');},off=e=>{e.preventDefault();input[key]=false;el.classList.remove('active');};el.addEventListener('pointerdown',on);addEventListener('pointerup',off);addEventListener('pointercancel',off);}
  bindHold('left','left');bindHold('right','right');
  function jump(){if(state.grounded){state.grounded=false;state.vy=1.25;tone(360,.1);}}
  document.getElementById('jump').addEventListener('pointerdown',e=>{e.preventDefault();jump();});
  addEventListener('keydown',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')input.left=true;if(e.code==='ArrowRight'||e.code==='KeyD')input.right=true;if(e.code==='Space'||e.code==='ArrowUp')jump();});
  addEventListener('keyup',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')input.left=false;if(e.code==='ArrowRight'||e.code==='KeyD')input.right=false;});
  function tone(freq,dur){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=freq;o.type='triangle';g.gain.setValueAtTime(.12,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur);}catch{}}
  function toast(text){const t=document.getElementById('toast');t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1600);}
  canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;if(x>.72&&y>.28&&y<.76){const near=Math.abs(state.x-.82)<.12;state.ripples.push({t:0});tone(near?115:80,.16);if(near){state.knocks++;toast(state.knocks===1?'咚——门纹亮了一半':'咚——古门开启');if(state.knocks>=2)setTimeout(()=>document.getElementById('finish').hidden=false,650);}else toast('太远了，门只传来微弱回声');}});
  document.getElementById('hint').onclick=()=>toast('先走到石门前，再轻触石门两次');
  function reset(){state.x=.18;state.y=0;state.vy=0;state.knocks=0;state.doorOpen=0;state.ripples=[];document.getElementById('finish').hidden=true;}
  document.getElementById('restart').onclick=reset;document.getElementById('again').onclick=reset;
})();
