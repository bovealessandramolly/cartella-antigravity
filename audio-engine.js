/* ==========================================================================
   PENDERECKI'S GARDEN: WEB AUDIO SYNTHESIZER ENGINE
   ========================================================================= */

class PendereckiAudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.backgroundDrone = null;
        this.activeSynth = null;
        this.currentTrackIndex = -1;
        this.unlockedTracks = [true, false, false, false, false]; // Background + 4 hotspots
        
        // Equalizer Analyser Node
        this.analyser = null;
        this.visualizerCanvas = null;
        this.visualizerCtx = null;
        this.animationFrameId = null;
        
        // Track Definitions
        this.tracks = [
            {
                title: "De natura sonoris II",
                composer: "Krzysztof Penderecki",
                year: "1971",
                desc: "Soft organic microtonal cluster with bell-like high metallic resonances."
            },
            {
                title: "Threnody to the Victims of Hiroshima",
                composer: "Krzysztof Penderecki",
                year: "1960",
                desc: "High-intensity microtonal string glissandi cluster (screeching frequencies)."
            },
            {
                title: "Polymorphia",
                composer: "Krzysztof Penderecki",
                year: "1961",
                desc: "Densely textured white noise layers, randomized sweeps, and deep friction hum."
            },
            {
                title: "Symphony No. 3 (Passacaglia)",
                composer: "Krzysztof Penderecki",
                year: "1995",
                desc: "Deep driving sub-bass rhythmic pulses and heavy minor-second brass chords."
            }
        ];

        // Active node references for dynamic tweaking
        this.oscillators = [];
        this.filters = [];
        this.windSource = null;
        
        // Track play state
        this.isPlaying = false;
        this.durationCounter = 0;
        this.timerInterval = null;
    }

    /**
     * Initialize Audio Context and core routing chain
     * Must be called inside a user gesture handler (e.g. click Enter Garden)
     */
    async init() {
        if (this.ctx) return;
        
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        // Create Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        
        // Create Analyser for HUD visualizer
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 64;
        this.masterGain.connect(this.analyser);
        
        // Start background ambient drone
        this.startBackgroundDrone();
        
        // Fade in master volume
        this.masterGain.gain.linearRampToValueAtTime(0.65, this.ctx.currentTime + 3.0);
        this.isPlaying = true;
        this.startTrackTimer();
    }

    /**
     * Start the background ambient environmental hum (wind + low organ drone)
     */
    startBackgroundDrone() {
        if (!this.ctx) return;

        // 1. Low Frequency Hum (brooding drone)
        const lowOsc1 = this.ctx.createOscillator();
        const lowOsc2 = this.ctx.createOscillator();
        const lowGain = this.ctx.createGain();
        
        lowOsc1.type = 'triangle';
        lowOsc1.frequency.setValueAtTime(55.0, this.ctx.currentTime); // A1
        lowOsc1.frequency.setValueCurveAtTime(new Float32Array([55.0, 54.8, 55.2, 55.0]), this.ctx.currentTime, 10);
        
        lowOsc2.type = 'sine';
        lowOsc2.frequency.setValueAtTime(82.4, this.ctx.currentTime); // E2 (Perfect fifth, detuned)
        lowOsc2.frequency.setValueCurveAtTime(new Float32Array([82.4, 82.7, 82.1, 82.4]), this.ctx.currentTime, 10);

        lowGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        
        lowOsc1.connect(lowGain);
        lowOsc2.connect(lowGain);
        
        // Lowpass filter to keep it dark
        const lowFilter = this.ctx.createBiquadFilter();
        lowFilter.type = 'lowpass';
        lowFilter.frequency.setValueAtTime(180, this.ctx.currentTime);
        lowGain.connect(lowFilter);
        lowFilter.connect(this.masterGain);
        
        lowOsc1.start();
        lowOsc2.start();

        // 2. Soft Wind Texture (Filtered White Noise)
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(350, this.ctx.currentTime);
        noiseFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

        // Connect noise LFO to simulate gusts
        const windLfo = this.ctx.createOscillator();
        const windLfoGain = this.ctx.createGain();
        windLfo.frequency.setValueAtTime(0.08, this.ctx.currentTime); // Very slow swell
        windLfoGain.gain.setValueAtTime(200, this.ctx.currentTime); // 200Hz sweep
        
        windLfo.connect(windLfoGain);
        windLfoGain.connect(noiseFilter.frequency);
        
        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        whiteNoise.start();
        windLfo.start();

        this.backgroundDrone = {
            oscillators: [lowOsc1, lowOsc2, windLfo],
            gains: [lowGain, noiseGain],
            noiseSource: whiteNoise
        };
    }

    /**
     * Crossfade smoothly to a newly selected track/hotspot
     */
    async playTrack(index) {
        if (!this.ctx) return;
        
        // Stop current active synth
        await this.stopActiveSynth();
        
        this.currentTrackIndex = index;
        
        // Create new synthesizer specific to Penderecki's piece
        const synthVolume = this.ctx.createGain();
        synthVolume.gain.setValueAtTime(0.0, this.ctx.currentTime);
        synthVolume.connect(this.masterGain);

        const currentActiveNodes = {
            oscillators: [],
            gains: [synthVolume],
            filters: []
        };

        if (index === 0) {
            // --- De Natura Sonoris II ---
            // Shifting bell-like FM frequencies and soft random string tones
            const oscCount = 4;
            const frequencies = [660, 880, 1120, 1440];
            
            frequencies.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                
                // Slow organic vibrato/detune
                const lfo = this.ctx.createOscillator();
                const lfoGain = this.ctx.createGain();
                lfo.frequency.setValueAtTime(0.1 + Math.random() * 0.2, this.ctx.currentTime);
                lfoGain.gain.setValueAtTime(5 + Math.random() * 5, this.ctx.currentTime);
                
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                
                gain.gain.setValueAtTime(0.05 / oscCount, this.ctx.currentTime);
                
                osc.connect(gain);
                gain.connect(synthVolume);
                
                osc.start();
                lfo.start();
                
                currentActiveNodes.oscillators.push(osc, lfo);
                currentActiveNodes.gains.push(gain);
            });

            // Random metallic ringing bell triggers
            const bellInterval = setInterval(() => {
                if (this.currentTrackIndex !== 0) {
                    clearInterval(bellInterval);
                    return;
                }
                this.triggerBellStrike(synthVolume);
            }, 3000);
            
            currentActiveNodes.timerId = bellInterval;

        } else if (index === 1) {
            // --- Threnody to the Victims of Hiroshima ---
            // High pitch, sweeping microtonal cluster of 6 divergent frequencies
            const oscCount = 6;
            const baseFreq = 1200; // High string tone
            
            for (let i = 0; i < oscCount; i++) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sawtooth';
                // Initialize very close together
                osc.frequency.setValueAtTime(baseFreq + (i * 2), this.ctx.currentTime);
                
                // Lowpass filter to trim screech harshness
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1800, this.ctx.currentTime);
                
                gain.gain.setValueAtTime(0.02 / oscCount, this.ctx.currentTime);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(synthVolume);
                
                // Program an epic glissando divergence over 12 seconds
                const targetFreq = baseFreq + (i * 250) - 500;
                osc.frequency.exponentialRampToValueAtTime(targetFreq, this.ctx.currentTime + 15.0);
                
                osc.start();
                
                currentActiveNodes.oscillators.push(osc);
                currentActiveNodes.filters.push(filter);
                currentActiveNodes.gains.push(gain);
            }

        } else if (index === 2) {
            // --- Polymorphia ---
            // White noise texture layers, sweeping bandpasses, and randomized friction clicks
            const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseBuffer.length; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseSource = this.ctx.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            noiseSource.loop = true;

            const bandpass = this.ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.setValueAtTime(600, this.ctx.currentTime);
            bandpass.Q.setValueAtTime(2.0, this.ctx.currentTime);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);

            // Sweeping LFO for filter frequency
            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            lfo.frequency.setValueAtTime(0.15, this.ctx.currentTime);
            lfoGain.gain.setValueAtTime(400, this.ctx.currentTime);

            lfo.connect(lfoGain);
            lfoGain.connect(bandpass.frequency);

            noiseSource.connect(bandpass);
            bandpass.connect(gain);
            gain.connect(synthVolume);

            noiseSource.start();
            lfo.start();

            currentActiveNodes.oscillators.push(lfo);
            currentActiveNodes.gains.push(gain);
            currentActiveNodes.filters.push(bandpass);
            currentActiveNodes.noiseSource = noiseSource;

        } else if (index === 3) {
            // --- Symphony No. 3 (Passacaglia) ---
            // Brooding deep minor second brass cluster with periodic sub-bass stabs
            const f1 = 65.41;  // C2
            const f2 = 69.30;  // C#2 (brooding minor second friction)
            
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(f1, this.ctx.currentTime);
            
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(f2, this.ctx.currentTime);

            const lpFilter = this.ctx.createBiquadFilter();
            lpFilter.type = 'lowpass';
            lpFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
            
            const oscGain = this.ctx.createGain();
            oscGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

            osc1.connect(lpFilter);
            osc2.connect(lpFilter);
            lpFilter.connect(oscGain);
            oscGain.connect(synthVolume);

            osc1.start();
            osc2.start();

            currentActiveNodes.oscillators.push(osc1, osc2);
            currentActiveNodes.filters.push(lpFilter);
            currentActiveNodes.gains.push(oscGain);

            // Periodic low drum/sub-bass passacaglia stab (every 4 seconds)
            const stabInterval = setInterval(() => {
                if (this.currentTrackIndex !== 3) {
                    clearInterval(stabInterval);
                    return;
                }
                this.triggerBassStab(synthVolume);
            }, 4000);

            currentActiveNodes.timerId = stabInterval;
        }

        // Fade in new synth volume
        synthVolume.gain.linearRampToValueAtTime(0.55, this.ctx.currentTime + 2.0);
        this.activeSynth = currentActiveNodes;
        
        // Reset timer count
        this.durationCounter = 0;
        this.updateHUDTrackText(index);
    }

    /**
     * Trigger a delicate metallic bell ring for Track 1
     */
    triggerBellStrike(destinationGain) {
        if (!this.ctx) return;
        
        const bellOsc = this.ctx.createOscillator();
        const bellGain = this.ctx.createGain();
        
        bellOsc.type = 'sine';
        // Random metallic overtone pitch
        const pitches = [1760, 2200, 2640, 3520];
        const pitch = pitches[Math.floor(Math.random() * pitches.length)];
        bellOsc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
        
        bellGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        // Exponential decay
        bellGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 2.5);
        
        bellOsc.connect(bellGain);
        bellGain.connect(destinationGain);
        
        bellOsc.start();
        bellOsc.stop(this.ctx.currentTime + 2.6);
    }

    /**
     * Trigger a dramatic orchestral/sub bass stab for Track 4
     */
    triggerBassStab(destinationGain) {
        if (!this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(45.0, this.ctx.currentTime); // Super low F#0/G0
        // Pitch drop glissando
        osc.frequency.exponentialRampToValueAtTime(30.0, this.ctx.currentTime + 0.6);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(destinationGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 1.3);
    }

    /**
     * Stop active synthesizer nodes smoothly with crossfade
     */
    stopActiveSynth() {
        return new Promise((resolve) => {
            if (!this.activeSynth) {
                resolve();
                return;
            }

            const current = this.activeSynth;
            this.activeSynth = null;

            // Fade out active gain
            const volumeGain = current.gains[0];
            volumeGain.gain.cancelScheduledValues(this.ctx.currentTime);
            volumeGain.gain.setValueAtTime(volumeGain.gain.value, this.ctx.currentTime);
            volumeGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);

            // Clean up timers
            if (current.timerId) {
                clearInterval(current.timerId);
            }

            setTimeout(() => {
                // Stop all oscillators
                current.oscillators.forEach(osc => {
                    try { osc.stop(); } catch(e) {}
                });
                if (current.noiseSource) {
                    try { current.noiseSource.stop(); } catch(e) {}
                }
                resolve();
            }, 1300);
        });
    }

    /**
     * Play a sparkling gold particle unlock chime sound
     */
    playUnlockChime() {
        if (!this.ctx) return;
        
        const now = this.ctx.currentTime;
        const chimeGain = this.ctx.createGain();
        chimeGain.gain.setValueAtTime(0.0, now);
        chimeGain.gain.linearRampToValueAtTime(0.35, now + 0.05);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
        chimeGain.connect(this.masterGain);

        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C major pentatonic sparkly chords
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + (idx * 0.08));
            
            // Subtle vibrato
            const vib = this.ctx.createOscillator();
            const vibGain = this.ctx.createGain();
            vib.frequency.value = 8;
            vibGain.gain.value = 3;
            vib.connect(vibGain);
            vibGain.connect(osc.frequency);

            osc.connect(chimeGain);
            
            osc.start(now + (idx * 0.08));
            vib.start(now + (idx * 0.08));
            osc.stop(now + 2.5);
            vib.stop(now + 2.5);
        });
    }

    /**
     * Unlock a specific track by index
     */
    unlockTrack(index) {
        if (index < 0 || index >= this.tracks.length) return;
        if (this.unlockedTracks[index + 1]) return; // Already unlocked
        
        this.unlockedTracks[index + 1] = true;
        this.playUnlockChime();
        
        // Update Playlist Card UI
        const lockIcon = document.getElementById(`pl-lock-${index}`);
        if (lockIcon) {
            lockIcon.classList.remove('locked');
            lockIcon.classList.add('unlocked');
        }

        // Trigger custom UI event
        const event = new CustomEvent('trackUnlocked', { detail: { index } });
        window.dispatchEvent(event);
    }

    /**
     * Play tree foliage rustling soundscape using synthetic noise (No external files!)
     */
    playTreeRustle(speciesName) {
        if (!this.ctx) return null;
        
        // Create noise buffer
        const bufferSize = this.ctx.sampleRate * 4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.5);

        // Customize filter settings to mimic the specific leaf acoustic profiles
        if (speciesName === 'yew') {
            // Yew has needles: high frequency rustle, hiss-like
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2200, this.ctx.currentTime);
            filter.Q.setValueAtTime(1.0, this.ctx.currentTime);
        } else if (speciesName === 'beech') {
            // Beech has dry thin paper leaves: mid range rustle, crackle-like
            filter.type = 'peaking';
            filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
            filter.Q.setValueAtTime(0.8, this.ctx.currentTime);
            filter.gain.setValueAtTime(8, this.ctx.currentTime);
        } else {
            // Hornbeam: soft broad-leaf wave
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(850, this.ctx.currentTime);
        }

        // LFO simulating slow wind gusts
        const windLfo = this.ctx.createOscillator();
        const windLfoGain = this.ctx.createGain();
        windLfo.frequency.setValueAtTime(0.25, this.ctx.currentTime);
        windLfoGain.gain.setValueAtTime(gain.gain.value * 0.15, this.ctx.currentTime);
        
        windLfo.connect(windLfoGain);
        windLfoGain.connect(gain.gain);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        source.start();
        windLfo.start();

        return {
            source,
            gain,
            windLfo,
            stop: () => {
                gain.gain.cancelScheduledValues(this.ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.8);
                setTimeout(() => {
                    try { source.stop(); } catch(e) {}
                    try { windLfo.stop(); } catch(e) {}
                }, 900);
            }
        };
    }

    /**
     * Setup equalizing analyzer canvas bars
     */
    setupVisualizer(canvasElement) {
        this.visualizerCanvas = canvasElement;
        this.visualizerCtx = canvasElement.getContext('2d');
        this.drawVisualizer();
    }

    /**
     * Recursively render dynamic visualizer bars matching synthesizer frequencies
     */
    drawVisualizer() {
        if (!this.visualizerCtx || !this.analyser) {
            this.animationFrameId = requestAnimationFrame(() => this.drawVisualizer());
            return;
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            this.animationFrameId = requestAnimationFrame(draw);
            
            if (!this.isPlaying) {
                // Draw flat line or static bars
                this.visualizerCtx.clearRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height);
                this.visualizerCtx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                for (let i = 0; i < 4; i++) {
                    this.visualizerCtx.fillRect(i * 6, this.visualizerCanvas.height - 2, 4, 2);
                }
                return;
            }

            this.analyser.getByteFrequencyData(dataArray);
            
            this.visualizerCtx.clearRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height);
            
            const barWidth = 4;
            const barGap = 2;
            const maxBars = 4;
            
            for (let i = 0; i < maxBars; i++) {
                // Pull from mid frequency ranges for aesthetic bouncing
                const dataIndex = Math.floor(i * (bufferLength / maxBars) * 0.7);
                const percent = dataArray[dataIndex] / 255;
                const barHeight = Math.max(3, percent * this.visualizerCanvas.height);
                
                // Gold color highlight or white depending on active track
                if (this.currentTrackIndex !== -1) {
                    this.visualizerCtx.fillStyle = `rgba(226, 199, 131, ${0.4 + percent * 0.6})`;
                } else {
                    this.visualizerCtx.fillStyle = `rgba(255, 255, 255, ${0.2 + percent * 0.5})`;
                }
                
                const x = i * (barWidth + barGap);
                const y = this.visualizerCanvas.height - barHeight;
                this.visualizerCtx.fillRect(x, y, barWidth, barHeight);
            }
        };

        draw();
    }

    /**
     * Start track timeline playtime counter
     */
    startTrackTimer() {
        this.timerInterval = setInterval(() => {
            if (this.isPlaying) {
                this.durationCounter++;
                const mins = String(Math.floor(this.durationCounter / 60)).padStart(2, '0');
                const secs = String(this.durationCounter % 60).padStart(2, '0');
                
                const timeEl = document.getElementById('track-time-display');
                if (timeEl) {
                    timeEl.textContent = `${mins}:${secs}`;
                }
            }
        }, 1000);
    }

    /**
     * Update bottom HUD player track typography metadata
     */
    updateHUDTrackText(index) {
        const titleEl = document.getElementById('hud-track-title');
        const compEl = document.getElementById('hud-track-composer');
        
        if (index === -1) {
            if (titleEl) titleEl.textContent = "Sonorous Background Drone";
            if (compEl) compEl.textContent = "Krzysztof Penderecki";
        } else {
            const track = this.tracks[index];
            if (titleEl) titleEl.textContent = track.title;
            if (compEl) compEl.textContent = `${track.composer} (${track.year})`;
        }
    }

    /**
     * Toggle entire audio engine play/pause state
     */
    togglePlayPause() {
        if (!this.ctx) return false;
        
        if (this.isPlaying) {
            // Fade out master
            this.masterGain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.8);
            this.isPlaying = false;
        } else {
            // Resume context if suspended
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            // Fade in master
            this.masterGain.gain.linearRampToValueAtTime(0.65, this.ctx.currentTime + 0.8);
            this.isPlaying = true;
        }
        return this.isPlaying;
    }
}

// Global Export
window.PendereckiAudioEngine = PendereckiAudioEngine;
