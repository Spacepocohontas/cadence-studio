(()=>{
const $=i=>document.getElementById(i);
const logEl=$("log"),hud=$("hud"),canvas=$("viz"),ctx=canvas.getContext("2d"),clip=$("clip"),seek=$("seek"),timeEl=$("time");
const S={muteOrig:false,useTrack:false,playing:false,rec:null,chunks:[],actx:null,analyser:null,dest:null,gM:null,gT:null,freq:null,id:crypto.randomUUID(),parts:[],t0:performance.now(),mediaUrl:null,trackUrl:null};
function log(m){const line=`[${new Date().toLocaleTimeString()}] ${m}`;const h=JSON.parse(localStorage.getItem("op_log")||"[]");h.unshift(line);localStorage.setItem("op_log",JSON.stringify(h.slice(0,80)));logEl.textContent=h.slice(0,40).join("\n");}
logEl.textContent=JSON.parse(localStorage.getItem("op_log")||"[]").slice(0,40).join("\n");
const plist=()=>JSON.parse(localStorage.getItem("op_projects")||"[]");
function renderP(){const b=$("projList");b.innerHTML="";plist().forEach(p=>{const d=document.createElement("div");d.className="proj";d.textContent=p.name+" · "+new Date(p.updated).toLocaleString();d.onclick=()=>loadP(p.id);b.appendChild(d);});}
function saveP(){const name=$("projName").value.trim()||"untitled";const list=plist().filter(p=>p.id!==S.id);list.unshift({id:S.id,name,prompt:$("prompt").value,mode:$("mode").value,intensity:$("intensity").value,muteOrig:S.muteOrig,useTrack:S.useTrack,updated:Date.now()});localStorage.setItem("op_projects",JSON.stringify(list.slice(0,24)));renderP();log("saved "+name);}
function loadP(id){const p=plist().find(x=>x.id===id);if(!p)return;S.id=p.id;$("projName").value=p.name;$("prompt").value=p.prompt||"";$("mode").value=p.mode||"auto";$("intensity").value=p.intensity||1;S.muteOrig=!!p.muteOrig;S.useTrack=!!p.useTrack;gains();log("opened "+p.name);}
function theme(prompt){const p=(prompt||"").toLowerCase();const t={a:[201,162,39],b:[226,59,91],c:[58,210,159],bg:[7,7,11],words:(prompt||"PULSE KEEP").split(/[\s,]+/).filter(Boolean).slice(0,8)};if(/red|blood|rose|possess/.test(p))t.a=[220,40,70];if(/blue|rain|night|neon/.test(p))t.b=[40,140,255];if(/gold|church|holy/.test(p))t.c=[230,190,80];if(/void|obsidian|black/.test(p))t.bg=[4,2,6];return t;}
function audio(){if(S.actx)return;const a=new AudioContext();const an=a.createAnalyser();an.fftSize=1024;const dest=a.createMediaStreamDestination();S.gM=a.createGain();S.gT=a.createGain();S.gM.connect(an);S.gT.connect(an);an.connect(a.destination);an.connect(dest);S.actx=a;S.analyser=an;S.dest=dest;S.freq=new Uint8Array(an.frequencyBinCount);gains();}
function hook(el,kind){audio();try{const src=S.actx.createMediaElementSource(el);src.connect(kind==="t"?S.gT:S.gM);}catch(e){log("graph bound");}}
function gains(){if(!S.gM)return;S.gM.gain.value=S.muteOrig?0:(S.useTrack?0.15:1);S.gT.gain.value=S.useTrack?1:0;clip.muted=!!(S.muteOrig||S.useTrack);$("btnMuteOrig").textContent=S.muteOrig?"Original muted":"Mute original";$("btnUseTrack").textContent=S.useTrack?"Overlay ON":"Use overlay track";}
const ov=new Audio();ov.crossOrigin="anonymous";
$("mediaFile").onchange=e=>{const f=e.target.files[0];if(!f)return;if(S.mediaUrl)URL.revokeObjectURL(S.mediaUrl);S.mediaUrl=URL.createObjectURL(f);clip.src=S.mediaUrl;clip.onloadedmetadata=()=>{hook(clip,"m");log("loaded "+f.name);hud.textContent=f.name;}};
$("trackFile").onchange=e=>{const f=e.target.files[0];if(!f)return;if(S.trackUrl)URL.revokeObjectURL(S.trackUrl);S.trackUrl=URL.createObjectURL(f);ov.src=S.trackUrl;ov.onloadedmetadata=()=>{hook(ov,"t");S.useTrack=true;gains();log("overlay "+f.name);}};
$("btnMuteOrig").onclick=()=>{S.muteOrig=!S.muteOrig;gains();};
$("btnUseTrack").onclick=()=>{S.useTrack=!S.useTrack;gains();};
async function play(){audio();if(S.actx.state==="suspended")await S.actx.resume();try{await clip.play();}catch(e){}if(S.useTrack){ov.currentTime=clip.currentTime||0;try{await ov.play();}catch(e){}}S.playing=true;log("play");}
function stop(){clip.pause();ov.pause();S.playing=false;}
$("btnPlay").onclick=play;$("btnStop").onclick=stop;
$("btnSeekBack").onclick=()=>{clip.currentTime=Math.max(0,clip.currentTime-5);if(S.useTrack)ov.currentTime=clip.currentTime;};
$("btnSeekFwd").onclick=()=>{clip.currentTime=Math.min(clip.duration||0,clip.currentTime+5);if(S.useTrack)ov.currentTime=clip.currentTime;};
seek.oninput=()=>{if(!clip.duration)return;clip.currentTime=(seek.value/1000)*clip.duration;if(S.useTrack)ov.currentTime=clip.currentTime;};
$("vol").oninput=()=>{const v=+$("vol").value;clip.volume=v;ov.volume=v;};
function fmt(t){if(!isFinite(t))return"0:00";return Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0");}
function energy(){if(!S.analyser)return{bass:0,mid:0,treble:0,avg:0};S.analyser.getByteFrequencyData(S.freq);const f=S.freq,n=f.length;let b=0,m=0,t=0;for(let i=0;i<n;i++){if(i<n*0.08)b+=f[i];else if(i<n*0.4)m+=f[i];else t+=f[i];}b/=n*0.08*255;m/=n*0.32*255;t/=n*0.6*255;return{bass:b,mid:m,treble:t,avg:(b+m+t)/3};}
function resize(){const r=canvas.parentElement.getBoundingClientRect();canvas.width=Math.max(640,r.width);canvas.height=Math.max(360,r.height);}
addEventListener("resize",resize);resize();
for(let i=0;i<140;i++)S.parts.push({x:Math.random(),y:Math.random(),vx:(Math.random()-.5)*0.002,vy:(Math.random()-.5)*0.002,s:Math.random()*2+.4});
function draw(){requestAnimationFrame(draw);const w=canvas.width,h=canvas.height,e=energy();
$("mBass").style.width=Math.min(100,e.bass*140)+"%";$("mTreble").style.width=Math.min(100,e.treble*180)+"%";
if(clip.duration){seek.value=(clip.currentTime/clip.duration)*1000;timeEl.textContent=fmt(clip.currentTime)+" / "+fmt(clip.duration);}
$("clock").textContent=new Date().toLocaleString();
const th=theme($("prompt").value);const mode=$("mode").value;const I=+$("intensity").value;const t=(performance.now()-S.t0)/1000;
ctx.fillStyle=`rgba(${th.bg[0]},${th.bg[1]},${th.bg[2]},0.18)`;ctx.fillRect(0,0,w,h);
if(clip.readyState>=2&&clip.videoWidth){ctx.save();ctx.globalAlpha=.28+e.avg*.25;ctx.drawImage(clip,0,0,w,h);ctx.restore();}
const scene=mode==="auto"?(e.bass>.55?"cut":e.treble>.35?"storm":e.mid>.3?"orbit":"bars"):mode;
if(scene==="bars"||scene==="auto"){const bars=64,step=w/bars;for(let i=0;i<bars;i++){const v=S.freq?S.freq[Math.floor(i*S.freq.length/bars)]/255:.1;const bh=v*h*.55*I;const c=i%3===0?th.a:i%3===1?th.b:th.c;ctx.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},0.85)`;ctx.fillRect(i*step+1,h-bh,step-2,bh);}}
if(scene==="orbit"){ctx.save();ctx.translate(w/2,h/2);for(let r=0;r<6;r++){ctx.beginPath();ctx.strokeStyle=`rgba(${th.a[0]},${th.a[1]},${th.a[2]},${.7-r*.08})`;ctx.lineWidth=2+e.mid*6;ctx.arc(0,0,40+r*38+e.bass*80*I,t+r,t+r+Math.PI*(.6+e.treble));ctx.stroke();}ctx.restore();}
if(scene==="storm"){S.parts.forEach(p=>{p.x+=p.vx+(e.treble-.2)*0.01;p.y+=p.vy+e.bass*0.004;if(p.x<0)p.x=1;if(p.x>1)p.x=0;if(p.y<0)p.y=1;if(p.y>1)p.y=0;ctx.fillStyle=`rgba(${th.b[0]},${th.b[1]},${th.b[2]},0.8)`;ctx.fillRect(p.x*w,p.y*h,p.s+e.avg*4*I,p.s+e.avg*4*I);});}
if(scene==="glyph"||scene==="cut"){ctx.save();ctx.globalAlpha=.35+e.avg*.5;ctx.fillStyle=`rgb(${th.c[0]},${th.c[1]},${th.c[2]})`;ctx.font=(18+e.bass*48*I)+"px sans-serif";const word=th.words[Math.floor(t*(1+e.bass*4))%Math.max(1,th.words.length)]||"PULSE";ctx.fillText(word.toUpperCase(),40+Math.sin(t*2)*20*I,80+e.mid*80);if(scene==="cut"&&e.bass>.62){ctx.globalCompositeOperation="lighter";ctx.fillStyle=`rgba(${th.a[0]},${th.a[1]},${th.a[2]},0.25)`;ctx.fillRect(0,0,w,h);}ctx.restore();}
hud.textContent=scene+" · bass "+e.bass.toFixed(2)+" · "+(S.playing?"LIVE":"IDLE");}
draw();
function exp(blob,label){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=label;a.textContent="download "+label;a.style.cssText="display:block;color:#c9a227;font-size:12px;margin:4px 0";$("exports").prepend(a);log("export "+label);}
$("btnRec").onclick=async()=>{audio();const stream=canvas.captureStream(30);if(S.dest)S.dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));S.chunks=[];S.rec=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")?"video/webm;codecs=vp9,opus":"video/webm"});S.rec.ondataavailable=ev=>{if(ev.data.size)S.chunks.push(ev.data);};S.rec.onstop=()=>exp(new Blob(S.chunks,{type:"video/webm"}),"pulse-"+Date.now()+".webm");S.rec.start(250);$("btnRec").disabled=true;$("btnRecStop").disabled=false;log("recording");if(!S.playing)play();};
$("btnRecStop").onclick=()=>{if(S.rec&&S.rec.state!=="inactive")S.rec.stop();$("btnRec").disabled=false;$("btnRecStop").disabled=true;};
$("btnBatch").onclick=async()=>{const modes=["orbit","storm","cut"],orig=$("mode").value;log("batch 3 vars");for(const m of modes){$("mode").value=m;await play();await new Promise(r=>{audio();const stream=canvas.captureStream(24);if(S.dest)S.dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));const rec=new MediaRecorder(stream,{mimeType:"video/webm"});const ch=[];rec.ondataavailable=e=>{if(e.data.size)ch.push(e.data);};rec.onstop=()=>{exp(new Blob(ch,{type:"video/webm"}),"var-"+m+"-"+Date.now()+".webm");r();};rec.start();setTimeout(()=>rec.stop(),4000);});}$("mode").value=orig;log("batch done");};
$("btnSave").onclick=saveP;$("btnNew").onclick=()=>{S.id=crypto.randomUUID();$("projName").value="";$("prompt").value="";log("new project");};
renderP();log("studio ready");
})();
