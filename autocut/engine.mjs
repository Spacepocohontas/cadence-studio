/* GalaXia AutoCut — deterministic local edit engine, no uploads required. */
export const PRESETS={
  'Bass Impact':{beats:2,transition:'flash',effect:'punch',description:'Fast bass hits, hard cuts, bright impacts.'},
  'Dark Cinema':{beats:4,transition:'dissolve',effect:'noir',description:'Moody pacing, fades & cinematic shadows.'},
  'Glitchcore':{beats:2,transition:'glitch',effect:'glitch',description:'Rapid cuts, RGB interference & stutters.'},
  'Dreamwave':{beats:6,transition:'dissolve',effect:'dream',description:'Floaty motion, slower shots & soft light.'},
  '90s Alt':{beats:3,transition:'flash',effect:'vhs',description:'Tape grit, sharp hits & vintage chaos.'},
  'Clean Social':{beats:3,transition:'cut',effect:'natural',description:'Crisp edits made for short-form video.'}
};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const fmt=s=>{if(!Number.isFinite(s))return '0:00';let t=Math.max(0,Math.floor(s));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
export function summarizeAudio(channels,sampleRate,limitSeconds=240){
  if(!channels?.length||!Number.isFinite(sampleRate)||sampleRate<=0)throw Error('Invalid decoded audio');
  const maxSamples=Math.min(channels[0].length,Math.round(sampleRate*limitSeconds));
  const step=Math.max(256,Math.round(sampleRate/90)),amp=[],flux=[];
  for(let i=0;i<maxSamples;i+=step){
    let total=0,n=0;
    for(let j=i;j<Math.min(maxSamples,i+step);j+=2){
      let value=0;
      for(let c=0;c<Math.min(2,channels.length);c++)value+=channels[c][j]||0;
      value/=Math.min(2,channels.length);
      total+=value*value;n++;
    }
    amp.push(Math.sqrt(total/Math.max(1,n)));
  }
  for(let i=0;i<amp.length;i++){
    const prev=amp[Math.max(0,i-1)],older=amp[Math.max(0,i-2)];
    flux.push(Math.max(0,(amp[i]-prev)+.35*(prev-older)));
  }
  const fps=sampleRate/step;
  const rms=Math.sqrt(amp.reduce((acc,v)=>acc+v*v,0)/Math.max(1,amp.length));
  const search=flux.slice(0,Math.min(flux.length,Math.floor(fps*60)));
  let best={bpm:120,score:-Infinity,lag:Math.round(fps/2)};
  const maxLag=Math.min(search.length-1,Math.floor(fps*60/62));
  for(let lag=Math.ceil(fps*60/190);lag<=maxLag;lag++){
    let score=0;
    for(let i=lag;i<search.length;i++)score+=search[i]*search[i-lag];
    const normalized=score/(Math.max(1,search.length-lag));
    if(normalized>best.score){best={bpm:60*fps/lag,score:normalized,lag}};
  }
  const fluxSorted=search.slice().sort((a,b)=>a-b);
  const threshold=Math.max(0.0001,fluxSorted[Math.floor(fluxSorted.length*.81)]||0);
  const transients=[];
  let last=-10;
  for(let i=1;i<flux.length-1;i++){
    if(flux[i]>threshold&&flux[i]>=flux[i-1]&&flux[i]>=flux[i+1]){
      const t=i/fps;
      if(t-last>.11){transients.push({time:t,strength:flux[i]});last=t}
    }
  }
  let confidence=best.score>threshold*threshold*.03 && rms>.001?'estimated':'low';
  if(transients.length<8)confidence='low';
  const bpm=clamp(Math.round(best.bpm*10)/10,62,190);
  const spacing=60/bpm;
  let phase=0,strongest=-Infinity;
  const candidates=transients.filter(v=>v.time<30).slice(0,100);
  for(const peak of candidates){
    let total=0;
    for(const p of candidates){
      const delta=Math.abs((p.time-peak.time)/spacing);
      const distance=Math.abs(delta-Math.round(delta));
      total+=p.strength*Math.exp(-distance*distance*35);
    }
    if(total>strongest){strongest=total;phase=peak.time%spacing}
  }
  const duration=channels[0].length/sampleRate;
  const beats=[];
  for(let t=phase;t<duration-.015;t+=spacing)beats.push(Number(t.toFixed(4)));
  return {bpm,confidence,rms,duration,amplitude:amp,fps,transients,beats,phase};
}
export function parseDirection(prompt,initial='Bass Impact'){
  const p=String(prompt||'').toLowerCase();let style=initial;
  if(/glitch|digital|pixel|stutter|robot|industrial/.test(p))style='Glitchcore';
  else if(/dream|ethereal|slow motion|soft|float|romantic/.test(p))style='Dreamwave';
  else if(/90s|nostalg|vhs|grunge|alt.rock|tape/.test(p))style='90s Alt';
  else if(/cinemat|noir|goth|dark|horror|film|moody/.test(p))style='Dark Cinema';
  else if(/clean|minimal|simple|tiktok|capcut|social/.test(p))style='Clean Social';
  else if(/bass|drop|hard|explos|rapid|fast|punch/.test(p))style='Bass Impact';
  const aggressive=/rapid|quick|fast|double.time|every beat|aggress|chaotic/.test(p);
  const restrained=/slow|linger|hold|long shot|gentle/.test(p);
  const beats=clamp(PRESETS[style].beats*(aggressive?.5:restrained?1.8:1),1,12);
  const message='Suggested '+style+' treatment: '+(aggressive?'faster cuts':restrained?'longer shots':'beat-led pacing')+', '+PRESETS[style].description.toLowerCase();
  return {style,beats,message};
}
function hash(s){let x=2166136261;for(let i=0;i<s.length;i++){x=Math.imul(x^s.charCodeAt(i),16777619)}return x>>>0}
export function makePlan({duration,media,analysis,style='Bass Impact',direction='',seed=0,beatsPerCut=null}){
  if(!Number.isFinite(duration)||duration<=0)throw Error('Load a soundtrack or choose a valid timeline length');
  if(!media||!media.length)throw Error('Add at least one video or image');
  const chosen=parseDirection(direction,style);
  const preset=PRESETS[chosen.style],beatStep=60/Math.max(62,analysis?.bpm||120);
  const bpc=clamp(beatsPerCut??chosen.beats,1,12);
  const preferred=clamp(beatStep*bpc,.36,9);
  const grid=(analysis?.beats||[]).filter(t=>t>0&&t<duration);
  const segments=[],len=media.length;
  let start=0,i=0;
  while(start<duration-.0005&&i<2400){
    const nextIdeal=Math.min(duration,start+preferred);
    const nearest=grid.reduce((prev,t)=>Math.abs(t-nextIdeal)<Math.abs(prev-nextIdeal)?t:prev,nextIdeal);
    let end=nextIdeal;
    if(nearest>start+.25&&Math.abs(nearest-nextIdeal)<Math.min(beatStep*.42,.24))end=nearest;
    end=Math.min(duration,Math.max(start+.25,end));
    if(end>duration-.24)end=duration;
    const pick=(i+seed)%len;
    const clip=media[pick];
    const sourceDuration=Math.max(.001,clip.duration||end-start);
    const span=end-start;
    const jitter=((hash(String(clip.id)+':'+i+':'+seed)%100)/100)*Math.max(0,sourceDuration-span);
    segments.push({id:'s'+i,start:Number(start.toFixed(5)),end:Number(end.toFixed(5)),mediaId:clip.id,sourceOffset:Number(jitter.toFixed(3)),transition:i===0?'cut':preset.transition,effect:preset.effect});
    start=end;i++;
  }
  if(segments.length)segments[segments.length-1].end=duration;
  return {segments,duration,style:chosen.style,director:chosen.message};
}
export function findSegment(segments,t){let lo=0,hi=segments.length-1;while(lo<=hi){let m=(lo+hi)>>1,s=segments[m];if(t<s.start)hi=m-1;else if(t>=s.end)lo=m+1;else return s}return segments[segments.length-1]||null}
export function assertContinuous(plan){if(!plan?.segments?.length)return false;let prev=0;for(const s of plan.segments){if(Math.abs(s.start-prev)>1e-4||s.end<=s.start)return false;prev=s.end}return Math.abs(prev-plan.duration)<1e-4}
