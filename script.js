const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const slider = document.getElementById('t'), clock = document.getElementById('clock'), playBtn = document.getElementById('play');
let W, H, time = 0.5, playing = true, last = 0, live = true;

const lerp = (a, b, k) => a + (b - a) * k;
const mix = (c1, c2, k) => c1.map((v, i) => Math.round(lerp(v, c2[i], k)));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

// Sky colour keyframes across the day: [time, top, bottom]
const SKY = [
  [0.00, [8,10,30],    [20,24,60]],
  [0.22, [30,30,80],   [255,140,90]],   // dawn
  [0.35, [70,150,230], [190,225,255]],
  [0.50, [40,120,225], [150,210,255]],  // noon
  [0.68, [70,130,220], [255,200,140]],
  [0.77, [60,40,100],  [255,110,70]],   // sunset
  [0.86, [14,16,45],   [50,40,90]],
  [1.00, [8,10,30],    [20,24,60]]
];
function skyAt(t) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i], b = SKY[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]);
      return [mix(a[1], b[1], k), mix(a[2], b[2], k)];
    }
  }
  return [SKY[0][1], SKY[0][2]];
}

// Scene objects
let shoot = null, curAct = 'walk', wx = 0;
const WX = ['Clear', 'Rain', 'Snow', 'Storm'], drops = Array.from({length: 240}, () => ({x: Math.random(), y: Math.random(), k: Math.random()}));
const flashEl = document.getElementById('flash');
let stars = [], clouds = [], birds = [], flies = [], layers = [];
function seed() {
  stars = Array.from({length: 180}, () => ({x: Math.random(), y: Math.random() * .6, r: Math.random() * 1.4 + .3, p: Math.random() * 6}));
  clouds = Array.from({length: 7}, () => ({x: Math.random(), y: .08 + Math.random() * .3, s: .6 + Math.random() * .9, v: .004 + Math.random() * .008}));
  birds = Array.from({length: 6}, (_, i) => ({x: -.1 - i * .05, y: .18 + Math.random() * .15, v: .03 + Math.random() * .01, p: Math.random() * 6}));
  flies = Array.from({length: 40}, () => ({x: Math.random(), y: .65 + Math.random() * .3, p: Math.random() * 6, s: .3 + Math.random()}));
  // Mountain layers: base height, amplitude, frequency, seed, darkness
  layers = [
    {base: .52, amp: .16, f: 2.2, s: 1.3, d: .35},
    {base: .60, amp: .13, f: 3.1, s: 4.1, d: .55},
    {base: .70, amp: .09, f: 4.3, s: 7.7, d: .78}
  ];
}
function resize() { W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio; }
addEventListener('resize', resize); resize(); seed();

// Daylight 0 (night) to 1 (full day)
const daylight = t => Math.max(0, Math.min(1, Math.sin((t - 0.25) * Math.PI * 2 / 1.0 * 1) * 1.4 + 0.1));

function ridge(L, t, offset) {
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 6) {
    const n = x / W * L.f * 6.283 + L.s;
    const y = H * (L.base - L.amp * (Math.sin(n) * .5 + Math.sin(n * 2.3 + 1) * .3 + Math.sin(n * 5.1) * .1) - L.amp * .6);
    ctx.lineTo(x, y + offset);
  }
  ctx.lineTo(W, H); ctx.closePath();
}

