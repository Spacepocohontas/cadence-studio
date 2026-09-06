(()=>{
const A=document.querySelector('#audioA'),B=document.querySelector('#audioB'),toggle=document.querySelector('#beatGrid');
if(!A||!B)return;
let on=false;
function draw(k){const audio=k==='A'?A:B,bpm=window.CadenceBPM?.get(k),wave=document.querySelector('#wave'+k);if(!wave)return;wave.querySelectorAll('.beatMark').forEach(e=>e.remove());if(!on||!bpm||!Number.isFinite(audio.duration))return;const step=60/bpm,count=Math.ceil(audio.duration/step);for(let i=0;i<=count;i++){const m=document.createElement('i');m.className='beatMark';m.style.left=`${Math.min(100,(i*step/audio.duration)*100)}%`;m.title=`Beat ${i+1} · ${bpm.toFixed(1)} BPM`;wave.appendChild(m)}}
function redraw(){draw('A');draw('B');}
toggle&&(toggle.onclick=()=>{on=!on;toggle.textContent=on?'BEAT GRID: ON':'BEAT GRID';toggle.classList.toggle('active',on);redraw()});
window.addEventListener('cadence:bpm',redraw);A.addEventListener('loadedmetadata',redraw);B.addEventListener('loadedmetadata',redraw);
window.CadenceBeatGrid={enabled:()=>on,refresh:redraw};
})();