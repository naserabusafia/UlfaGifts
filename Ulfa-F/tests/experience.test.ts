import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedSections, parseMemoryDate } from '../src/features/nfc-experience/utils/sections.ts';
import { ACTIVE_SCALE, SLOT_ANGLE, PHOTO_SIZE_RATIO, angularDelta, pileWindow, releaseSlots, seededPose,
  signedOffset, wheelSlot, wheelWindow, wrapIndex } from '../src/features/nfc-experience/utils/wheel.ts';
import { demoSections } from '../src/features/nfc-experience/demo/sections.ts';
const photo = { id: 'photo', mediaType: 'IMAGE', url: '/photo.jpg', displayOrder: 1 };
test('backend order wins, including placing the wheel before Message', () => {
  assert.deepEqual(orderedSections([{ id: 'message', key: 'message', displayOrder: 20 },
    { id: 'wheel', key: 'photo_wheel', displayOrder: 0, media: [photo] }]).map(s => s.key), ['photo_wheel', 'message']);
});
test('only missing orders use the after-Message fallback, with empty reels omitted', () => {
  assert.deepEqual(orderedSections([{ id: 'next', key: 'timeline', displayOrder: 12 },
    { id: 'wheel', key: 'photo_wheel', media: [photo] }, { id: 'message', key: 'message', displayOrder: 10 }]).map(s=>s.key), ['message', 'photo_wheel', 'timeline']);
  assert.deepEqual(orderedSections([{id:'wheel',key:'photo_wheel',media:[]}]).map(s=>s.key), ['message']);
});
for (const count of [1,5,7,8,30,120,250]) test(`${count} photos: bounded window, unique visible indices and correct upcoming pile`, () => {
  for (let active=0; active<count; active++) {
    const slots=wheelWindow(active,count); const pile=pileWindow(active,count);
    assert.equal(slots.length,Math.min(7,count));
    assert.equal(new Set(slots.map(s=>s.index)).size,slots.length);
    assert.ok(slots.every(s=>Math.abs(s.offset)<=3 && s.offset===signedOffset(s.index,active,count)));
    assert.ok(slots.some(s=>s.index===active && s.offset===0));
    assert.ok(slots.length+pile.length<=21);
    assert.equal(pile.length,count<=7?0:Math.min(14,Math.max(3,Math.ceil((count-7)*.5))));
    assert.ok(pile.every((p,depth)=>p.index===wrapIndex(active+4+depth,count)));
    if(count>10) assert.ok(pile.every(p=>!slots.some(s=>s.index===p.index)));
  }
  assert.equal(wrapIndex(count,count),0); assert.equal(wrapIndex(-1,count),count-1);
});
test('45 degree geometry keeps neighbors inside the rim and active visibly above it', () => {
  const active=wheelSlot(0);
  assert.equal(active.scale,ACTIVE_SCALE);
  const pop=active.radius+PHOTO_SIZE_RATIO*active.scale/2-.5;
  assert.ok(pop/(PHOTO_SIZE_RATIO*active.scale)>.35);
  for(let offset=-3;offset<=3;offset++) {
    const slot=wheelSlot(offset); assert.equal(slot.angle,offset*SLOT_ANGLE);
    if(!offset) continue;
    assert.equal(slot.scale,1);
    const theta=slot.angle*Math.PI/180;
    for(const x of [-1,1]) for(const y of [-1,1]) {
      const half=PHOTO_SIZE_RATIO/2;
      const cx=slot.x+half*(x*Math.cos(theta)-y*Math.sin(theta));
      const cy=slot.y+half*(x*Math.sin(theta)+y*Math.cos(theta));
      assert.ok(Math.hypot(cx,cy)<.5);
    }
  }
});
test('pile poses are stable per id, varied and bounded', () => {
  const poses=Array.from({length:100},(_,i)=>seededPose(`photo-${i}`));
  assert.deepEqual(seededPose('stable'),seededPose('stable'));
  assert.ok(new Set(poses.map(p=>p.angle)).size>90);
  assert.ok(poses.every(p=>Math.abs(p.angle)<=25 && Math.abs(p.x)<=.18 && Math.abs(p.y)<=.1));
});
test('angular drag crosses the seam correctly and momentum adds no more than 3 slots', () => {
  assert.equal(angularDelta(-179,179),2); assert.equal(angularDelta(179,-179),-2);
  assert.equal(releaseSlots(-90,0),2); assert.equal(releaseSlots(90,0),-2);
  assert.equal(releaseSlots(-90,-10),5); assert.equal(releaseSlots(90,10),-5);
  assert.equal(releaseSlots(-15,-.1),0);
});
test('demo has localized preview texts and captions without overriding backend ordering', () => {
  for(const language of ['ar', 'en'] as const) for(const count of [1,5,7,8,30,120,250]) {
    const [wheel]=demoSections(count, language);
    assert.equal(wheel.media?.length,count); assert.equal(wheel.displayOrder,undefined);
    assert.ok(wheel.title && wheel.message);
    assert.ok(wheel.media?.every(m=>m.caption && (language === 'ar' ? /[\u0600-\u06ff]/.test(m.caption) : !/[\u0600-\u06ff]/.test(m.caption))));
    assert.ok(wheel.media?.every(m=>m.thumbnailUrl?.endsWith('-thumb.jpg')));
    assert.deepEqual(orderedSections([wheel]).map(s=>s.key),['message','photo_wheel']);
  }
});
test('demo includes voice note, calendar and film after the wheel', () => {
  for(const language of ['ar', 'en'] as const) {
    const sections=demoSections(30, language);
    assert.deepEqual(orderedSections(sections).map(s=>s.key),['message','photo_wheel','voice_note','memory_calendar','film_strip']);
    assert.ok(sections.every(s=>s.title && s.message));
  }
});
test('new sections are omitted without their media; calendar needs valid dates', () => {
  const voice={id:'v',mediaType:'VOICE_NOTE',url:'/v.wav',displayOrder:0};
  assert.deepEqual(orderedSections([{id:'a',key:'voice_note',media:[photo]},{id:'b',key:'film_strip',media:[]},
    {id:'c',key:'memory_calendar',media:[{...photo,memoryDate:'2026-02-30'}]}]).map(s=>s.key),['message']);
  assert.deepEqual(orderedSections([{id:'a',key:'voice_note',media:[voice]},{id:'b',key:'film_strip',media:[photo]},
    {id:'c',key:'memory_calendar',media:[{...photo,memoryDate:'2026-02-28'}]}]).map(s=>s.key),['message','voice_note','memory_calendar','film_strip']);
});
test('memory dates parse strictly', () => {
  assert.deepEqual(parseMemoryDate('2026-10-04'),{year:2026,month:9,day:4,key:'2026-10-04'});
  assert.deepEqual(parseMemoryDate('2026-10-04T00:00:00.000Z')?.key,'2026-10-04');
  for(const bad of [null,'','2026-13-01','2026-02-29','04/10/2026']) assert.equal(parseMemoryDate(bad),null);
});
