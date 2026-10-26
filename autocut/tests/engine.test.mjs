import test from 'node:test';
import assert from 'node:assert/strict';
import {makePlan,assertContinuous,parseDirection,summarizeAudio,findSegment} from '../engine.mjs';
const media=[{id:'a',kind:'video',duration:2},{id:'b',kind:'image',duration:0}];
const analysis={bpm:120,beats:Array.from({length:600},(_,i)=>i*.5)};
test('locks video end to soundtrack duration without gaps',()=>{
 for(const seconds of [3.77,42.253,193.3]){
  const p=makePlan({duration:seconds,media,analysis});
  assert.equal(p.duration,seconds);assert.equal(p.segments.at(-1).end,seconds);assert.ok(assertContinuous(p));
 }
});
test('style directions choose concrete presets',()=>{assert.equal(parseDirection('Go glitchy & stutter hard').style,'Glitchcore');assert.equal(parseDirection('Slow dreamy shots').style,'Dreamwave')});
test('clips repeat safely and end accurately even with short sources',()=>{const p=makePlan({duration:81.7,media:[media[0]],analysis,style:'Bass Impact'});assert.ok(assertContinuous(p));assert.ok(p.segments.every(s=>s.mediaId==='a'));assert.equal(findSegment(p.segments,80)?.mediaId,'a')});
test('silence and tempo analysis fail gracefully',()=>{const sr=44100;const ch=new Float32Array(sr*3);const a=summarizeAudio([ch],sr);assert.equal(a.confidence,'low');assert.ok(a.bpm>=62);assert.ok(a.duration===3)});
test('simple pulse estimates BPM range',()=>{const sr=9000,d=18,ch=new Float32Array(sr*d);for(let sec=0;sec<d;sec+=.5){const off=Math.round(sec*sr);for(let j=0;j<230;j++)ch[off+j]=Math.sin(j*.3)*(1-j/230)}const a=summarizeAudio([ch],sr);assert.ok(a.bpm>=62&&a.bpm<=190);assert.ok(a.beats.length>12)});
test('rejects invalid timelines',()=>{assert.throws(()=>makePlan({duration:0,media,analysis}));assert.throws(()=>makePlan({duration:8,media:[],analysis}))});
