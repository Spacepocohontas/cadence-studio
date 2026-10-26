import {PRESETS,clamp,fmt,summarizeAudio,parseDirection,makePlan,findSegment,assertContinuous} from './engine.mjs';
const $=(id)=>document.getElementById(id);
const q=(selector)=>document.querySelector(selector);
const state={audioFile:null,audioUrl:null,audioBuffer:null,analysis:null,media:[],style:'Bass Impact',seed:0,plan:null,selectedId:null,playing:false,position:0,playStart:0,rendering:false,raf:0,lastMediaId:null,previewLooped:false};
const audio=new Audio();
audio.preload='auto';
audio.volume=1;
const canvas=$('previewCanvas'),ctx=canvas.getContext('2d',{alpha:false});
const wave=$('waveform'),waveCtx=wave.getContext('2d');
const styleButtons=[...document.querySelectorAll('[data-style]')];
const defaultCanvas=()=>{const g=ctx.createLinearGradient(0,0,canvas.width,canvas.height);g.addColorStop(0,'#3b224b');g.addColorStop(.6,'#1c152d');g.addColorStop(1,'#0c0a16');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#ead4f7';ctx.textAlign='center';ctx.font='700 '+Math.round(canvas.width*.08)+'px sans-serif';ctx.fillText('✦',canvas.width/2,canvas.height/2);};
function status(message,kind=''){const el=$('status');el.textContent=message;el.className='status '+kind}
function duration(){const master=state.analysis?.duration||0;if(!master)return 0;return $('durationLock').checked?master:clamp(Number($('customDuration').value)||master,.5,Math.max(3600,master*2))}
function settings(){const [a,b]=$('aspect').value.split(':').map(Number);const quality=Number($('quality').value);let width,height;if(a<b){width=quality;height=Math.round(quality*b/a)}else if(a>b){height=quality;width=Math.round(quality*a/b)}else{width=quality;height=quality}
return {width,height};
}
function resizeCanvas(){const {width,height}=settings();canvas.width=width;canvas.height=height;$('previewFrame').style.aspectRatio=String(width)+' / '+String(height);$('exportResolution').textContent=width+' × '+height;renderFrame(state.position);}
function syncLengths(){const d=duration();$('songDuration').textContent=state.analysis?fmt(state.analysis.duration):'—';$('videoDuration').textContent=d?fmt(d):'—';$('exportLength').textContent=d?fmt(d):'—';$('totalTime').textContent=fmt(d);$('waveEnd').textContent=fmt(state.analysis?.duration||0);$('timelineDuration').textContent=fmt(d);$('unlockBox').hidden=$('durationLock').checked;$('lockMessage').innerHTML=$('durationLock').checked?'<span>✓</span> Lock is ON. The video timeline ends with the soundtrack; visuals loop or trim to fit.':'<span>↔</span> Lock is OFF. Your chosen video length controls the edit; audio repeats if needed.';if(state.plan&&Math.abs(state.plan.duration-d)>.0001)createPlan(false);}
function readMetadata(element,event){return new Promise((resolve,reject)=>{if(element.readyState>=1&&Number.isFinite(element.duration)){resolve();return}const timeout=setTimeout(()=>{done();reject(Error('Media metadata timed out'))},12000);function done(){clearTimeout(timeout);element.removeEventListener(event,success);element.removeEventListener('error',fail)}function success(){done();resolve()}function fail(){done();reject(Error('Browser cannot decode this file'))}element.addEventListener(event,success,{once:true});element.addEventListener('error',fail,{once:true})})}
async function loadAudio(file){if(!file)return;stopPreview();status('Decoding soundtrack & finding beats…');try{
  if(state.audioUrl)URL.revokeObjectURL(state.audioUrl);
  state.audioUrl=URL.createObjectURL(file);
  audio.src=state.audioUrl;audio.load();
  const audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  try{state.audioBuffer=await audioCtx.decodeAudioData(await file.arrayBuffer());}finally{await audioCtx.close()}
  state.audioFile=file;
  state.analysis=summarizeAudio(Array.from({length:Math.min(2,state.audioBuffer.numberOfChannels)},(_,i)=>state.audioBuffer.getChannelData(i)),state.audioBuffer.sampleRate);
  $('trackTitle').textContent=file.name;$('trackInfo').textContent=state.analysis.confidence==='low'?'Quiet or complex track · tempo is approximate':'Audio analyzed · '+state.analysis.confidence+' BPM';
  $('trackLength').textContent=fmt(state.analysis.duration);
  $('bpmReadout').textContent=state.analysis.bpm.toFixed(1)+' BPM · '+state.analysis.confidence;
  $('bpmInput').value=String(state.analysis.bpm);
  $('customDuration').value=String(Math.round(state.analysis.duration*10)/10);
  drawWave();syncLengths();status('Soundtrack loaded: '+state.analysis.bpm.toFixed(1)+' BPM ('+state.analysis.confidence+').','ok');
  if(state.media.length)createPlan(false);
 }catch(err){state.audioBuffer=null;state.analysis=null;state.audioFile=null;status('Audio load failed: '+err.message,'error')}
}
function getImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Image cannot be decoded'));image.src=url})}
async function addMedia(files){if(!files?.length)return;status('Loading '+files.length+' media file(s)…');let added=0,failed=0;
 for(const file of files){
   if(!file.type.startsWith('video/')&&!file.type.startsWith('image/')){failed++;continue}
   const url=URL.createObjectURL(file);
   try{let el,kind,duration=0;
    if(file.type.startsWith('image/')){el=await getImage(url);kind='image';}
    else{el=document.createElement('video');el.src=url;el.muted=true;el.playsInline=true;el.preload='auto';await readMetadata(el,'loadedmetadata');duration=el.duration;kind='video';if(!Number.isFinite(duration)||duration<=0)throw Error('No video duration');}
    const id='m'+Date.now()+'_'+Math.random().toString(36).slice(2);
    state.media.push({id,name:file.name,kind,el,url,duration});
    added++;
   }catch(e){failed++;URL.revokeObjectURL(url);console.warn('Skipped media',file.name,e)}
 }
 updateMediaList();if(state.audioBuffer&&state.media.length)createPlan(false);
 status(added+' file(s) loaded'+(failed?' · '+failed+' unsupported or unreadable file(s)':'')+'.',failed?'error':'ok');
}
function updateMediaList(){const el=$('mediaList');el.replaceChildren();if(!state.media.length){el.textContent='Your footage collection will appear here.';return}
 for(const m of state.media){const chip=document.createElement('div');chip.className='media-chip';const ico=document.createElement('b');ico.textContent=m.kind==='video'?'▣':'▤';const name=document.createElement('span');name.textContent=m.name;name.title=m.name;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Remove '+m.name;remove.setAttribute('aria-label','Remove '+m.name);remove.addEventListener('click',()=>{stopPreview();if(m.kind==='video')m.el.pause();URL.revokeObjectURL(m.url);state.media=state.media.filter(x=>x.id!==m.id);updateMediaList();if(state.media.length&&state.audioBuffer)createPlan(false);else{state.plan=null;clearEdit();} });chip.append(ico,name,remove);el.append(chip);}
}
function chooseStyle(name){state.style=name;styleButtons.forEach(b=>b.classList.toggle('selected',b.dataset.style===name));}
function drawWave(){const w=wave.width,h=wave.height;waveCtx.clearRect(0,0,w,h);waveCtx.fillStyle='#151020';waveCtx.fillRect(0,0,w,h);
 const a=state.analysis;if(!a){waveCtx.fillStyle='#6f587e';waveCtx.font='12px sans-serif';waveCtx.fillText('Load a song to see its waveform',18,48);return}
 const envelope=a.amplitude,step=envelope.length/w;
 waveCtx.strokeStyle='#ba83da';waveCtx.lineWidth=2;waveCtx.beginPath();
 for(let x=0;x<w;x++){const from=Math.floor(x*step),to=Math.min(envelope.length,Math.max(from+1,Math.floor((x+1)*step)));let max=0;for(let j=from;j<to;j++)max=Math.max(max,envelope[j]);const size=clamp(max*3.2,0,1)*h*.44;waveCtx.moveTo(x,h/2-size);waveCtx.lineTo(x,h/2+size)}waveCtx.stroke();
 waveCtx.strokeStyle='#dea7f74d';waveCtx.lineWidth=1;
 for(const t of a.beats){if(t>a.duration)break;const x=t/a.duration*w;waveCtx.beginPath();waveCtx.moveTo(x,0);waveCtx.lineTo(x,h);waveCtx.stroke()}
 drawWaveHead();
}
function drawWaveHead(){if(!state.analysis)return;const x=state.position/state.analysis.duration*wave.width;waveCtx.strokeStyle='#fff';waveCtx.lineWidth=2;waveCtx.beginPath();waveCtx.moveTo(x,0);waveCtx.lineTo(x,wave.height);waveCtx.stroke();}
function seek(t){const d=duration();state.position=clamp(t,0,d);if(state.analysis){audio.currentTime=Math.min(Math.max(0,((state.position%state.analysis.duration)+state.analysis.duration)%state.analysis.duration),state.analysis.duration-.02)}if(state.playing)state.playStart=performance.now()-state.position*1000;renderFrame(state.position);updateTransport();}
function updateTransport(){const d=duration();$('previewSeek').value=d?String(Math.round(1000*state.position/d)):'0';$('currentTime').textContent=fmt(state.position)}
function sceneMedia(id){return state.media.find(x=>x.id===id)}
function chooseScene(id){state.selectedId=id;document.querySelectorAll('.shot').forEach(x=>x.classList.toggle('active',x.dataset.id===id));document.querySelectorAll('.scene-row').forEach(x=>x.style.borderColor=x.dataset.id===id?'#b986db':'#32273e')}
function updateTimeline(){const plan=state.plan;$('timelineBar').replaceChildren();$('sceneInspector').replaceChildren();
 if(!plan){clearEdit();return}
 $('sceneCount').textContent=plan.segments.length+' CUTS';$('exportScenes').textContent=String(plan.segments.length);
 const maxRows=150;
 const frag=document.createDocumentFragment();
 for(let i=0;i<plan.segments.length;i++){
  const seg=plan.segments[i],m=sceneMedia(seg.mediaId);
  const bar=document.createElement('button');bar.type='button';bar.className='shot';bar.style.width=(seg.end-seg.start)/plan.duration*100+'%';bar.dataset.id=seg.id;bar.title=(m?.name||'Clip')+' · '+fmt(seg.start)+'–'+fmt(seg.end);const label=document.createElement('span');label.textContent=(i+1).toString().padStart(2,'0');const sub=document.createElement('small');sub.textContent=m?.kind==='video'?'▣':'▤';bar.append(label,sub);bar.addEventListener('click',()=>{chooseScene(seg.id);seek(seg.start)});frag.append(bar);
 }
 $('timelineBar').append(frag);
 const list=document.createDocumentFragment();
 for(const seg of plan.segments.slice(0,maxRows)){
  const row=document.createElement('div');row.className='scene-row';row.dataset.id=seg.id;
  const index=document.createElement('span');index.className='scene-num';index.textContent='#'+String(Number(seg.id.slice(1))+1).padStart(2,'0');
  const label=document.createElement('div');label.className='scene-label';label.textContent=fmt(seg.start)+' → '+fmt(seg.end);const small=document.createElement('span');small.className='scene-time';small.textContent=(seg.end-seg.start).toFixed(2)+'s';label.append(small);
  const mediaSelect=document.createElement('select');mediaSelect.setAttribute('aria-label','Footage for scene '+seg.id);
  for(const m of state.media){const option=document.createElement('option');option.value=m.id;option.textContent=m.name;mediaSelect.append(option)}
  mediaSelect.value=seg.mediaId;mediaSelect.addEventListener('change',()=>{seg.mediaId=mediaSelect.value;seg.sourceOffset=0;seek(seg.start)});
  const effectSelect=document.createElement('select');effectSelect.setAttribute('aria-label','Visual effect for scene '+seg.id);
  for(const name of ['natural','punch','noir','glitch','dream','vhs']){const option=document.createElement('option');option.value=name;option.textContent=name;effectSelect.append(option)}
  effectSelect.value=seg.effect;effectSelect.addEventListener('change',()=>{seg.effect=effectSelect.value;renderFrame(state.position)});
  row.append(index,label,mediaSelect,effectSelect);row.addEventListener('click',e=>{if(e.target.tagName==='SELECT')return;chooseScene(seg.id);seek(seg.start)});list.append(row);
 }
 $('sceneInspector').append(list);
 if(plan.segments.length>maxRows){const note=document.createElement('p');note.style.color='#af9abb';note.style.fontSize='10px';note.textContent='Showing first '+maxRows+' scenes. Click any segment in the video track to preview it.';$('sceneInspector').append(note)}
 chooseScene(plan.segments[0]?.id);
}
function clearEdit(){$('timelineBar').textContent='Your edited shots will appear on this timeline.';$('sceneInspector').textContent='Generate an edit to inspect & customize individual scenes.';$('sceneCount').textContent='0 CUTS';$('exportScenes').textContent='0';renderFrame(0);}
function createPlan(randomize=true){if(!state.audioBuffer){status('Load a soundtrack first.','error');return}if(!state.media.length){status('Add at least one video or image first.','error');return}
 if(randomize)state.seed++;const instructions=$('directorPrompt').value.trim();const director=parseDirection(instructions,state.style);
 if(instructions)chooseStyle(director.style);
 try{state.plan=makePlan({duration:duration(),media:state.media,analysis:state.analysis,style:state.style,direction:instructions,seed:state.seed});
 if(!assertContinuous(state.plan))throw Error('Timeline has a gap');
 $('directorOutput').textContent=state.plan.director+' '+state.plan.segments.length+' shots choreographed to '+state.analysis.bpm.toFixed(1)+' BPM'+($('durationLock').checked?'. Song length is locked.':'. Custom length enabled.');
 syncSummary();updateTimeline();seek(0);$('emptyPreview').hidden=true;status('Beat-synced video edit ready. Preview, customize & export.','ok');
 }catch(err){status('Could not make edit: '+err.message,'error')}
}
function syncSummary(){syncLengthsSafe();drawWave();updateTransport()}
function syncLengthsSafe(){const d=duration();$('songDuration').textContent=fmt(state.analysis?.duration||0);$('videoDuration').textContent=fmt(d);$('exportLength').textContent=fmt(d);$('totalTime').textContent=fmt(d);$('timelineDuration').textContent=fmt(d);}
function setVideoMedia(m,target){if(m.kind!=='video'||!Number.isFinite(m.duration)||m.duration<=0)return;
 const desired=clamp(target%m.duration,0,Math.max(.01,m.duration-.06));
 if(Math.abs(m.el.currentTime-desired)>.19){try{m.el.currentTime=desired}catch{}}
 if(state.playing||state.rendering){if(m.el.paused)m.el.play().catch(()=>{});}else if(!m.el.paused){m.el.pause();}
}
function drawSource(m,seg,t,alpha=1){if(!m)return;
 const elapsed=Math.max(0,t-seg.start),target=seg.sourceOffset+elapsed;
 let el=m.el,iw=el.videoWidth||el.naturalWidth||1,ih=el.videoHeight||el.naturalHeight||1;
 if(m.kind==='video'){setVideoMedia(m,target);if(el.readyState<2)return}
 if(!iw||!ih)return;
 const w=canvas.width,h=canvas.height,zoom=1+.018*Math.sin(t*.55),scale=Math.max(w/iw,h/ih)*zoom;
 const dw=iw*scale,dh=ih*scale,dx=(w-dw)/2,dy=(h-dh)/2;
 ctx.save();ctx.globalAlpha=alpha;
 switch(seg.effect){case 'noir':ctx.filter='contrast(1.19) saturate(.55) brightness(.83)';break;case 'dream':ctx.filter='saturate(1.45) brightness(1.07) blur(1.2px)';break;case 'vhs':ctx.filter='contrast(1.13) saturate(.85)';break;case 'punch':ctx.filter='contrast(1.17) saturate(1.25)';break;case 'glitch':ctx.filter='contrast(1.28) saturate(1.5)';break;default:ctx.filter='none'}
 try{ctx.drawImage(el,dx,dy,dw,dh)}catch{}
 ctx.restore();
}
function drawFx(seg,t){
 const w=canvas.width,h=canvas.height,local=t-seg.start;
 ctx.save();
 const v=ctx.createRadialGradient(w/2,h/2,w*.15,w/2,h/2,w*.75);v.addColorStop(0,'#00000000');v.addColorStop(1,'#00000077');ctx.fillStyle=v;ctx.fillRect(0,0,w,h);
 if(seg.effect==='vhs'){ctx.fillStyle='#ffffff0f';for(let y=0;y<h;y+=5){ctx.fillRect(0,y,w,1)}ctx.fillStyle='#db75e422';ctx.fillRect(0,0,w,Math.max(2,h*.015))}
 if(seg.effect==='glitch'&&Math.floor(t*20)%9<2){const y=(Math.sin(t*8)*.5+.5)*h;ctx.fillStyle='#f46af829';ctx.fillRect(0,y,w,h*.05);ctx.fillStyle='#4dfce720';ctx.fillRect(w*.05,y+h*.01,w*.9,h*.015)}
 if(seg.effect==='punch'){const beats=state.analysis?.beats||[];const b=beats.find(x=>Math.abs(x-t)<.055);if(b!==undefined){ctx.fillStyle='#f0b4fc25';ctx.fillRect(0,0,w,h)}}
 if(seg.transition==='flash'&&local<.1){ctx.fillStyle='rgba(255,235,255,'+(.48*(1-local/.1))+')';ctx.fillRect(0,0,w,h)}
 if(seg.transition==='glitch'&&local<.14){ctx.fillStyle='rgba(203,91,222,'+(.38*(1-local/.14))+')';ctx.fillRect(0,0,w,h)}
 ctx.restore();
}
function renderFrame(t){const w=canvas.width,h=canvas.height;ctx.fillStyle='#130f1b';ctx.fillRect(0,0,w,h);const seg=state.plan&&findSegment(state.plan.segments,clamp(t,0,Math.max(0,state.plan.duration-.00001)));
 if(!seg){defaultCanvas();return}
 const media=sceneMedia(seg.mediaId);if(!media){defaultCanvas();return}
 if(state.lastMediaId&&state.lastMediaId!==media.id){const old=sceneMedia(state.lastMediaId);if(old?.kind==='video')old.el.pause()}
 state.lastMediaId=media.id;
 const local=t-seg.start;
 if(seg.transition==='dissolve'&&local<.22){const index=state.plan.segments.indexOf(seg);const prev=state.plan.segments[index-1];if(prev){drawSource(sceneMedia(prev.mediaId),prev,t,.9);drawSource(media,seg,t,clamp(local/.22,0,1));}else drawSource(media,seg,t)}
 else drawSource(media,seg,t);
 drawFx(seg,t);
}
function stopPreview(){if(state.raf)cancelAnimationFrame(state.raf);state.raf=0;state.playing=false;audio.pause();$('previewPlay').textContent='▶';for(const m of state.media){if(m.kind==='video')m.el.pause()}}
function tick(){if(!state.playing)return;const d=duration();let t=$('durationLock').checked?audio.currentTime:(performance.now()-state.playStart)/1000;if(!Number.isFinite(t))t=0;
 if(t>=d-.009){stopPreview();state.position=d;renderFrame(Math.max(0,d-.025));updateTransport();return}
 state.position=clamp(t,0,d);renderFrame(state.position);updateTransport();if(Math.floor(t*5)%3===0)drawWave();state.raf=requestAnimationFrame(tick)}
async function togglePreview(){if(state.rendering)return;if(!state.plan){status('Generate an edit to preview first.','error');return}
 if(state.playing){stopPreview();return}
 const d=duration();if(state.position>=d-.05)state.position=0;
 try{audio.loop=!$('durationLock').checked;audio.currentTime=clamp(state.position%(state.analysis?.duration||d),0,Math.max(0,(state.analysis?.duration||d)-.02));await audio.play();state.playStart=performance.now()-state.position*1000;state.playing=true;$('previewPlay').textContent='Ⅱ';state.raf=requestAnimationFrame(tick)}
 catch(e){status('Playback failed: '+e.message,'error')}
}
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function filename(){return ($('projectName').value.trim()||'GalaXia-AutoCut').replace(/[^a-z0-9 _-]/gi,'').replace(/\s+/g,'-').slice(0,70)}
function savePlan(){if(!state.plan){status('Generate an edit first.','error');return}const payload={version:1,creator:'GalaXia AutoCut Studio',audio:state.audioFile?.name,durationLock:$('durationLock').checked,audioDuration:state.analysis?.duration,videoDuration:state.plan.duration,tempo:state.analysis?.bpm,tempoConfidence:state.analysis?.confidence,direction:$('directorPrompt').value,aspect:$('aspect').value,media:state.media.map(({id,name,kind,duration})=>({id,name,kind,duration})),scenes:state.plan.segments};downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),filename()+'-edit-plan.json');status('Edit plan downloaded. This is metadata, not a rendered video.','ok')}
function renderCompatible(){
 if(!canvas.captureStream||!window.MediaRecorder||!(window.AudioContext||window.webkitAudioContext))return null;
 const candidates=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
 return candidates.find(t=>MediaRecorder.isTypeSupported(t))||null;
}
async function exportVideo(){
 if(state.rendering)return;
 if(!state.plan||!state.audioBuffer){status('Load audio + media and generate an edit first.','error');return}
 if(!assertContinuous(state.plan)){status('Cannot export: the edit contains a timeline gap.','error');return}
 const mime=renderCompatible();if(!mime){status('This browser cannot record WebM with audio. Try Chrome or Edge on a desktop, or download the edit plan.','error');return}
 stopPreview();state.rendering=true;$('exportBtn').disabled=true;$('generateBtn').disabled=true;$('renderProgress').hidden=false;$('renderProgress').value=0;status('Rendering in real time. Keep this tab visible until the file downloads…');
 let ac=null,src=null,recorder=null,stream=null,frameId=0,done=false;
 try{
  resizeCanvas();const length=state.plan.duration;
  ac=new (window.AudioContext||window.webkitAudioContext)();
  const dest=ac.createMediaStreamDestination();
  src=ac.createBufferSource();src.buffer=state.audioBuffer;src.loop=length>state.audioBuffer.duration+.01;src.connect(dest);src.connect(ac.destination);
  stream=canvas.captureStream(30);
  const recorded=new MediaStream([...stream.getVideoTracks(),...dest.stream.getAudioTracks()]);
  recorder=new MediaRecorder(recorded,{mimeType:mime,videoBitsPerSecond:Math.max(1200000,canvas.width*canvas.height*2.5)});
  const chunks=[];
  const finished=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};recorder.onerror=e=>reject(e.error||Error('Recorder failed'));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}))});
  await ac.resume();recorder.start(500);const startAt=ac.currentTime+.14;src.start(startAt);
  const paint=()=>{if(done)return;const t=Math.max(0,ac.currentTime-startAt);const at=Math.min(t,Math.max(0,length-.0001));state.position=at;renderFrame(at);updateTransport();$('renderProgress').value=Math.round(t/length*100);if(t<length){frameId=requestAnimationFrame(paint)}else{done=true;try{src.stop()}catch{};setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},50)}};
  frameId=requestAnimationFrame(paint);
  const blob=await finished;
  if(!blob.size)throw Error('Recorder returned an empty file');
  downloadBlob(blob,filename()+'.webm');status('Video downloaded · '+fmt(length)+' timeline · '+(blob.size/1024/1024).toFixed(1)+' MB. Container timing can vary by a frame.','ok');
 }catch(err){status('Render failed: '+err.message,'error')}finally{
  done=true;if(frameId)cancelAnimationFrame(frameId);try{if(src)src.stop()}catch{};try{if(recorder?.state==='recording')recorder.stop()}catch{};if(stream)stream.getTracks().forEach(track=>track.stop());try{await ac?.close()}catch{};
  state.rendering=false;$('exportBtn').disabled=false;$('generateBtn').disabled=false;$('renderProgress').hidden=true;for(const m of state.media){if(m.kind==='video')m.el.pause()}stopPreview();
 }
}
$('audioInput').addEventListener('change',e=>{loadAudio(e.target.files?.[0]);e.target.value=''});
$('mediaInput').addEventListener('change',e=>{addMedia([...e.target.files]);e.target.value=''});
function dropSupport(id,handler){const el=$(id);['dragenter','dragover'].forEach(event=>el.addEventListener(event,e=>{e.preventDefault();el.classList.add('drag-over')}));['dragleave','drop'].forEach(event=>el.addEventListener(event,e=>{e.preventDefault();el.classList.remove('drag-over')}));el.addEventListener('drop',e=>handler([...e.dataTransfer.files]))}
dropSupport('audioDrop',files=>loadAudio(files.find(f=>f.type.startsWith('audio/'))||files[0]));
dropSupport('mediaDrop',files=>addMedia(files));
for(const b of styleButtons)b.addEventListener('click',()=>{chooseStyle(b.dataset.style);$('directorPrompt').value='';if(state.audioBuffer&&state.media.length)createPlan(false)});
document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{$('directorPrompt').value=b.dataset.prompt;if(state.audioBuffer&&state.media.length)createPlan(false)}));
$('bpmInput').addEventListener('change',()=>{if(!state.analysis)return;const b=clamp(Number($('bpmInput').value)||state.analysis.bpm,62,190);state.analysis.bpm=b;const phase=state.analysis.phase||0,beat=60/b;state.analysis.beats=[];for(let t=phase;t<state.analysis.duration;t+=beat)state.analysis.beats.push(Number(t.toFixed(4)));$('bpmReadout').textContent=b.toFixed(1)+' BPM · manual';drawWave();if(state.media.length)createPlan(false)});
$('generateBtn').addEventListener('click',()=>createPlan(true));
$('shuffleBtn').addEventListener('click',()=>createPlan(true));
$('durationLock').addEventListener('change',()=>{stopPreview();syncLengths()});
$('customDuration').addEventListener('change',()=>{stopPreview();syncLengths()});
$('aspect').addEventListener('change',resizeCanvas);
$('quality').addEventListener('change',resizeCanvas);
$('previewPlay').addEventListener('click',togglePreview);
$('previewStop').addEventListener('click',()=>{stopPreview();seek(0)});
$('previewSeek').addEventListener('input',()=>seek(Number($('previewSeek').value)/1000*duration()));
wave.addEventListener('click',e=>{const x=(e.clientX-wave.getBoundingClientRect().left)/wave.getBoundingClientRect().width;seek(clamp(x,0,1)*(state.analysis?.duration||0))});
$('exportBtn').addEventListener('click',exportVideo);
$('downloadEdl').addEventListener('click',savePlan);
audio.addEventListener('ended',()=>{if(!audio.loop){stopPreview();seek(duration())}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing)stopPreview()});
window.addEventListener('beforeunload',()=>{state.media.forEach(x=>URL.revokeObjectURL(x.url));if(state.audioUrl)URL.revokeObjectURL(state.audioUrl)});
resizeCanvas();drawWave();syncLengthsSafe();status('Ready when your clips are.');
