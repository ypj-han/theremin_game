class Theremin{
    constructor(){
        this.oscillator = audioCtx.createOscillator();
        this.gainNode = audioCtx.createGain();
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(audioCtx.destination);
        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        this.oscillator.start();
    }
    setFrequency(value){
        this.oscillator.frequency.setValueAtTime(value, audioCtx.currentTime);
    }
    setVolume(value){
        this.gainNode.gain.setValueAtTime(value, audioCtx.currentTime);
    }
    stop(){
        this.oscillator.stop();
    }
}