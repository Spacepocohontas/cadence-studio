(()=>{
'use strict';
var video=document.getElementById('video'), stage=document.getElementById('stage'), status=document.getElementById('status');
if(!video||!stage)return;
var state={enabled:false,deck:'B',sync:true,rateLock:true,videoId:null,visualSrc:null};
var originalLoad=null;
function say(t){if(status)status.textContent=t}
function audioEl(){return document.getElementById('audio'+state.deck)}
function deckName(){return document.getElementById('name'+state.deck)?.textContent||('Deck '+state.deck)}
function isAudioDeck(k){var n=(document.getElementById('name'+k)?.textContent||'').toLowerCase();return n&&n!=='no track loaded'&&!/\.(mp4|mov|m4v|webm|avi|mkv)(\s|$)/i.test(n)}
function build(){
 var old=document.getElementById('dubPanel');if(old)old.remove();
 var box=document.createElement('section');box.id='dubPanel';box.className='panel';box.style.marginTop='10px';
 box.innerHTML='<div class="sectionTitle">DUB / VOICEOVER WORKSTATION <span id="dubState">READY</span></div>'+
 '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;align-items:end">'+
 '<label>REPLACEMENT AUDIO<select id="dubDeck"><option value="A">DECK A</option><option value="B">DECK B</option></select></label>'+
 '<label>SYNC MODE<select id="dubSync"><option value="video">VIDEO MASTER</option><option value="free">FREE DECK PLAYBACK</option></select></label>'+
 '<label>SYNC TOLERANCE<input id="dubTol" type="range" min="0.03" max="0.5" step="0.01" value="0.08"></label>'+
 '</div><div class="toolbar" style="margin-top:8px">'+
 '<button id="dubPlay">▶ PLAY DUB</button><button id="dubPause">⏸ PAUSE</button><button id="dubReset">↺ RESET SYNC</button><button id="dubMute">🔇 ORIGINAL AUDIO: OFF</button><button id="dubRecord">⏺ RECORD DUB</button><button id="dubKeep">📌 KEEP VIDEO SOURCE</button>'+
 '</div><div id="dubInfo" class="settingNote">Load a video as the visual source, load your replacement audio to the other deck, mute the original soundtrack, then Play Dub.</div>';
 stage.parentNode.insertBefore(box,stage);
 var sel=document.getElementById('dubDeck');sel.value=state.deck;
 sel.onchange=function(){state.deck=sel.value;refresh()};
 document.getElementById('dubSync').onchange=function(e){state.sync=e.target.value==='video';refresh()};
 document.getElementById('dubPlay').onclick=play;
 document.getElementById('dubPause').onclick=pause;
 document.getElementById('dubReset').onclick=reset;
 document.getElementById('dubMute').onclick=function(){var b=document.getElementById('muteMain');if(b)b.click();refresh()};
 document.getElementById('dubKeep').onclick=function(){rememberVideo();say('Video source pinned for dubbing.')};
 document.getElementById('dubRecord').onclick=recordDub;
 refresh();
}
function rememberVideo(){if(video.src){state.visualSrc=video.src;state.videoId=video.dataset.mediaId||null;state.enabled=true}}
function restoreVideo(){if(!state.visualSrc||video.src===state.visualSrc)return;video.src=state.visualSrc;video.muted=true;video.load();video.style.display='block';var empty=document.getElementById('empty');if(empty)empty.style.display='none'}
function wrapLoader(){if(!window.CadenceRuntime||originalLoad)return;if(!window.CadenceRuntime.loadDeck)return;originalLoad=window.CadenceRuntime.loadDeck;window.CadenceRuntime.loadDeck=function(k,item){var before=video.src;var beforeId=video.dataset.mediaId||null;var wasVideo=!!before&&video.style.display!=='none';var r=originalLoad(k,item);if(item&&item.kind==='video'){state.visualSrc=video.src;state.videoId=item.id;state.enabled=true;video.dataset.mediaId=item.id}else if(wasVideo){state.visualSrc=before;state.videoId=beforeId;setTimeout(restoreVideo,0)}setTimeout(refresh,0);return r}}
function findVideoDeck(){for(var k of ['A','B']){var n=(document.getElementById('name'+k)?.textContent||'').toLowerCase();if(/\.(mp4|mov|m4v|webm|avi|mkv)(\s|$)/i.test(n))return k}return null}
function refresh(){
 var a=audioEl(),s=document.getElementById('dubState'),info=document.getElementById('dubInfo'),mb=document.getElementById('muteMain');
 if(!s)return;
 var vd=findVideoDeck();
 if(vd&&!state.visualSrc)rememberVideo();
 s.textContent=state.enabled?'DUB READY':'READY';
 var originalMuted=mb&&/ON$/.test(mb.textContent||'');
 document.getElementById('dubMute').textContent='🔇 ORIGINAL AUDIO: '+(originalMuted?'ON':'OFF');
 if(info)info.textContent=(state.visualSrc?'Visual source loaded. ':'No video source yet. ')+(a&&a.src&&a.duration?'Replacement: '+deckName()+'. ':'Load replacement audio to Deck A or B. ')+(state.sync?'Video is the master clock.':'Free deck playback enabled.');
}
async function play(){
 if(!video.src)return say('Load a video first.');
 var a=audioEl();if(!a||!a.src)return say('Load replacement audio on '+state.deck+' first.');
 try{
  if(window.CadenceRuntime?.ensure){window.CadenceRuntime.ensure();var c=window.CadenceRuntime.context();if(c)c.resume()}
  if(state.sync){a.currentTime=video.currentTime; a.playbackRate=video.playbackRate||1}
  await Promise.all([video.play(),a.play()]);state.enabled=true;refresh();say('Dubbing: video + '+state.deck+' synchronized.');
 }catch(e){say('Playback needs a user tap or the media format is unsupported.')}
}
function pause(){var a=audioEl();video.pause();if(a)a.pause();refresh();say('Dub paused.');}
function reset(){var a=audioEl();video.pause();if(a)a.pause();video.currentTime=0;if(a)a.currentTime=0;refresh();say('Dub reset to 0:00.');}
var timer=0;
function tick(){clearTimeout(timer);timer=setTimeout(function(){if(state.sync&&!video.paused){var a=audioEl();if(a&&!a.paused){var drift=a.currentTime-video.currentTime;var tol=Number(document.getElementById('dubTol')?.value||.08);if(Math.abs(drift)>tol)a.currentTime=video.currentTime;else if(state.rateLock&&Math.abs(drift)>.025)a.playbackRate=Math.max(.95,Math.min(1.05,1-drift*.12));}}tick()},120)}
video.addEventListener('play',function(){if(state.sync){var a=audioEl();if(a&&a.paused)a.play().catch(()=>{})}});
video.addEventListener('pause',function(){if(state.sync){var a=audioEl();if(a&&!a.paused)a.pause()}});
video.addEventListener('seeking',function(){if(state.sync){var a=audioEl();if(a&&Math.abs(a.currentTime-video.currentTime)>.04)a.currentTime=video.currentTime}});
video.addEventListener('ended',function(){var a=audioEl();if(a)a.pause();refresh()});
function recordDub(){
 if(!window.CadenceRuntime||!window.CadenceRuntime.destination){say('Audio recording graph is not ready.');return}
 if(!video.src){say('Load a video first.');return}
 var a=audioEl();if(!a||!a.src){say('Load replacement audio first.');return}
 try{
  var c=document.createElement('canvas'),w=1280,h=720;c.width=w;c.height=h;var x=c.getContext('2d');
  var stream=c.captureStream(30);window.CadenceRuntime.destination().stream.getAudioTracks().forEach(function(t){stream.addTrack(t)});
  var types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];var mime=types.find(function(t){try{return MediaRecorder.isTypeSupported(t)}catch(e){return false}});if(!mime)throw Error('No supported video recording format');var rec=new MediaRecorder(stream,{mimeType:mime}),chunks=[];
  function frame(){if(!rec||rec.state==='inactive')return;x.fillStyle='#000';x.fillRect(0,0,w,h);var vw=video.videoWidth||w,vh=video.videoHeight||h,sc=Math.min(w/vw,h/vh),dw=vw*sc,dh=vh*sc;x.drawImage(video,(w-dw)/2,(h-dh)/2,dw,dh);requestAnimationFrame(frame)}
  rec.ondataavailable=function(e){if(e.data.size)chunks.push(e.data)};
  rec.onstop=function(){var blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),aEl=document.createElement('a');aEl.href=url;aEl.download='cadence-dub.'+(mime.indexOf('mp4')>=0?'mp4':'webm');aEl.click();setTimeout(()=>URL.revokeObjectURL(url),5000);say('Dub recording exported.');document.getElementById('dubRecord').textContent='⏺ RECORD DUB'};
  rec.start(250);document.getElementById('dubRecord').textContent='⏹ STOP DUB';say('Recording dub… tap STOP DUB when finished.');frame();
  video.onended=function(){if(rec.state!=='inactive')rec.stop()};
  play();
  document.getElementById('dubRecord').onclick=function(){if(rec.state!=='inactive')rec.stop();else recordDub()};
 }catch(e){say('Dub recording is unavailable in this browser.');}
}
function init(){wrapLoader();build();tick();setInterval(function(){wrapLoader();refresh()},1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