const CAST = [{"n":"Luna","r":"Stargazer","a":"telescope","x":0.5,"c":"Luna maps the winter stars from the end of the dock.","l":{"sk":[168,116,84],"sh":[110,90,190],"pa":[40,42,70],"ha":[18,12,28],"hs":1,"acc":"beanie","ac":[235,120,160]}},{"n":"Ravi","r":"Night fisher","a":"fish","x":0.46,"c":"Ravi waits for a bite under the lantern light.","l":{"sk":[110,76,56],"sh":[60,110,90],"pa":[35,45,60],"ha":[10,8,8],"hs":0,"acc":"cap","ac":[210,170,60]}},{"n":"Mina","r":"Sound sleeper","a":"sleep","x":0.42,"c":"Mina is fast asleep in the cabin while the aurora glows.","l":{"sk":[232,180,142],"sh":[200,200,200],"pa":[60,60,60],"ha":[40,30,20],"hs":0,"acc":"none"}},{"n":"Tomás","r":"Night reader","a":"read","x":0.44,"c":"Tomás finishes a novel by the lantern.","l":{"sk":[198,146,104],"sh":[180,70,60],"pa":[50,50,60],"ha":[60,40,25],"hs":0,"acc":"glasses"}},{"n":"Noor","r":"Early baker","a":"eat","x":0.42,"c":"Noor brews coffee long before the sun is up.","l":{"sk":[232,180,142],"sh":[240,240,235],"pa":[60,70,90],"ha":[90,50,30],"hs":2,"acc":"none"}},{"n":"Kenji","r":"Yogi","a":"stretch","x":0.44,"c":"Kenji greets the mist with a slow morning stretch.","l":{"sk":[245,208,176],"sh":[70,160,150],"pa":[40,50,70],"ha":[15,12,10],"hs":0,"acc":"none"}},{"n":"Ella","r":"Jogger","a":"run","x":0.4,"c":"Ella runs the dock before work.","l":{"sk":[168,116,84],"sh":[250,120,60],"pa":[30,30,40],"ha":[30,20,18],"hs":2,"acc":"phones","ac":[40,40,40]}},{"n":"Jack","r":"Breakfast lover","a":"eat","x":0.42,"c":"Jack has pancakes by the lake.","l":{"sk":[232,180,142],"sh":[60,120,200],"pa":[70,70,80],"ha":[200,140,60],"hs":0,"acc":"none"}},{"n":"Priya","r":"Commuter","a":"walk","x":0.4,"c":"Priya walks to the village with her backpack.","l":{"sk":[110,76,56],"sh":[200,60,110],"pa":[40,40,70],"ha":[15,10,10],"hs":1,"acc":"pack","ac":[60,100,160]}},{"n":"Leo","r":"Developer","a":"work","x":0.42,"c":"Leo ships code with a view of the lake.","l":{"sk":[245,208,176],"sh":[90,90,100],"pa":[40,50,80],"ha":[20,20,25],"hs":0,"acc":"glasses"}},{"n":"Sofia","r":"Painter","a":"paint","x":0.4,"c":"Sofia paints the mountains in the spring breeze.","l":{"sk":[198,146,104],"sh":[250,210,90],"pa":[90,60,120],"ha":[100,40,30],"hs":2,"acc":"hat","ac":[220,90,70]}},{"n":"Marco","r":"Angler","a":"fish","x":0.46,"c":"Marco fishes at the quiet end of the dock.","l":{"sk":[232,180,142],"sh":[50,140,90],"pa":[110,90,60],"ha":[50,35,25],"hs":0,"acc":"hat","ac":[180,150,90]}},{"n":"Hana","r":"Picnicker","a":"eat","x":0.42,"c":"Hana has a picnic lunch in the sun.","l":{"sk":[245,208,176],"sh":[240,180,200],"pa":[200,200,230],"ha":[15,10,15],"hs":1,"acc":"none"}},{"n":"Ben","r":"Rower","a":"boat","x":0.63,"c":"Ben rows across the lake.","l":{"sk":[168,116,84],"sh":[230,230,240],"pa":[50,60,90],"ha":[30,25,20],"hs":0,"acc":"cap","ac":[60,110,200]}},{"n":"Zara","r":"Student","a":"read","x":0.42,"c":"Zara studies for exams on the dock.","l":{"sk":[110,76,56],"sh":[130,80,170],"pa":[40,40,60],"ha":[20,12,14],"hs":1,"acc":"phones","ac":[230,230,230]}},{"n":"Amir","r":"Guitarist","a":"guitar","x":0.45,"c":"Amir plays an easy afternoon tune.","l":{"sk":[198,146,104],"sh":[220,100,50],"pa":[60,70,100],"ha":[25,18,14],"hs":0,"acc":"beanie","ac":[60,60,70]}},{"n":"Chloe","r":"Dancer","a":"dance","x":0.45,"c":"Chloe dances to a song only she can hear.","l":{"sk":[232,180,142],"sh":[240,90,150],"pa":[40,40,50],"ha":[200,60,40],"hs":2,"acc":"none"}},{"n":"Dev","r":"Gardener","a":"walk","x":0.4,"c":"Dev gathers fallen leaves along the dock.","l":{"sk":[168,116,84],"sh":[110,160,80],"pa":[90,70,50],"ha":[30,22,18],"hs":0,"acc":"hat","ac":[200,170,100]}},{"n":"Nina","r":"Sunset runner","a":"run","x":0.4,"c":"Nina chases the sunset along the shore.","l":{"sk":[245,208,176],"sh":[60,80,200],"pa":[240,240,240],"ha":[40,30,25],"hs":1,"acc":"phones","ac":[255,120,80]}},{"n":"Carlos","r":"Cook","a":"eat","x":0.42,"c":"Carlos serves dinner by lantern light.","l":{"sk":[198,146,104],"sh":[230,230,230],"pa":[60,60,70],"ha":[15,10,8],"hs":0,"acc":"cap","ac":[200,50,40]}},{"n":"Mei","r":"Campfire singer","a":"guitar","x":0.37,"c":"Mei sings by the campfire as embers rise.","l":{"sk":[245,208,176],"sh":[240,170,60],"pa":[40,50,80],"ha":[10,8,12],"hs":1,"acc":"scarf","ac":[200,60,70]}},{"n":"Oliver","r":"Writer","a":"work","x":0.44,"c":"Oliver writes the next chapter of his book.","l":{"sk":[232,180,142],"sh":[80,90,120],"pa":[50,50,60],"ha":[120,80,40],"hs":0,"acc":"glasses"}},{"n":"Fatima","r":"Meditator","a":"stretch","x":0.46,"c":"Fatima meditates as the lake goes still.","l":{"sk":[110,76,56],"sh":[100,200,190],"pa":[60,50,90],"ha":[12,10,12],"hs":1,"acc":"scarf","ac":[240,200,100]}},{"n":"Sam","r":"Night walker","a":"walk","x":0.4,"c":"Sam walks home through the fireflies.","l":{"sk":[168,116,84],"sh":[70,70,90],"pa":[30,30,45],"ha":[15,12,10],"hs":0,"acc":"scarf","ac":[220,60,60]}}];
const AMB = Array(24).fill('');
[5,6].forEach(h => AMB[h] = 'mist'); [10,16].forEach(h => AMB[h] = 'petal'); [17,18].forEach(h => AMB[h] = 'leaf'); [20,21].forEach(h => AMB[h] = 'ember');
const tone = (c, d) => rgb(mix(c.map(v => v * .28 | 0), c, .15 + .85 * d));
let epHr = -1, footBg = '';
const footEl = document.getElementById('foot');
function actOf(n) {
  n = n.toLowerCase();
  if (/sleep|bed|nap|rest/.test(n)) return 'sleep';
  if (/wake|stretch|yoga|meditat/.test(n)) return 'stretch';
  if (/breakfast|lunch|dinner|eat|meal|tea|coffee|snack/.test(n)) return 'eat';
  if (/work|study|project|code|read|class|office|homework/.test(n)) return 'work';
  if (/exercise|gym|run|jog|workout|sport|football|cricket/.test(n)) return 'run';
  return 'walk';
}
function limb(x1, y1, x2, y2, w, c) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function windmill(L, col, now) {
  const u = devicePixelRatio, x = W * .66, n = x / W * L.f * 6.283 + L.s;
  const y = H * (L.base - L.amp * (Math.sin(n) * .5 + Math.sin(n * 2.3 + 1) * .3 + Math.sin(n * 5.1) * .1) - L.amp * .6);
  const c = rgb(mix(col, [20,20,30], .35)), h = 34 * u;
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 7 * u, y + 2 * u); ctx.lineTo(x - 4 * u, y - h); ctx.lineTo(x + 4 * u, y - h); ctx.lineTo(x + 7 * u, y + 2 * u); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 2.5 * u; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) { const a = now / 1800 + k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + Math.cos(a) * 26 * u, y - h + Math.sin(a) * 26 * u); ctx.stroke(); }
}
function person(x, gy, u, act, now, dl, dir, look) {
  const skin = tone(look.sk, dl), shirt = tone(look.sh, dl), pants = tone(look.pa, dl), hair = tone(look.ha, dl), wood = rgb(mix([30,22,16], [140,98,64], dl));
  const sit = ['eat','work','read','guitar','fish','boat'].includes(act), moving = act === 'walk' || act === 'run', dnc = act === 'dance';
  const sw = (moving || dnc) ? Math.sin(now / (act === 'run' ? 140 : dnc ? 220 : 280)) : 0, sp = sw * (act === 'run' ? 1 : dnc ? .5 : .6);
  const hx = x, hy = gy - (sit ? 21 : 29) * u - ((moving || dnc) ? Math.abs(sw) * (act === 'run' ? 3 : dnc ? 5 : 1.5) * u : 0);
  const tx = hx + (act === 'run' ? 4 * u * dir : 0), ty = hy - 26 * u, shy = ty + 3 * u, tb = x + dir * 22 * u;
  if (sit) {
    ctx.fillStyle = wood;
    if (act === 'eat' || act === 'work') { ctx.fillRect(tb - 18 * u, gy - 26 * u, 36 * u, 4 * u); ctx.fillRect(tb - 2 * u, gy - 22 * u, 4 * u, 22 * u); }
    if (act !== 'boat') { ctx.fillRect(x - 9 * u, gy - 18 * u, 18 * u, 3 * u); ctx.fillRect(x - 1.5 * u, gy - 15 * u, 3 * u, 15 * u); }
    if (act === 'work') {
      ctx.fillStyle = '#2a2f3a'; ctx.fillRect(tb - 9 * u, gy - 29 * u, 18 * u, 3 * u);
      ctx.fillStyle = `rgba(130,200,255,${.65 + .3 * (1 - dl)})`; ctx.fillRect(tb + dir * 8 * u - 1.5 * u, gy - 44 * u, 3 * u, 15 * u);
    } else if (act === 'eat') {
      ctx.fillStyle = '#f1efe6'; ctx.beginPath(); ctx.ellipse(tb - dir * 6 * u, gy - 27 * u, 7 * u, 2 * u, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#d9a35c'; ctx.fillRect(tb + dir * 6 * u - 3 * u, gy - 33 * u, 6 * u, 7 * u);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.2 * u;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(tb + dir * 6 * u + i * 2 * u, gy - 34 * u); ctx.quadraticCurveTo(tb + dir * 6 * u + i * 2 * u + Math.sin(now / 300 + i) * 3 * u, gy - 40 * u, tb + dir * 6 * u + i * 2 * u, gy - 46 * u); ctx.stroke(); }
    }
  }
  if (act === 'paint') {
    const e0 = x + dir * 28 * u;
    limb(e0 - 8 * u, gy, e0 - 2 * u, gy - 34 * u, 2 * u, wood); limb(e0 + 8 * u, gy, e0 + 2 * u, gy - 34 * u, 2 * u, wood);
    ctx.fillStyle = '#f4efe3'; ctx.fillRect(e0 - 11 * u, gy - 50 * u, 22 * u, 24 * u);
    ['#e4572e', '#2e86ab', '#f6c85f'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(e0 - 6 * u + i * 6 * u, gy - 42 * u + Math.sin(i * 2) * 4 * u, 3.2 * u, 0, 6.283); ctx.fill(); });
  }
  if (act === 'telescope') {
    const e0 = x + dir * 10 * u;
    limb(e0, gy - 58 * u, x + dir * 2 * u, gy, 2 * u, wood); limb(e0, gy - 58 * u, x + dir * 20 * u, gy, 2 * u, wood);
    limb(e0, gy - 60 * u, x + dir * 36 * u, gy - 88 * u, 5 * u, '#8892a6');
  }
  if (sit) { limb(hx, hy, hx + dir * 16 * u, hy, 6 * u, pants); limb(hx + dir * 16 * u, hy, hx + dir * 16 * u, gy, 5 * u, pants); }
  else for (const k of [1, -1]) limb(hx, hy, hx + Math.sin(sp * k) * 18 * u, hy + Math.cos(sp * k) * 28 * u, 6 * u, pants);
  limb(hx, hy, tx, ty, 11 * u, shirt);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(tx, ty - 10 * u, 8 * u, 0, 6.283); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(tx - dir * 1 * u, ty - 11 * u, 8.8 * u, Math.PI * 1.02, Math.PI * 2.05); ctx.fill();
  ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(tx + dir * 3.5 * u, ty - 10 * u, 1 * u, 0, 6.283); ctx.fill();
  const h2 = ty - 10 * u, ac = tone(look.ac || [200,60,60], dl), a = look.acc;
  if (look.hs === 1) { ctx.fillStyle = hair; ctx.fillRect(tx - 9 * u, h2, 4.5 * u, 15 * u); ctx.fillRect(tx + 4.5 * u, h2, 4.5 * u, 15 * u); }
  if (look.hs === 2) { ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(tx, h2 - 10 * u, 4.5 * u, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = ac; ctx.strokeStyle = ac;
  if (a === 'cap') { ctx.beginPath(); ctx.arc(tx, h2 - u, 8.8 * u, Math.PI, 0); ctx.fill(); ctx.fillRect(tx, h2 - 2 * u, dir * 12 * u, 2.6 * u); }
  if (a === 'beanie') { ctx.beginPath(); ctx.arc(tx, h2 - u, 8.8 * u, Math.PI, 0); ctx.fill(); ctx.fillRect(tx - 8.8 * u, h2 - 3 * u, 17.6 * u, 3 * u); ctx.beginPath(); ctx.arc(tx, h2 - 10.5 * u, 2.6 * u, 0, 6.283); ctx.fill(); }
  if (a === 'hat') { ctx.fillRect(tx - 14 * u, h2 - 3 * u, 28 * u, 2.6 * u); ctx.fillRect(tx - 7 * u, h2 - 12 * u, 14 * u, 9.5 * u); }
  if (a === 'phones') { ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.arc(tx, h2 - u, 9 * u, Math.PI, 0); ctx.stroke(); ctx.fillRect(tx - 10 * u, h2 - 3 * u, 4 * u, 7 * u); ctx.fillRect(tx + 6 * u, h2 - 3 * u, 4 * u, 7 * u); }
  if (a === 'glasses') { ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.arc(tx + dir * 3.5 * u, h2, 2.6 * u, 0, 6.283); ctx.arc(tx - dir * u, h2, 2.6 * u, 0, 6.283); ctx.stroke(); }
  if (a === 'scarf') { limb(tx - 6 * u, ty + 2 * u, tx + 6 * u, ty + 2 * u, 5 * u, ac); limb(tx - dir * 4 * u, ty + 3 * u, tx - dir * 8 * u, ty + 16 * u, 4 * u, ac); }
  if (a === 'pack') ctx.fillRect(Math.min(tx - dir * 6 * u, tx - dir * 14 * u), ty + u, 8 * u, 20 * u);
  [1, -1].forEach(k => {
    let ex, ey;
    if (moving) { ex = tx + Math.sin(-sp * k) * 17 * u; ey = shy + Math.cos(sp * k) * 17 * u; }
    else if (act === 'stretch') { const a = .5 + .5 * Math.sin(now / 800); ex = tx + k * (9 + 8 * (1 - a)) * u; ey = shy + (14 - 32 * a) * u; }
    else if (act === 'fish') { ex = tx + dir * 13 * u; ey = shy + 10 * u; }
    else if (act === 'read') { ex = tx + dir * 8 * u; ey = shy + 10 * u; }
    else if (act === 'telescope') { ex = tx + dir * 9 * u; ey = shy + u; }
    else if (act === 'boat') { ex = tx + dir * 13 * u + Math.sin(now / 500) * 5 * u; ey = shy + 12 * u; }
    else if (act === 'guitar') { ex = k > 0 ? tx + dir * 9 * u : tx + dir * 26 * u; ey = k > 0 ? shy + 16 * u + Math.sin(now / 110) * 5 * u : shy + 8 * u; }
    else if (act === 'paint') { ex = k > 0 ? tx + dir * (24 + Math.sin(now / 300) * 5) * u : tx + dir * 5 * u; ey = k > 0 ? shy + 4 * u + Math.cos(now / 400) * 6 * u : shy + 16 * u; }
    else if (dnc) { ex = tx + k * 14 * u; ey = shy - 10 * u + Math.sin(now / 220 + k * 1.6) * 12 * u; }
    else if (act === 'work') { ex = tx + dir * 19 * u; ey = shy + 12 * u + Math.sin(now / 80 + k) * 1.5 * u; }
    else if (act === 'eat') { const m = k > 0 && Math.sin(now / 1000) > .2; ex = tx + dir * (m ? 6 : 17) * u; ey = shy + (m ? -9 : 12) * u; }
    else { const wv = k > 0 && Math.sin(now / 3000) > .82; ex = tx + (wv ? dir * 10 * u : k * 6 * u); ey = shy + (wv ? -14 * u + Math.sin(now / 90) * 3 * u : 18 * u); }
    limb(tx, shy, ex, ey, 4.5 * u, skin);
  });
  if (act === 'fish') {
    const px = tx + dir * 46 * u, py = shy - 22 * u;
    limb(tx + dir * 12 * u, shy + 10 * u, px, py, 2 * u, '#6b4a32');
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = u; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, gy + 34 * u); ctx.stroke();
    ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(px, gy + 32 * u + Math.sin(now / 500) * 2 * u, 2.5 * u, 0, 6.283); ctx.fill();
  }
  if (act === 'read') { ctx.fillStyle = '#2f6f9f'; ctx.fillRect(tx + dir * 6 * u - 6 * u, shy + 5 * u, 12 * u, 10 * u); ctx.fillStyle = '#f4efe3'; ctx.fillRect(tx + dir * 6 * u - 5 * u, shy + 6 * u, 10 * u, 8 * u); }
  if (act === 'guitar') { ctx.fillStyle = '#a8642c'; ctx.beginPath(); ctx.ellipse(tx + dir * 9 * u, shy + 16 * u, 11 * u, 8 * u, -.3 * dir, 0, 6.283); ctx.fill(); limb(tx + dir * 14 * u, shy + 13 * u, tx + dir * 34 * u, shy + 5 * u, 2.5 * u, '#5a3a1c'); }
  if (act === 'boat') limb(tx + dir * 12 * u, shy + 12 * u, tx + dir * 38 * u + Math.sin(now / 500) * 8 * u, gy + 8 * u, 2.5 * u, '#8a5a34');
  if (act === 'guitar' || dnc) {
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `${16 * u}px Georgia`;
    for (let i = 0; i < 2; i++) { const q = (now / 1800 + i / 2) % 1; ctx.globalAlpha = 1 - q; ctx.fillText(dnc ? '♫' : '♪', tx + dir * (20 + q * 30) * u, shy - q * 50 * u); }
    ctx.globalAlpha = 1;
  }
}

function draw(now) {
  const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
  if (live) { time = ((Date.now() / 1000 + 6 * 3600) % 86400) / 86400; slider.value = time; }   // Bangladesh time (UTC+6)
  else if (playing) { time = (time + dt / 60) % 1; slider.value = time; }
  const t = time, dl = daylight(t), hr = Math.min(23, Math.floor(t * 24)), cast = CAST[hr];
  curAct = cast.a;

  // Sky
  const [top, bot] = skyAt(t);
  const g = ctx.createLinearGradient(0, 0, 0, H * .75);
  g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.fillStyle = '#fff';
  stars.forEach(s => {
    ctx.globalAlpha = (1 - dl) * (.5 + .5 * Math.sin(now / 600 + s.p));
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r * devicePixelRatio, 0, 6.283); ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Aurora and shooting star at night
  if (dl < .5) {
    const a = (.5 - dl) * 2, dpr = devicePixelRatio;
    ctx.globalCompositeOperation = 'lighter';
    [[60,255,170],[40,200,255],[170,90,255]].forEach((c, k) => {
      ctx.beginPath(); ctx.moveTo(0, H * .5);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * (.2 + k * .06) + Math.sin(x / W * 5 + now / 2500 + k * 2) * H * .05 + Math.sin(x / W * 11 - now / 1700) * H * .02);
      ctx.lineTo(W, H * .5); ctx.closePath();
      const ag = ctx.createLinearGradient(0, H * .12, 0, H * .5);
      ag.addColorStop(0, `rgba(${c},${a * .38})`); ag.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = ag; ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    if (!shoot && dl < .3 && Math.random() < .006) shoot = {x: W * (.2 + Math.random() * .6), y: H * (.05 + Math.random() * .2), p: 0};
    if (shoot) {
      shoot.p += dt * 1.4;
      const x = shoot.x + shoot.p * W * .25, y = shoot.y + shoot.p * H * .12;
      const sg2 = ctx.createLinearGradient(x, y, x - 90 * dpr, y - 45 * dpr);
      sg2.addColorStop(0, `rgba(255,255,255,${Math.max(0, 1 - shoot.p)})`); sg2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = sg2; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 90 * dpr, y - 45 * dpr); ctx.stroke();
      if (shoot.p >= 1) shoot = null;
    }
  }

  // Sun and moon on an arc
  const sunA = (t - 0.25) * Math.PI * 2, mx = W / 2, my = H * .72, R = Math.min(W, H) * .55;
  const sx = mx + Math.cos(Math.PI - sunA) * R * 1.05, sy = my - Math.sin(sunA) * R;
  const mxp = mx + Math.cos(-sunA) * R * 1.05, myp = my - Math.sin(sunA + Math.PI) * R;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 160 * devicePixelRatio);
  sg.addColorStop(0, 'rgba(255,230,160,.9)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 160 * devicePixelRatio, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(sx, sy, 34 * devicePixelRatio, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#e8ecff'; ctx.beginPath(); ctx.arc(mxp, myp, 26 * devicePixelRatio, 0, 6.283); ctx.fill();
  ctx.fillStyle = rgb(top); ctx.beginPath(); ctx.arc(mxp + 10 * devicePixelRatio, myp - 5 * devicePixelRatio, 22 * devicePixelRatio, 0, 6.283); ctx.globalAlpha = 1 - dl; ctx.fill(); ctx.globalAlpha = 1;

  // Golden-hour glow and light rays
  const gold = Math.max(0, 1 - Math.abs(dl - .35) * 2.6) * (sy < H * .8 ? 1 : 0);
  if (gold > .02) {
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * .5);
    hg.addColorStop(0, `rgba(255,150,70,${gold * .45})`); hg.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) {
      const ang = Math.PI * (.15 + i * .084) + Math.sin(now / 4000 + i) * .03, len = H * 1.3;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * len - 40, sy + Math.sin(ang) * len); ctx.lineTo(sx + Math.cos(ang) * len + 40, sy + Math.sin(ang) * len); ctx.closePath();
      ctx.fillStyle = `rgba(255,200,120,${gold * .07})`; ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Clouds
  clouds.forEach(c => {
    c.x += c.v * dt * (playing ? 1 : 0); if (c.x > 1.2) c.x = -.2;
    const cx = c.x * W, cy = c.y * H, s = c.s * 60 * devicePixelRatio;
    ctx.fillStyle = rgb(mix([60,66,100], [255,255,255], dl)); ctx.globalAlpha = .22 + .63 * dl;
    [[0,0,1],[.9,.2,.7],[-.9,.2,.7],[.4,-.35,.75],[-.4,-.3,.65]].forEach(p => {
      ctx.beginPath(); ctx.arc(cx + p[0] * s, cy + p[1] * s, p[2] * s * .8, 0, 6.283); ctx.fill();
    });
  });
  ctx.globalAlpha = 1;

  // Hot air balloon (daytime)
  if (dl > .3) {
    const u = devicePixelRatio, bx = (now / 45) % (W * 1.4) - W * .2, by = H * .2 + Math.sin(now / 2200) * 12 * u, r = 24 * u;
    ctx.globalAlpha = Math.min(1, (dl - .3) * 3);
    ctx.fillStyle = '#e0533d'; ctx.beginPath(); ctx.arc(bx, by, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(bx, by, r * .42, r, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#e0533d'; ctx.beginPath(); ctx.ellipse(bx, by, r * .15, r, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#4a3b32'; ctx.lineWidth = u; ctx.beginPath(); ctx.moveTo(bx - r * .5, by + r * .85); ctx.lineTo(bx - 6 * u, by + r + 14 * u); ctx.moveTo(bx + r * .5, by + r * .85); ctx.lineTo(bx + 6 * u, by + r + 14 * u); ctx.stroke();
    ctx.fillStyle = '#6b4a32'; ctx.fillRect(bx - 7 * u, by + r + 14 * u, 14 * u, 9 * u); ctx.globalAlpha = 1;
  }

  // Mountains (far to near), tinted by sky and daylight
  layers.forEach((L, i) => {
    const far = mix(bot, [30,40,70], L.d * .6);
    const col = mix(far, [10,20,25], (1 - dl) * .5 + i * .1);
    ridge(L, t, 0); ctx.fillStyle = rgb(col); ctx.fill();
    if (i === 0) windmill(L, col, now);
  });

  // Valley haze
  const hz = ctx.createLinearGradient(0, H * .5, 0, H * .78);
  hz.addColorStop(0, `rgba(${bot},0)`); hz.addColorStop(1, `rgba(${bot},.5)`);
  ctx.fillStyle = hz; ctx.fillRect(0, H * .5, W, H * .28);

  // Lake with reflection of sky
  const ly = H * .78;
  const lg = ctx.createLinearGradient(0, ly, 0, H);
  lg.addColorStop(0, rgb(mix(bot, [20,50,70], .35))); lg.addColorStop(1, rgb(mix(top, [5,15,30], .5)));
  ctx.fillStyle = lg; ctx.fillRect(0, ly, W, H - ly);
  ctx.strokeStyle = `rgba(255,255,255,${.08 + dl * .12})`; ctx.lineWidth = devicePixelRatio;
  for (let i = 0; i < 26; i++) {
    const y = ly + (i / 26) * (H - ly) + 6, wv = Math.sin(now / 900 + i) * 14;
    const x = (i * 137) % W;
    ctx.beginPath(); ctx.moveTo(x + wv, y); ctx.lineTo(x + wv + 60 + i * 3, y); ctx.stroke();
  }
  // Sun/moon shimmer on water
  const bx = dl > .3 ? sx : mxp;
  ctx.fillStyle = dl > .3 ? 'rgba(255,230,170,.35)' : 'rgba(220,230,255,.25)';
  for (let i = 0; i < 14; i++) {
    const y = ly + 8 + i * ((H - ly) / 14), w = (20 + i * 5) * devicePixelRatio * (.6 + .4 * Math.sin(now / 400 + i));
    ctx.fillRect(bx - w / 2, y, w, 2 * devicePixelRatio);
  }

  // Pine trees on the shore
  const treeCol = rgb(mix([8,20,18], [24,70,52], dl));
  ctx.fillStyle = treeCol;
  for (let i = 0; i < 22; i++) {
    const x = (i / 22) * W + Math.sin(i * 9) * 20, h = (70 + (i * 37) % 60) * devicePixelRatio;
    const sway = Math.sin(now / 1200 + i) * 3 * devicePixelRatio;
    for (let k = 0; k < 3; k++) {
      const yy = ly - k * h * .28, ww = (h * .32) * (1 - k * .22);
      ctx.beginPath(); ctx.moveTo(x - ww, yy); ctx.lineTo(x + sway * (k + 1) / 3, yy - h * .45); ctx.lineTo(x + ww, yy); ctx.closePath(); ctx.fill();
    }
  }

  // Cabin
  {
    const cx = W * .22, u = devicePixelRatio, cw = 70 * u, ch = 44 * u, cb = ly - 4 * u;
    ctx.fillStyle = rgb(mix([14,18,24], [96,62,42], dl)); ctx.fillRect(cx - cw / 2, cb - ch, cw, ch);
    ctx.fillStyle = rgb(mix([8,10,16], [62,38,30], dl)); ctx.fillRect(cx + cw * .2, cb - ch - 28 * u, 9 * u, 22 * u);
    ctx.beginPath(); ctx.moveTo(cx - cw * .62, cb - ch); ctx.lineTo(cx, cb - ch - 34 * u); ctx.lineTo(cx + cw * .62, cb - ch); ctx.closePath(); ctx.fill();
    const lit = curAct === 'sleep' ? .08 : 1 - dl * .8;
    if (lit > .15) {
      const wg = ctx.createRadialGradient(cx, cb - ch * .55, 0, cx, cb - ch * .55, 60 * u);
      wg.addColorStop(0, `rgba(255,190,90,${lit * .5})`); wg.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = wg; ctx.fillRect(cx - 60 * u, cb - ch * .55 - 60 * u, 120 * u, 120 * u);
    }
    ctx.fillStyle = `rgba(255,205,110,${.4 + .6 * lit})`; ctx.fillRect(cx - 9 * u, cb - ch * .7, 18 * u, 18 * u);
    for (let i = 0; i < 5; i++) {
      const q = (now / 3000 + i / 5) % 1;
      ctx.fillStyle = `rgba(210,215,225,${(1 - q) * .35})`;
      ctx.beginPath(); ctx.arc(cx + cw * .2 + 4 * u + Math.sin(q * 6 + i) * 8 * u * q + q * 14 * u, cb - ch - 30 * u - q * 70 * u, (4 + q * 12) * u, 0, 6.283); ctx.fill();
    }
  }

  // Dock, rowboat, lantern, campfire and the person
  {
    const u = devicePixelRatio, dockL = W * .33, dockR = W * .56, dy = ly + 2 * u;
    const wood = rgb(mix([30,22,16], [150,105,70], dl));
    ctx.fillStyle = wood; ctx.fillRect(dockL, dy, dockR - dockL, 7 * u);
    ctx.fillStyle = rgb(mix([18,13,10], [100,70,46], dl));
    for (let px = dockL + 10 * u; px < dockR; px += 46 * u) ctx.fillRect(px, dy + 7 * u, 5 * u, 22 * u);
    const bx = W * .63, by = ly + 40 * u + Math.sin(now / 900) * 2.5 * u;
    ctx.fillStyle = rgb(mix([40,24,16], [160,88,52], dl)); ctx.beginPath(); ctx.moveTo(bx - 40 * u, by - 8 * u); ctx.quadraticCurveTo(bx, by + 22 * u, bx + 40 * u, by - 8 * u); ctx.closePath(); ctx.fill();
    limb(bx - 30 * u, by - 4 * u, bx + 30 * u, by - 4 * u, 2 * u, rgb(mix([30,18,12], [110,60,36], dl)));
    const lx = dockR - 6 * u, lamp = Math.max(0, .85 - dl);
    limb(lx, dy, lx, dy - 48 * u, 3 * u, wood);
    if (lamp > .05) {
      const lg2 = ctx.createRadialGradient(lx, dy - 52 * u, 0, lx, dy - 52 * u, 70 * u);
      lg2.addColorStop(0, `rgba(255,205,120,${lamp * .7})`); lg2.addColorStop(1, 'rgba(255,205,120,0)');
      ctx.fillStyle = lg2; ctx.fillRect(lx - 70 * u, dy - 122 * u, 140 * u, 140 * u);
    }
    ctx.fillStyle = `rgba(255,220,140,${.5 + .5 * lamp})`; ctx.fillRect(lx - 4 * u, dy - 57 * u, 8 * u, 9 * u);
    if (dl < .55) {
      const fx = W * .30, fl = (1 - dl) * (.85 + .15 * Math.sin(now / 90));
      const fg2 = ctx.createRadialGradient(fx, ly - 8 * u, 0, fx, ly - 8 * u, 95 * u);
      fg2.addColorStop(0, `rgba(255,150,60,${fl * .5})`); fg2.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = fg2; ctx.fillRect(fx - 95 * u, ly - 103 * u, 190 * u, 190 * u);
      limb(fx - 12 * u, ly - 1 * u, fx + 12 * u, ly - 6 * u, 4 * u, '#3a2618'); limb(fx + 12 * u, ly - 1 * u, fx - 12 * u, ly - 6 * u, 4 * u, '#3a2618');
      for (let i = 0; i < 3; i++) {
        const h = (22 - Math.abs(i - 1) * 7 + Math.sin(now / 70 + i * 2) * 5) * u, cx2 = fx + (i - 1) * 6 * u;
        ctx.fillStyle = `rgba(255,${130 + i * 40},40,${.55 + fl * .4})`;
        ctx.beginPath(); ctx.moveTo(cx2 - 5 * u, ly - 4 * u); ctx.quadraticCurveTo(cx2, ly - h * 1.1, cx2 + 5 * u, ly - 4 * u); ctx.closePath(); ctx.fill();
      }
    }
    if (curAct === 'sleep') {
      ctx.fillStyle = '#fff'; 
      for (let i = 0; i < 3; i++) { const q = (now / 2200 + i / 3) % 1; ctx.globalAlpha = (1 - q) * .85; ctx.font = `${(10 + q * 14) * u}px Georgia`; ctx.fillText('z', W * .22 + 34 * u + q * 40 * u, ly - 80 * u - q * 55 * u); }
      ctx.globalAlpha = 1;
    } else {
      const walkish = curAct === 'walk' || curAct === 'run', span = dockR - dockL - 40 * u;
      const ph = (now / (curAct === 'run' ? 2500 : 5000)) % 2, t01 = ph < 1 ? ph : 2 - ph;
      const boat = curAct === 'boat', px = walkish ? dockL + 20 * u + t01 * span : W * cast.x;
      person(boat ? bx : px, boat ? by + 14 * u : dy, u * 1.15, curAct, now, dl, boat ? -1 : (walkish && ph >= 1 ? -1 : 1), cast.l);
    }
  }

  // Birds by day
  ctx.strokeStyle = '#1b2233'; ctx.lineWidth = 2 * devicePixelRatio;
  birds.forEach(b => {
    b.x += b.v * dt * (playing ? 1 : 0); if (b.x > 1.1) b.x = -.1;
    if (dl < .25) return;
    const x = b.x * W, y = b.y * H + Math.sin(now / 700 + b.p) * 10, f = Math.sin(now / 120 + b.p) * 7 * devicePixelRatio;
    ctx.beginPath(); ctx.moveTo(x - 12 * devicePixelRatio, y - f); ctx.quadraticCurveTo(x - 4 * devicePixelRatio, y + 2, x, y);
    ctx.quadraticCurveTo(x + 4 * devicePixelRatio, y + 2, x + 12 * devicePixelRatio, y - f); ctx.stroke();
  });

  // Fireflies by night
  flies.forEach(f => {
    const a = (1 - dl) * (.4 + .6 * Math.sin(now / 500 + f.p));
    if (a < .05) return;
    const x = (f.x + Math.sin(now / 3000 * f.s + f.p) * .02) * W, y = (f.y + Math.cos(now / 2500 * f.s + f.p) * .02) * H;
    const fg = ctx.createRadialGradient(x, y, 0, x, y, 10 * devicePixelRatio);
    fg.addColorStop(0, `rgba(220,255,140,${a})`); fg.addColorStop(1, 'rgba(220,255,140,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, 10 * devicePixelRatio, 0, 6.283); ctx.fill();
  });

  {
    const am = AMB[hr], u = devicePixelRatio;
    if (am === 'mist') {
      const mg = ctx.createLinearGradient(0, H * .5, 0, H * .85);
      mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(.6, `rgba(235,240,250,${.32 + .08 * Math.sin(now / 2500)})`); mg.addColorStop(1, 'rgba(235,240,250,0)');
      ctx.fillStyle = mg; ctx.fillRect(0, H * .5, W, H * .35);
    } else if (am === 'petal' || am === 'leaf') {
      ctx.fillStyle = am === 'petal' ? 'rgba(255,175,195,.9)' : 'rgba(225,125,45,.9)';
      drops.slice(0, 60).forEach(d => { const q = (now / (9000 + d.k * 5000) + d.x) % 1, x = ((d.x + q * .15 + Math.sin(q * 12 + d.k * 9) * .02) % 1) * W; ctx.beginPath(); ctx.ellipse(x, q * H, 4 * u, 2.2 * u, q * 9, 0, 6.283); ctx.fill(); });
    } else if (am === 'ember') {
      ctx.fillStyle = 'rgba(255,170,70,.9)';
      for (let i = 0; i < 24; i++) { const q = (now / 2600 + i / 24) % 1; ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.arc(W * .30 + Math.sin(i * 7 + q * 8) * 22 * u * q, ly - 8 * u - q * 150 * u, 1.8 * u, 0, 6.283); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  if (wx) {
    const u = devicePixelRatio, snow = wx === 2;
    ctx.fillStyle = 'rgba(15,20,35,.22)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(190,210,255,.5)'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = u;
    drops.forEach(d => {
      d.y += (snow ? .05 + .1 * d.k : .7 + 1.1 * d.k) * dt; if (!snow) d.x -= .05 * dt;
      if (d.y > 1) { d.y = -.02; d.x = Math.random(); }
      const x = ((d.x + (snow ? Math.sin(now / 900 + d.k * 9) * .01 : 0)) % 1 + 1) % 1 * W, y = d.y * H;
      if (snow) { ctx.beginPath(); ctx.arc(x, y, (1.5 + d.k * 2.2) * u, 0, 6.283); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3 * u, y + 14 * u); ctx.stroke(); }
    });
    if (wx === 3 && Math.random() < .004) { flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on'); }
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .4, W / 2, H / 2, Math.max(W, H) * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  const mins = Math.floor(t * 1440);
  if (hr !== epHr) { epHr = hr; updateDateLine(); document.getElementById('epn').textContent = ((hr + 11) % 12 + 1) + (hr < 12 ? ' AM' : ' PM') + ' · ' + cast.n + ', ' + cast.r; document.getElementById('epc').textContent = cast.c + '  ♪ ' + MOOD[hr][5]; }
  const fg = 'linear-gradient(0deg, rgba(' + top + ',.88), rgba(' + top + ',0))'; if (fg !== footBg) { footBg = fg; footEl.style.background = fg; }
  const hh = Math.floor(mins / 60), mm = mins % 60;
  const part = hh < 5 ? 'Night' : hh < 7 ? 'Dawn' : hh < 12 ? 'Morning' : hh < 17 ? 'Afternoon' : hh < 19 ? 'Evening' : 'Night';
  clock.textContent = ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + ' ' + (hh < 12 ? 'AM' : 'PM') + ' · ' + part + (live ? ' · BD time' : '');
  liveBtn.classList.toggle('on', live);
  routineTick(mins);
  requestAnimationFrame(draw);
}

// ---- Daily routine ----
const KEY = 'routine-v2';
const GROUPS = [
  {f: 0, t: 4, name: 'Late Night', ic: '🌙'}, {f: 5, t: 7, name: 'Early Morning', ic: '🌅'}, {f: 8, t: 11, name: 'Morning', ic: '☀️'},
  {f: 12, t: 13, name: 'Lunch', ic: '🍽️'}, {f: 14, t: 17, name: 'Afternoon', ic: '🌤️'}, {f: 18, t: 19, name: 'Evening', ic: '🌇'},
  {f: 20, t: 21, name: 'Dinner', ic: '🍲'}, {f: 22, t: 23, name: 'Night', ic: '🌙'}
];
const f12 = t => { const [h, m] = t.split(':').map(Number); return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };
const h12 = h => ((h % 24 + 11) % 12 + 1) + (h % 24 < 12 ? ' AM' : ' PM');
const DEF = [
  {t:'00:00', n:'Sleep'},
  {t:'01:00', n:'Sleep'},
  {t:'02:00', n:'Deep sleep'},
  {t:'03:00', n:'Sleep'},
  {t:'04:00', n:'Wake up and make coffee'},
  {t:'05:00', n:'Yoga and meditation'},
  {t:'06:00', n:'Morning jog'},
  {t:'07:00', n:'Breakfast'},
  {t:'08:00', n:'Get ready and commute'},
  {t:'09:00', n:'Deep work'},
  {t:'10:00', n:'Focus work'},
  {t:'11:00', n:'Emails and calls'},
  {t:'12:00', n:'Lunch'},
  {t:'13:00', n:'Rest and short walk'},
  {t:'14:00', n:'Study'},
  {t:'15:00', n:'Hobby time (music or painting)'},
  {t:'16:00', n:'Dance or workout'},
  {t:'17:00', n:'Chores and tidy up'},
  {t:'18:00', n:'Evening run'},
  {t:'19:00', n:'Cook dinner'},
  {t:'20:00', n:'Dinner with family'},
  {t:'21:00', n:'Read or write'},
  {t:'22:00', n:'Meditate and wind down'},
  {t:'23:00', n:'Evening walk and get ready for bed'}
];
const cloneDef = () => JSON.parse(JSON.stringify(DEF));
const bdDate = (off = 0) => new Date(Date.now() + 6 * 3600e3 + off * 864e5).toISOString().slice(0, 10);   // today's date in Bangladesh
const shiftDate = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const dateLabel = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
const cmp = (a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : 0;
const strip = a => a.map(k => k.a ? {t: k.t, n: k.n, a: 1} : {t: k.t, n: k.n});   // a plan without the "done" ticks
const rd = (key, fb) => { try { return JSON.parse(localStorage.getItem(key)) || fb; } catch (e) { return fb; } };
let template = strip(rd(KEY, DEF)).sort(cmp), days = rd('daymate-days', {}), selDate = bdDate(), tasks = [];
const isToday = () => selDate === bdDate();
const tasksFor = d => days[d] || template;
function loadDay() { tasks = JSON.parse(JSON.stringify(tasksFor(selDate))); shownKey = ''; }   // a copy, so edits are saved only for this day
const persist = () => { try { localStorage.setItem('daymate-days', JSON.stringify(days)); localStorage.setItem(KEY, JSON.stringify(template)); } catch (e) {} };
const save = () => {
  const same = !tasks.some(k => k.d) && JSON.stringify(strip(tasks).sort(cmp)) === JSON.stringify(template);
  if (same) delete days[selDate]; else days[selDate] = tasks;
  persist(); renderCal();
};
const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const listEl = document.getElementById('list'), nowEl = document.getElementById('now');
let shownKey = '';
const liveBtn = document.getElementById('live');
loadDay();

function routineTick(mins, force) {
  if (!tasks.length) { nowEl.textContent = 'Add your first activity below.'; listEl.textContent = ''; return; }
  tasks.sort((a, b) => toMin(a.t) - toMin(b.t));
  let cur = tasks.length - 1;                       // before the first task, we are still in last night's one
  tasks.forEach((k, i) => { if (toMin(k.t) <= mins) cur = i; });
  if (!isToday()) cur = -1;                         // no 'now' marker on other days
  if (editRef && shownKey !== '') return;   // don't redraw while someone is typing
  const key = selDate + '|' + cur + '|' + tasks.length + '|' + tasks.map(k => k.t + k.n + (k.a ? 1 : 0)).join();
  if (key === shownKey && !force) return;
  shownKey = key;
  const next = tasks[(cur + 1) % tasks.length];
  nowEl.textContent = cur < 0 ? 'Planning ' + dateLabel(selDate) + '. Use 📅 Calendar to change the day.' : 'Now (' + f12(String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0')) + '): ' + tasks[cur].n + '. Next: ' + next.n + ' at ' + f12(next.t) + '.';
  listEl.textContent = '';
  let lastG = -1;
  tasks.forEach((k, i) => {
    const gi = GROUPS.findIndex(g => Math.floor(toMin(k.t) / 60) <= g.t);
    if (gi !== lastG) {
      lastG = gi; const g = GROUPS[gi], hd = document.createElement('li'); hd.className = 'grp';
      hd.textContent = g.ic + ' ' + g.name + ' · ' + h12(g.f) + ' to ' + h12(g.t + 1);
      const pb = document.createElement('button'); pb.textContent = '+'; pb.className = 'gadd'; pb.setAttribute('aria-label', 'Add a task in ' + g.name);
      pb.onclick = e => { e.stopPropagation(); document.getElementById('at').value = String(g.f).padStart(2, '0') + ':00'; document.getElementById('what').focus(); };
      hd.append(pb); listEl.append(hd);
    }
    if (k === editRef) { listEl.append(editRow(k)); return; }
    const li = document.createElement('li'); if (i === cur) li.className = 'cur';
    const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = f12(k.t);
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = k.n + (k.a ? ' 🔔' : '');
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!k.d; cb.setAttribute('aria-label', 'Done: ' + k.n);
    cb.onclick = e => { e.stopPropagation(); k.d = cb.checked; save(); shownKey = ''; };
    if (k.d) li.classList.add('done');
    li.onclick = () => { live = false; time = toMin(k.t) / 1440; slider.value = time; shownKey = ''; };
    const x = document.createElement('button'); x.textContent = '⋮'; x.className = 'more'; x.setAttribute('aria-label', 'Options for ' + k.n);
    x.onclick = e => { e.stopPropagation(); openMenu(k, x); };
    li.append(cb, tm, nm, x); listEl.append(li);
  });
  document.getElementById('prog').textContent = tasks.filter(k => k.d).length + ' of ' + tasks.length + (isToday() ? ' done today' : ' done');
  const c = listEl.querySelector('.cur'); if (c) c.scrollIntoView({block: 'nearest'});
}
// ---- Calendar: each day can have its own plan ----
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const calBox = mk('div', ''); calBox.id = 'calbox'; calBox.hidden = true; document.body.append(calBox);
let calM = selDate.slice(0, 7);
const greet = () => { const h = Math.floor(((Date.now() / 1000 + 21600) % 86400) / 3600); return h < 5 ? 'Good night 🌙' : h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 🌤️' : h < 21 ? 'Good evening 🌇' : 'Good night 🌙'; };
function updateDateLine() {
  document.getElementById('dateLine').textContent = (isToday() ? greet() + ' · ' : '📅 ') + dateLabel(selDate) + (days[selDate] ? ' · own plan' : ' · every-day routine');
}
function setCal(show) { calBox.hidden = !show; document.getElementById('cal').classList.toggle('on', show); if (show) { calM = selDate.slice(0, 7); renderCal(); } }
function selectDate(d) { selDate = d; editRef = null; loadDay(); calM = d.slice(0, 7); renderCal(); }
function renderCal() {
  updateDateLine();
  if (calBox.hidden) return;
  const [y, m] = calM.split('-').map(Number), dow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const nav = n => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); calM = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); renderCal(); };
  calBox.textContent = '';
  const head = mk('div', 'chead'), prev = mk('button', '', '‹'), next = mk('button', '', '›'), close = mk('button', '', '✕');
  prev.setAttribute('aria-label', 'Previous month'); next.setAttribute('aria-label', 'Next month'); close.setAttribute('aria-label', 'Close calendar');
  prev.onclick = () => nav(-1); next.onclick = () => nav(1); close.onclick = () => setCal(false);
  head.append(prev, mk('b', '', MONTHS[m - 1] + ' ' + y), next, close); calBox.append(head);
  const grid = mk('div', 'cgrid');
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(w => grid.append(mk('span', 'cw', w)));
  for (let i = 0; i < dow; i++) grid.append(mk('span'));
  for (let d = 1; d <= dim; d++) {
    const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'), b = mk('button', 'cd', d);
    if (ds === selDate) b.classList.add('sel');
    if (ds === bdDate()) b.classList.add('tod');
    if (days[ds]) b.classList.add('has');
    if (tasksFor(ds).some(k => k.a)) b.classList.add('al');
    b.setAttribute('aria-label', dateLabel(ds)); b.onclick = () => selectDate(ds); grid.append(b);
  }
  calBox.append(grid);
  const foot = mk('div', 'cfoot'), t = mk('button', '', 'Today'), tm = mk('button', '', 'Tomorrow'), cp = mk('button', '', '📋 Copy to next day');
  t.onclick = () => selectDate(bdDate()); tm.onclick = () => selectDate(bdDate(1));
  cp.onclick = () => { const nd = shiftDate(selDate, 1); days[nd] = strip(tasks); persist(); selectDate(nd); };
  foot.append(t, tm, cp); calBox.append(foot);
  calBox.append(mk('small', 'cnote', '● has its own plan   🔔 has an alarm'));
}
document.getElementById('cal').addEventListener('click', () => setCal(calBox.hidden));
renderCal();

// ---- Alarms: sound + pop-up (+ notification) at the task's time, Bangladesh time ----
let alarmCtx = null, ringTimer = null, rings = 0; const fired = new Set(), snoozed = [];
const toastBox = mk('div', ''); toastBox.id = 'toasts'; document.body.append(toastBox);
function unlockAudio() { try { if (!alarmCtx) alarmCtx = new (window.AudioContext || window.webkitAudioContext)(); if (alarmCtx.state === 'suspended') alarmCtx.resume(); } catch (e) {} }
['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, unlockAudio, {passive: true}));
function askNotify() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} }
function chime() {
  if (!alarmCtx) return; const t0 = alarmCtx.currentTime;
  [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => [[1, 1], [2, .25]].forEach(([k, a]) => {
    const o = alarmCtx.createOscillator(), g = alarmCtx.createGain(), st = t0 + i * .3; o.type = 'sine'; o.frequency.value = f * k;
    g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(.22 * a, st + .02); g.gain.exponentialRampToValueAtTime(.0001, st + 1.4);
    o.connect(g); g.connect(alarmCtx.destination); o.start(st); o.stop(st + 1.5);
  }));
}
function ring(title, body) {
  unlockAudio();
  const t = mk('div', 'toast'), row = mk('div', 'trow'), sn = mk('button', '', 'Snooze 5 min'), ok = mk('button', 'pri', 'Dismiss');
  t.setAttribute('role', 'alert');
  const close = () => { t.remove(); if (!toastBox.children.length && ringTimer) { clearInterval(ringTimer); ringTimer = null; } };
  sn.onclick = () => { snoozed.push({at: Date.now() + 300000, n: body}); close(); }; ok.onclick = close;
  row.append(sn, ok); t.append(mk('b', '', title), mk('div', '', body), row); toastBox.append(t);
  rings = 6; if (!ringTimer) { chime(); ringTimer = setInterval(() => { if (rings-- > 0) chime(); }, 4000); }
  try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
  try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(title, {body}); } catch (e) {}
  if (document.hidden) document.title = title + ' · DayMate 🤝';
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = 'DayMate 🤝'; });
setInterval(() => {
  const date = bdDate(), min = Math.floor(((Date.now() / 1000 + 21600) % 86400) / 60);
  (date === selDate ? tasks : tasksFor(date)).forEach(k => {
    if (!k.a || k.d || toMin(k.t) !== min) return;
    const id = date + '|' + k.t + '|' + k.n; if (fired.has(id)) return;
    fired.add(id); ring('⏰ ' + f12(k.t), k.n);
  });
  for (let i = snoozed.length - 1; i >= 0; i--) if (Date.now() >= snoozed[i].at) { ring('⏰ Snoozed reminder', snoozed[i].n); snoozed.splice(i, 1); }
}, 1000);

let editRef = null;
const menuEl = document.createElement('div'); menuEl.id = 'menu'; menuEl.hidden = true; document.body.append(menuEl);
function closeMenu() { menuEl.hidden = true; }
function openMenu(k, btn) {
  menuEl.textContent = '';
  const add = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = e => { e.stopPropagation(); closeMenu(); fn(); }; menuEl.append(b); };
  add('✏️ Edit', () => { editRef = k; shownKey = ''; });
  add(k.a ? '🔕 Remove alarm' : '🔔 Set alarm', () => { k.a = k.a ? 0 : 1; if (k.a) askNotify(); save(); shownKey = ''; });
  add(k.d ? '↩️ Mark not done' : '✅ Mark done', () => { k.d = !k.d; save(); shownKey = ''; });
  add('▶️ Jump scene to this time', () => { live = false; time = toMin(k.t) / 1440; slider.value = time; shownKey = ''; });
  add('🗑️ Delete', () => { tasks.splice(tasks.indexOf(k), 1); if (editRef === k) editRef = null; save(); shownKey = ''; });
  const r = btn.getBoundingClientRect(); menuEl.hidden = false;
  const mh = menuEl.offsetHeight, mw = menuEl.offsetWidth;
  menuEl.style.left = Math.max(8, r.right - mw) + 'px';
  menuEl.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + 'px';
}
function showMenu(items, btn) {
  menuEl.textContent = '';
  items.forEach(([label, fn]) => { const b = document.createElement('button'); b.textContent = label; b.onclick = e => { e.stopPropagation(); closeMenu(); fn(); }; menuEl.append(b); });
  const r = btn.getBoundingClientRect(); menuEl.hidden = false;
  const mh = menuEl.offsetHeight, mw = menuEl.offsetWidth;
  menuEl.style.left = Math.max(8, r.right - mw) + 'px';
  menuEl.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + 'px';
}
const panelEl = document.getElementById('panel'), rtBtn = document.getElementById('rt');
function setPanel(show) { panelEl.style.display = show ? '' : 'none'; rtBtn.classList.toggle('on', show); }
rtBtn.addEventListener('click', () => setPanel(panelEl.style.display === 'none'));
const pmore = document.getElementById('pmore');
pmore.addEventListener('click', e => {
  e.stopPropagation();
  const items = [
    ['➕ Add a task', () => document.getElementById('what').focus()],
    ['📅 Open calendar', () => setCal(true)],
    ['📊 Progress and streaks', openStats],
    ['💾 Export backup', exportData],
    ['📂 Import backup', () => fileIn.click()],
    ['⏰ Test the alarm', () => { unlockAudio(); askNotify(); ring('⏰ Test alarm', 'This is how your DayMate alarms will look and sound.'); }],
    ['🔄 Untick all tasks', () => { tasks.forEach(k => k.d = false); save(); shownKey = ''; }],
    ['📌 Use this day as my every-day routine', () => { template = strip(tasks).sort(cmp); save(); persist(); shownKey = ''; }],
    ['↩️ Use the every-day routine for this day', () => { delete days[selDate]; persist(); loadDay(); renderCal(); }],
    ['↺ Reset to the default 24-hour routine', () => showMenu([
      ['⚠️ Yes, replace this day\'s tasks', () => { tasks = cloneDef(); editRef = null; save(); shownKey = ''; }],
      ['Cancel', () => {}]], pmore)],
    ['✨ Zen mode (hide everything)', toggleZen],
    ['⌨️ Keyboard shortcuts', openHelp],
    ['🙈 Hide this panel', () => setPanel(false)]
  ];
  if (deferredInstall) items.splice(2, 0, ['⬇️ Install DayMate as an app', () => { deferredInstall.prompt(); deferredInstall = null; }]);
  showMenu(items, pmore);
});
document.addEventListener('click', closeMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); setCal(false); closeModal(); } });
['wheel', 'touchmove'].forEach(ev => document.getElementById('panel').addEventListener(ev, closeMenu, {passive: true}));   // close only when the person scrolls, not on automatic scrolling
function editRow(k) {
  const li = document.createElement('li'); li.className = 'edit';
  const t = document.createElement('input'); t.type = 'time'; t.value = k.t; t.setAttribute('aria-label', 'Time');
  const n = document.createElement('input'); n.type = 'text'; n.value = k.n; n.setAttribute('aria-label', 'Activity');
  const ok = document.createElement('button'); ok.textContent = '✓'; ok.setAttribute('aria-label', 'Save');
  const no = document.createElement('button'); no.textContent = '✕'; no.setAttribute('aria-label', 'Cancel');
  let alarm = !!k.a; const bell = document.createElement('button'); bell.textContent = alarm ? '🔔' : '🔕'; bell.setAttribute('aria-label', 'Alarm on or off');
  bell.onclick = e => { e.stopPropagation(); alarm = !alarm; bell.textContent = alarm ? '🔔' : '🔕'; if (alarm) askNotify(); };
  const finish = save1 => { if (save1) { const nn = n.value.trim(); if (!t.value || !nn) return; k.t = t.value; k.n = nn; k.a = alarm ? 1 : 0; save(); } editRef = null; shownKey = ''; };
  ok.onclick = e => { e.stopPropagation(); finish(true); }; no.onclick = e => { e.stopPropagation(); finish(false); };
  li.onclick = e => e.stopPropagation();
  [t, n].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') { e.stopPropagation(); finish(false); } }));
  setTimeout(() => n.focus(), 0);
  li.append(t, n, bell, ok, no); return li;
}
let alarmOn = false; const addBell = document.getElementById('addBell');
addBell.onclick = () => { alarmOn = !alarmOn; addBell.textContent = alarmOn ? '🔔' : '🔕'; addBell.setAttribute('aria-pressed', String(alarmOn)); };
document.getElementById('what').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('addBtn').click(); });
document.getElementById('addBtn').onclick = () => {
  const t = document.getElementById('at').value, n = document.getElementById('what').value.trim();
  if (!t || !n) return;
  tasks.push(alarmOn ? {t, n, a: 1} : {t, n}); if (alarmOn) askNotify(); save(); shownKey = ''; document.getElementById('what').value = '';
  alarmOn = false; addBell.textContent = '🔕'; addBell.setAttribute('aria-pressed', 'false');
};
// ---- Music: soft piano-like chords and gentle bells, a new mood every hour (all generated, no files) ----
// [root note, mode (M major / m minor), seconds per note, how often a note plays, brightness (Hz), title]
const MOOD = [
  [45,'m',1.5,.50,1400,'Starlight Drift'], [50,'m',1.5,.50,1300,'Lantern Tide'], [43,'M',1.8,.40,1000,'Slow Sleep'], [48,'m',1.6,.45,1200,'Quiet Pages'],
  [53,'M',1.4,.55,1700,'First Brew'], [55,'M',1.3,.55,1900,'Mist Rising'], [52,'M',1.1,.65,2200,'Morning Steps'], [57,'M',1.0,.70,2500,'Pancake Sun'],
  [50,'M',.9,.75,2800,'Village Road'], [53,'M',1.1,.65,2400,'Deep Focus'], [55,'M',.9,.75,3000,'Spring Brush'], [48,'M',1.2,.60,2400,'Still Water'],
  [53,'M',.9,.75,3000,'Picnic Light'], [50,'M',1.1,.65,2500,'Oar Ripples'], [57,'m',1.2,.60,2200,'Study Breeze'], [55,'M',.8,.80,2800,'Porch Strings'],
  [48,'M',.6,.85,3200,'Little Dance'], [52,'m',1.2,.60,2000,'Falling Leaves'], [53,'M',1.2,.60,2000,'Golden Run'], [50,'M',1.3,.55,1800,'Supper Glow'],
  [45,'m',1.2,.65,1600,'Ember Song'], [52,'m',1.5,.50,1300,'Late Chapter'], [48,'M',1.7,.45,1100,'Lake Calm'], [43,'m',1.7,.45,1000,'Fireflies Home']
];
// chord progressions: [semitones above the key note, chord shape]
const PROG = {
  M: [[0,[0,4,7,11]], [9,[0,3,7,10]], [5,[0,4,7,11]], [7,[0,4,7,14]]],
  m: [[0,[0,3,7,10]], [8,[0,4,7,11]], [3,[0,4,7,11]], [10,[0,4,7,14]]]
};
const PAT = [0, 2, 1, 3, 2, 4, 3, 1];   // order the melody walks through the chord notes
let AC, master, lp, noiseG, musicOn = false, mHr = -1, chordT = 0, chordN = 0, stepT = 0, stepN = 0, chords = [];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function audioInit() {
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = 0; master.connect(AC.destination);
  lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(master);
  const ir = AC.createBuffer(2, AC.sampleRate * 3, AC.sampleRate);               // a soft, roomy reverb
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5); }
  const conv = AC.createConvolver(), wet = AC.createGain(); conv.buffer = ir; wet.gain.value = .45;
  lp.connect(conv); conv.connect(wet); wet.connect(master);
  const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = buf.getChannelData(0);   // faint lake water
  let b = 0; for (let i = 0; i < d.length; i++) { b = (b + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
  const src = AC.createBufferSource(), nf = AC.createBiquadFilter();
  src.buffer = buf; src.loop = true; nf.type = 'lowpass'; nf.frequency.value = 500;
  noiseG = AC.createGain(); noiseG.gain.value = 0; src.connect(nf); nf.connect(noiseG); noiseG.connect(master); src.start();
  setInterval(musicTick, 200);
}
function playPad(ct, t0, len) {   // warm sustained chord
  [[ct[0], .05], [ct[1] + 12, .032], [ct[2] + 12, .032], [ct[3] + 12, .026]].forEach(([n, v]) => {
    [-4, 4].forEach(det => {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = mtof(n); o.detune.value = det;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v / 2, t0 + 2.5);
      g.gain.setValueAtTime(v / 2, t0 + len - .5); g.gain.linearRampToValueAtTime(0, t0 + len + 2.5);
      o.connect(g); g.connect(lp); o.start(t0); o.stop(t0 + len + 2.6);
    });
  });
}
function playBell(f, t0, vel) {   // soft music-box note
  [[1, 1], [2, .2], [3, .05]].forEach(([k, a]) => {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f * k;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.06 * a * vel, t0 + .015); g.gain.exponentialRampToValueAtTime(.0001, t0 + 2.6);
    o.connect(g); g.connect(lp); o.start(t0); o.stop(t0 + 2.7);
  });
}
function musicTick() {
  if (!musicOn) return;
  const hr = Math.min(23, Math.floor(time * 24)), m = MOOD[hr], now = AC.currentTime, look = now + .6;
  if (hr !== mHr) { mHr = hr; lp.frequency.setTargetAtTime(m[4], now, 2); }
  noiseG.gain.setTargetAtTime(wx === 1 || wx === 3 ? .12 : wx === 2 ? .03 : .02, now, 1.5);
  while (chordT < look) {            // schedule the next chord a little ahead
    if (chordT < now) chordT = now + .05;
    const [off, shape] = PROG[m[1]][(chordN++ + hr) % 4], len = m[2] * 8, ct = shape.map(i => m[0] + off + i);
    chords.push({t0: chordT, ct}); if (chords.length > 3) chords.shift();
    playPad(ct, chordT, len); chordT += len;
  }
  while (stepT < look) {             // gentle melody that only uses the current chord's notes
    if (stepT < now) stepT = now + .05;
    const ch = chords.slice().reverse().find(c => c.t0 <= stepT + .01);
    if (ch && Math.random() < m[3]) { const ext = ch.ct.concat(ch.ct.map(n => n + 12)); playBell(mtof(ext[PAT[stepN % PAT.length]] + 12), stepT, .7 + Math.random() * .3); }
    stepN++; stepT += m[2];
  }
}
const muBtn = document.getElementById('mu'), vol = document.getElementById('vol');
muBtn.addEventListener('click', () => {
  if (!AC) audioInit();
  if (AC.state === 'suspended') AC.resume();
  musicOn = !musicOn; mHr = -1; chordT = 0; stepT = 0; stepN = 0; chords = [];
  master.gain.setTargetAtTime(musicOn ? +vol.value : 0, AC.currentTime, .4);
  muBtn.textContent = 'Music: ' + (musicOn ? 'On' : 'Off'); muBtn.classList.toggle('on', musicOn);
});
vol.addEventListener('input', () => { if (musicOn) master.gain.setTargetAtTime(+vol.value, AC.currentTime, .1); });

