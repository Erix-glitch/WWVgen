// Use recorded WWV audio instead of synthesizing tones on the fly.
const players = new Tone.Players({
  zero: "sounds/digital_zero.wav",
  one: "sounds/digital_one.wav",
  marker: "sounds/digital_marker.wav",
}).toDestination();

const symbolToSample = {
  0: "zero",
  1: "one",
  M: "marker",
};

const playersLoaded = players.loaded;

let isPlaying = false;

// Convert a Date into its 1-based day-of-year value (UTC calendar).
function dayOfYearUTC(d) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start;
  return Math.floor(ms / 86400000) + 1;
}

// Push a binary coded decimal digit into the frame using provided bit weights.
function pushBCD(bits, value, weights) {
  for (const w of weights) bits.push((value & w) ? 1 : 0);
}

// Build one 60-second frame that matches the WWV time-code layout.
function buildFrameUTC(now = new Date()) {
  const frame = new Array(60).fill(0);
  // Seconds containing minute markers use null until we assign a symbol later.
  frame[0] = null;
  [9,19,29,39,49,59].forEach(s => frame[s] = "M");

  // Break out time/date components that WWV transmits (UTC).
  const yy = now.getUTCFullYear() % 100;
  const mm = now.getUTCMinutes();
  const hh = now.getUTCHours();
  const yUnits = yy % 10, yTens = Math.floor(yy / 10);
  const doy = dayOfYearUTC(now);
  const doyUnits = doy % 10;
  const doyTens  = Math.floor(doy / 10) % 10;
  const doyHund  = Math.floor(doy / 100);

  // Preamble and minute units.
  frame[1] = 0; frame[2] = 0; frame[3] = 0;
  pushBCD(frame, yUnits, [1,2,4,8]);
  frame[8] = 0;

  // Minute BCD digits and marker parity slot.
  const minUnits = mm % 10, minTens = Math.floor(mm / 10);
  [10,11,12,13].forEach((idx,i)=> frame[idx] = ((minUnits >> i) & 1) ? 1 : 0);
  frame[14] = 0;
  [15,16,17].forEach((idx,i)=> frame[idx] = ((minTens * 10) >> (i)) & 1 ? 1 : 0);
  frame[18] = 0;

  // Hour digits.
  const hrUnits = hh % 10, hrTens = Math.floor(hh / 10);
  [20,21,22,23].forEach((idx,i)=> frame[idx] = ((hrUnits >> i) & 1) ? 1 : 0);
  frame[24] = 0;
  frame[25] = (hrTens & 1) ? 1 : 0;
  frame[26] = (hrTens & 2) ? 1 : 0;
  frame[27] = 0;

  // Day-of-year digits.
  [30,31,32,33].forEach((idx,i)=> frame[idx] = ((doyUnits >> i) & 1) ? 1 : 0);
  frame[34] = 0;
  [35,36,37,38].forEach((idx,i)=> frame[idx] = ((doyTens << 1) >> i) & 1 ? 1 : 0);
  frame[40] = (doyHund & 1) ? 1 : 0;
  frame[41] = (doyHund & 2) ? 1 : 0;
  frame[42] = frame[43] = frame[44] = frame[45] = frame[46] = frame[47] = frame[48] = 0;
  frame[50] = 1;

  // Year tens digit and trailing housekeeping bits.
  [51,52,53,54].forEach((idx,i)=> frame[idx] = ((yTens << 1) >> i) & 1 ? 1 : 0);
  frame[55] = 0;

  // Replace placeholders with zeros so later scheduling logic can treat them uniformly.
  for (let s = 0; s < 60; s++) {
    if (s === 0) continue;
    if (frame[s] === undefined || frame[s] === null) frame[s] = 0;
  }
  return frame;
}

// Schedule one minute of audio by triggering the right sample for each WWV symbol.
function scheduleMinute(frame, baseTime = 0) {
  for (let s = 0; s < 60; s++) {
    const sym = frame[s];
    if (sym === null || sym === undefined) continue;
    const playerId = symbolToSample[sym];
    if (!playerId) continue;
    Tone.Transport.schedule((time) => {
      const player = players.player(playerId);
      player.stop(time);
      player.start(time);
    }, baseTime + s);
  }
}

// Continuously rebuild and play frames so the stream stays synchronized with real time.
function buildWWV() {
  Tone.Transport.cancel(0);
  Tone.Transport.scheduleRepeat((time) => {
    const frame = buildFrameUTC(new Date());
    scheduleMinute(frame, time);
  }, "60s", "+0");
  Tone.Transport.loop = false;
  Tone.Transport.loopStart = 0;
  Tone.Transport.loopEnd = "60s";
}

const startButton = document.getElementById('start');

// Toggle playback: start Tone.js, build the repeating WWV frame, and update the UI.
startButton.addEventListener('click', async () => {
  if (isPlaying) {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    players.stopAll();
    startButton.textContent = "Start";
    startButton.classList.remove('bg-red-500', 'hover:bg-red-800');
    isPlaying = false;
    return;
  }

  await Tone.start();
  await playersLoaded;
  players.stopAll();
  buildWWV();
  startButton.textContent = "Stop";
  startButton.classList.add('bg-red-500', 'hover:bg-red-800');
  Tone.Transport.start("+0.1");
  isPlaying = true;
});
