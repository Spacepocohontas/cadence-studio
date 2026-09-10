(()=>{
const tabs=[...document.querySelectorAll('.tab')],panels=[...document.querySelectorAll('.tabPanel')];
function show(name){const n=name||'studio';tabs.forEach(t=>{const on=t.dataset.tab===n;t.classList.toggle('active',on);t.setAttribute('aria-selected',on?'true':'false')});panels.forEach(p=>p.classList.toggle('active',p.dataset.panel===n));localStorage.setItem('cadence-tab',n)}
tabs.forEach(t=>t.addEventListener('click',()=>show(t.dataset.tab)));show(localStorage.getItem('cadence-tab')||'studio');
const auto=document.querySelector('#autoShuffle');let on=localStorage.getItem('cadence-auto-shuffle')==='1',timer=null;
function randomize(){const a=[...document.querySelectorAll('.mediaItem')];if(!a.length)return;const picks=a.sort(()=>Math.random()-.5);if(picks[0])picks[0].click();const loadB=document.querySelector('#loadB');if(loadB&&picks[1]){picks[1].click();loadB.click()}const rv=document.querySelector('#randomVisual');if(rv)rv.click()}
function set(v){on=v;localStorage.setItem('cadence-auto-shuffle',v?'1':'0');if(auto)auto.textContent='AUTO SHUFFLE: '+(v?'ON':'OFF');clearInterval(timer);if(v){randomize();timer=setInterval(randomize,60000)}}
if(auto){auto.onclick=()=>set(!on);set(on)}
const vf=document.querySelector('#visualFullscreen');if(vf)vf.addEventListener('click',async()=>{const s=document.querySelector('#stage');try{if(!document.fullscreenElement)await s.requestFullscreen();else await document.exitFullscreen()}catch{}});
const ov=document.querySelector('#overlayVideo');if(ov)ov.addEventListener('click',()=>{const s=document.querySelector('#stage');const next=!s.classList.contains('videoOverlay');s.classList.toggle('videoOverlay',next);ov.textContent='VIDEO OVERLAY: '+(next?'ON':'OFF');localStorage.setItem('cadence-video-overlay',next?'1':'0')});
const savedOverlay=localStorage.getItem('cadence-video-overlay')==='1';if(savedOverlay){document.querySelector('#stage')?.classList.add('videoOverlay');if(ov)ov.textContent='VIDEO OVERLAY: ON'}
const rv=document.querySelector('#randomVisual');if(rv)rv.addEventListener('click',()=>{const x=document.querySelector('#visualMode');if(!x)return;const m=['bars','wave','rings','particles','tunnel'];x.value=m[Math.floor(Math.random()*m.length)];x.dispatchEvent(new Event('change'))});
})();