// ---- Premium features: theme, progress and streaks, backup, shortcuts, zen mode, install ----
const root = document.documentElement, themeBtn = document.getElementById('theme');
function setTheme(t) { root.dataset.theme = t; themeBtn.textContent = t === 'light' ? '☀️' : '🌙'; try { localStorage.setItem('daymate-theme', JSON.stringify(t)); } catch (e) {} }
setTheme(rd('daymate-theme', 'dark'));
themeBtn.onclick = () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light');

let modalEl = null;
function closeModal() { if (modalEl) { modalEl.veil.remove(); modalEl.box.remove(); modalEl = null; } }
function openModal(title, fill) {
  closeModal();
  const veil = mk('div', ''), box = mk('div', ''), head = mk('div', 'mh'), x = mk('button', '', '✕');
  veil.id = 'veil'; box.id = 'modal'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', title);
  x.setAttribute('aria-label', 'Close'); x.onclick = closeModal; veil.onclick = closeModal;
  head.append(mk('h2', '', title), x); box.append(head); fill(box); document.body.append(veil, box); modalEl = {veil, box}; x.focus();
}
function notice(msg) { const t = mk('div', 'toast', msg); t.setAttribute('role', 'status'); toastBox.append(t); setTimeout(() => t.remove(), 3200); }

