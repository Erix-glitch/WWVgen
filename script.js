const osc = new Tone.Oscillator(100, "sine").toDestination();

document.body.addEventListener('click', () => {
    osc.start();
    setTimeout(() => osc.stop(), 1000);
});