const synth = new Tone.Synth().toDestination();

document.body.addEventListener('click', () => {
    synth.triggerAttackRelease('C4', '8n');
});