const doneOf = d => (days[d] || []).filter(k => k.d).length;
function statsData() {
  const active = Object.keys(days).filter(d => doneOf(d) > 0).sort(), set = new Set(active);
  let cur = 0, d = set.has(bdDate()) ? bdDate() : shiftDate(bdDate(), -1);
  while (set.has(d)) { cur++; d = shiftDate(d, -1); }
  let best = 0, run = 0, prev = null;
  active.forEach(a => { run = prev && shiftDate(prev, 1) === a ? run + 1 : 1; best = Math.max(best, run); prev = a; });
  const week = Array.from({length: 7}, (_, i) => { const dd = shiftDate(bdDate(), i - 6), L = (days[dd] || []).length; return {d: dd, pct: L ? Math.round(doneOf(dd) / L * 100) : 0}; });
  return {cur, best, total: active.reduce((n, a) => n + doneOf(a), 0), week};
}
function openStats() {
  openModal('📊 Your progress', box => {
    const s = statsData(), today = days[bdDate()] || template, td = doneOf(bdDate());
    const grid = mk('div', 'sgrid');
    [[td + ' / ' + today.length, 'Today · ' + (today.length ? Math.round(td / today.length * 100) : 0) + '% done'], ['🔥 ' + s.cur + (s.cur === 1 ? ' day' : ' days'), 'Current streak'],
     [s.best + (s.best === 1 ? ' day' : ' days'), 'Best streak'], [String(s.total), 'Tasks done, all time']].forEach(([v, l]) => { const c = mk('div', 'scard'); c.append(mk('b', '', v), mk('span', '', l)); grid.append(c); });
    box.append(grid, mk('b', '', 'Last 7 days'));
    const bars = mk('div', 'bars');
    s.week.forEach((w, i) => {
      const b = mk('div', 'bar' + (i === 6 ? ' today' : '')), bar = mk('i');
      bar.style.height = (w.pct * .9 + 3) + 'px'; bar.title = w.pct + '%';
      b.append(mk('span', '', w.pct + '%'), bar, mk('span', '', new Date(w.d + 'T00:00:00Z').toLocaleDateString('en-GB', {weekday: 'short', timeZone: 'UTC'}))); bars.append(b);
    });
    const top = s.week.reduce((m, w) => w.pct > m.pct ? w : m, s.week[0]);
    box.append(bars, mk('p', 'insight', top.pct ? 'Best day this week: ' + new Date(top.d + 'T00:00:00Z').toLocaleDateString('en-GB', {weekday: 'long', timeZone: 'UTC'}) + ' (' + top.pct + '%). Keep the streak going! 🔥' : 'Tick some tasks and your progress will show up here.'));
    const row = mk('div', 'mrow'), ex = mk('button', '', '💾 Export backup'), im = mk('button', '', '📂 Import backup');
    ex.onclick = exportData; im.onclick = () => fileIn.click(); row.append(ex, im); box.append(row);
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify({app: 'DayMate', version: 1, exported: new Date().toISOString(), template, days}, null, 2)], {type: 'application/json'});
  const a = mk('a'); a.href = URL.createObjectURL(blob); a.download = 'daymate-backup-' + bdDate() + '.json'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); notice('Backup downloaded 💾');
}
const okTask = k => k && typeof k.n === 'string' && /^\d\d:\d\d$/.test(k.t);
const clean = a => a.filter(okTask).map(k => { const o = {t: k.t, n: k.n.slice(0, 120)}; if (k.a) o.a = 1; if (k.d) o.d = true; return o; });
const fileIn = mk('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.hidden = true; document.body.append(fileIn);
fileIn.onchange = () => {
  const f = fileIn.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(r.result); if (!o || !Array.isArray(o.template) || typeof o.days !== 'object') throw 0;
      template = strip(clean(o.template)).sort(cmp); days = {};
      Object.keys(o.days).filter(d => /^\d{4}-\d\d-\d\d$/.test(d) && Array.isArray(o.days[d])).forEach(d => days[d] = clean(o.days[d]));
      persist(); closeModal(); selectDate(bdDate()); notice('Backup restored ✅ (' + Object.keys(days).length + ' days)');
    } catch (e) { notice('That file is not a DayMate backup'); }
    fileIn.value = '';
  };
  r.readAsText(f);
};

