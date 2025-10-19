const HIGH = 0.5;
const LOW  = 0.0;
const FREQ = 100;

const subOsc = new Tone.Oscillator(FREQ, "sine");
const subGain = new Tone.Gain(0).toDestination();
subOsc.connect(subGain).start();
let isPlaying = false;

function dayOfYearUTC(d) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start;
  return Math.floor(ms / 86400000) + 1;
}

function pushBCD(bits, value, weights) {
  for (const w of weights) bits.push((value & w) ? 1 : 0);
}

function buildFrameUTC(now = new Date()) {
  const frame = new Array(60).fill(0);
  frame[0] = null;
  [9,19,29,39,49,59].forEach(s => frame[s] = "M");
  const yy = now.getUTCFullYear() % 100;
  const mm = now.getUTCMinutes();
  const hh = now.getUTCHours();
  const yUnits = yy % 10, yTens = Math.floor(yy / 10);
  const doy = dayOfYearUTC(now);
  const doyUnits = doy % 10;
  const doyTens  = Math.floor(doy / 10) % 10;
  const doyHund  = Math.floor(doy / 100);
  frame[1] = 0; frame[2] = 0; frame[3] = 0;
  pushBCD(frame, yUnits, [1,2,4,8]);
  frame[8] = 0;
  const minUnits = mm % 10, minTens = Math.floor(mm / 10);
  [10,11,12,13].forEach((idx,i)=> frame[idx] = ((minUnits >> i) & 1) ? 1 : 0);
  frame[14] = 0;
  [15,16,17].forEach((idx,i)=> frame[idx] = ((minTens * 10) >> (i)) & 1 ? 1 : 0);
  frame[18] = 0;
  const hrUnits = hh % 10, hrTens = Math.floor(hh / 10);
  [20,21,22,23].forEach((idx,i)=> frame[idx] = ((hrUnits >> i) & 1) ? 1 : 0);
  frame[24] = 0;
  frame[25] = (hrTens & 1) ? 1 : 0;
  frame[26] = (hrTens & 2) ? 1 : 0;
  frame[27] = 0;
  [30,31,32,33].forEach((idx,i)=> frame[idx] = ((doyUnits >> i) & 1) ? 1 : 0);
  frame[34] = 0;
  [35,36,37,38].forEach((idx,i)=> frame[idx] = ((doyTens << 1) >> i) & 1 ? 1 : 0);
  frame[40] = (doyHund & 1) ? 1 : 0;
  frame[41] = (doyHund & 2) ? 1 : 0;
  frame[42] = frame[43] = frame[44] = frame[45] = frame[46] = frame[47] = frame[48] = 0;
  frame[50] = 1;
  [51,52,53,54].forEach((idx,i)=> frame[idx] = ((yTens << 1) >> i) & 1 ? 1 : 0);
  frame[55] = 0;
  for (let s = 0; s < 60; s++) {
    if (s === 0) continue;
    if (frame[s] === undefined || frame[s] === null) frame[s] = 0;
  }
  return frame;
}

function scheduleMinute(frame, base = 0) {
  Tone.Transport.schedule((t)=> subGain.gain.setValueAtTime(0, t + 0), base + 0);
  for (let s = 0; s < 60; s++) {
    const sym = frame[s];
    if (s === 0 || sym === null) {
      Tone.Transport.schedule((t)=> subGain.gain.setValueAtTime(0, t), base + s);
      continue;
    }
    Tone.Transport.schedule((t)=> subGain.gain.setValueAtTime(HIGH, t + 0.03), base + s);
    let drop = 0.2;
    if (sym === 1) drop = 0.5;
    if (sym === "M") drop = 0.8;
    Tone.Transport.schedule((t)=> subGain.gain.setValueAtTime(LOW, t + drop), base + s);
  }
}

function buildWWV() {
  Tone.Transport.cancel(0);
  Tone.Transport.scheduleRepeat((time) => {
    const frame = buildFrameUTC(new Date());
    scheduleMinute(frame, 0);
  }, "60s", "+0");
  Tone.Transport.loop = false;
  Tone.Transport.loopStart = 0;
  Tone.Transport.loopEnd = "60s";
}

const startButton = document.getElementById('start');

startButton.addEventListener('click', async () => {
  if (isPlaying) {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    subGain.gain.setValueAtTime(LOW, Tone.now());
    startButton.textContent = "Start";
    startButton.classList.remove('bg-red-500', 'hover:bg-red-800');
    isPlaying = false;
    return;
  }

  await Tone.start();
  buildWWV();
  startButton.textContent = "Stop";
  startButton.classList.add('bg-red-500', 'hover:bg-red-800');
  Tone.Transport.start("+0.1");
  isPlaying = true;
});