const KEYS = [['N', 'New task'], ['C', 'Calendar'], ['S', 'Progress and streaks'], ['T', 'Light / dark theme'], ['M', 'Music on / off'], ['R', 'Show / hide the routine panel'], ['H', 'Zen mode (hide everything)'], ['L', 'Back to live time'], ['?', 'Show this list']];
function openHelp() { openModal('⌨️ Keyboard shortcuts', box => KEYS.forEach(([k, d]) => { const r = mk('div', 'krow'); r.append(mk('span', '', d), mk('kbd', '', k)); box.append(r); })); }
const zenBtn = mk('button', '', '✨ Show controls'); zenBtn.id = 'zenExit'; document.body.append(zenBtn);
function toggleZen() { document.body.classList.toggle('zen'); }
zenBtn.onclick = toggleZen;
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
  const act = {n: () => { setPanel(true); document.getElementById('what').focus(); }, c: () => setCal(calBox.hidden), s: openStats, t: () => themeBtn.click(), m: () => muBtn.click(),
    r: () => setPanel(panelEl.style.display === 'none'), h: toggleZen, l: () => { live = true; }, '?': openHelp}[e.key.toLowerCase()];
  if (act) { e.preventDefault(); act(); }
});

let deferredInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
addEventListener('appinstalled', () => { deferredInstall = null; notice('DayMate installed 🎉'); });
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});   // offline support (needs a web server)

// ---- Time control ----
slider.addEventListener('input', () => { live = false; time = parseFloat(slider.value); });
document.getElementById('live').addEventListener('click', () => { live = true; });
const wxBtn = document.getElementById('wx');
wxBtn.addEventListener('click', () => { wx = (wx + 1) % 4; wxBtn.textContent = 'Weather: ' + WX[wx]; });
playBtn.addEventListener('click', () => { live = false; playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; });
if (matchMedia('(prefers-reduced-motion: reduce)').matches) { playing = false; playBtn.textContent = 'Play'; }
requestAnimationFrame(draw);
