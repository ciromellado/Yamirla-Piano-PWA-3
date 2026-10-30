// ==========================================
// YAMILA PIANO PWA-3 — app.js (CORREGIDO)
// ==========================================

const statusDiv = document.getElementById('status');
const keyboardDiv = document.getElementById('keyboard');
const presetSelect = document.getElementById('preset');
const midiInputSelect = document.getElementById('midi-input');
const midiOutputSelect = document.getElementById('midi-output');
const chordNameDisplay = document.getElementById('chord-name');
const notesDetectedDisplay = document.getElementById('notes-detected');

const staffCanvas = document.getElementById('music-staff');

const sliderVolume = document.getElementById('slider-volume');
const valVolume = document.getElementById('val-volume');
const sliderReverb = document.getElementById('slider-reverb');
const valReverb = document.getElementById('val-reverb');
const sliderDecay = document.getElementById('slider-decay');
const valDecay = document.getElementById('val-decay');
const sliderDelay = document.getElementById('slider-delay');
const valDelay = document.getElementById('val-delay');

const btnPadToggle = document.getElementById('btn-pad-toggle');
const padPresetSelect = document.getElementById('pad-preset');
const knobPadVol = document.getElementById('knob-pad-vol');
const valPadVol = document.getElementById('val-pad-vol');

const btnSustain = document.getElementById('btn-sustain');

const startNote = 36;
const numKeys = 61;
const midiElements = {};
const activeOscillators = {};
const activePadOscillators = {};
const activeNotesSet = new Set();
let sustainActive = false;
const sustainedNotes = new Set();
let currentMidiAccess = null;
let activeMidiInput = null;
let activeMidiOutput = null;

let sustainButtonActive = false;
const sustainTimers = {};

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx, mainMasterGain, convolverNode, wetGain, dryGain;
let delayNode, delayFeedbackNode, delayWetGain;
let analyserNode;

let volumeLevel = 3;
let reverbLevel = 2;
let decayLevel = 1;
let delayLevel = 1;
let padEnabled = false;
let padVolumeLevel = 3;

// --- Batch drawing del pentagrama ---
let staffDirty = false;
function requestStaffDraw() {
    if (staffDirty) return;
    staffDirty = true;
    requestAnimationFrame(() => {
        staffDirty = false;
        drawStaff();
    });
}

const soundPresets = {
    "piano-korg": "sonidos/piano-korg/",
    "piano-kawai": "sonidos/piano-kawai/",
    "bright": "sonidos/bright/",
    "motif": "sonidos/motif/",
    "wurlitzer": "sonidos/electric-piano/",
    "rhodes-piano": "sonidos/rhodes-piano/",
    "acustic-guitar": "sonidos/acustic-guitar/",
    "donnys-guitar": "sonidos/donnys-guitar/",
    "accordion_vallenato": "sonidos/hohner-corona/",
    "accordion_cumbia": "sonidos/acordeon-sabanero/",
    "hammond": "sonidos/organo-1/",
    "organ-jazz": "sonidos/organo-jazz/",
    "string-Roland": "sonidos/string/",
    "trumpet": "sonidos/trompetas/",
    "trombone": "sonidos/trombon/"
};

const sampleNotes = ["C2", "G2", "C3", "G3", "C4", "G4", "C5", "G5", "C6", "G6"];
const loadedSampleBuffers = {};

// ==========================================
// INICIALIZACIÓN DEL MOTOR DE AUDIO
// ==========================================
function initAudioEngine() {
    if (audioCtx) return;

    audioCtx = new AudioContext({ latencyHint: 'interactive' });

    mainMasterGain = audioCtx.createGain();
    updateVolumeValue(volumeLevel);

    convolverNode = audioCtx.createConvolver();
    createReverbImpulse();
    wetGain = audioCtx.createGain();
    dryGain = audioCtx.createGain();
    updateReverbValue(reverbLevel);

    delayNode = audioCtx.createDelay(2.0);
    delayNode.delayTime.value = 0.35;
    delayFeedbackNode = audioCtx.createGain();
    delayWetGain = audioCtx.createGain();
    delayWetGain.gain.value = 0;

    delayNode.connect(delayFeedbackNode);
    delayFeedbackNode.connect(delayNode);
    mainMasterGain.connect(delayNode);
    delayNode.connect(delayWetGain);
    delayWetGain.connect(audioCtx.destination);

    updateDecayValue(decayLevel);
    updateDelayValue(delayLevel);

    mainMasterGain.connect(dryGain);
    mainMasterGain.connect(convolverNode);
    convolverNode.connect(wetGain);
    dryGain.connect(audioCtx.destination);
    wetGain.connect(audioCtx.destination);

    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;
    mainMasterGain.connect(analyserNode);
}

// ==========================================
// DECAY
// ==========================================
function getDecayTime() {
    const decayTimes = [2.0, 0.2, 0.5, 1.2, 2.5];
    return decayTimes[decayLevel - 1] || 1.0;
}

// ==========================================
// CARGA DE SAMPLES
// ==========================================
async function loadPresetSamples(presetName) {
    if (loadedSampleBuffers[presetName]) return;
    const folderPath = soundPresets[presetName];
    if (!folderPath) {
        console.warn(`No hay carpeta configurada para: ${presetName}`);
        return;
    }

    loadedSampleBuffers[presetName] = {};
    if (statusDiv) statusDiv.textContent = `⏳ Cargando muestras de ${presetName}...`;

    for (let noteName of sampleNotes) {
        try {
            const response = await fetch(`${folderPath}${noteName}.ogg`);
            if (!response.ok) throw new Error(`No se encontró ${noteName}.ogg`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            loadedSampleBuffers[presetName][noteName] = audioBuffer;
        } catch (error) {
            console.error(`Error cargando sample:`, error);
        }
    }
    if (statusDiv) statusDiv.textContent = `✅ Listo: ${presetName}`;
}

const baseMidiMap = {
    "C2": 36, "G2": 43, "C3": 48, "G3": 55,
    "C4": 60, "G4": 67, "C5": 72, "G5": 79,
    "C6": 84, "G6": 91
};

function getClosestSampleNote(midiNote) {
    let closestNote = "C4";
    let minDiff = Infinity;
    for (let noteName in baseMidiMap) {
        const diff = Math.abs(midiNote - baseMidiMap[noteName]);
        if (diff < minDiff) {
            minDiff = diff;
            closestNote = noteName;
        }
    }
    return closestNote;
}

// ==========================================
// DOMContentLoaded
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    initAudioEngine();
    const initialPreset = presetSelect ? presetSelect.value : 'piano-korg';
    await loadPresetSamples(initialPreset);
    requestStaffDraw();

    Object.keys(soundPresets).forEach(preset => {
        if (preset !== initialPreset) {
            loadPresetSamples(preset);
        }
    });
});

// ==========================================
// Suspend/resume en background
// ==========================================
document.addEventListener('visibilitychange', () => {
    if (!audioCtx) return;
    if (document.hidden) {
        audioCtx.suspend();
    } else {
        audioCtx.resume();
    }
});

// ==========================================
// SLIDERS Y CONTROLES
// ==========================================
function updateVolumeValue(val) {
    volumeLevel = parseInt(val);
    const gainValues = [0.0, 0.25, 0.5, 0.75, 1.0];
    if (mainMasterGain && audioCtx) {
        mainMasterGain.gain.setTargetAtTime(gainValues[volumeLevel - 1], audioCtx.currentTime, 0.03);
    }
    if (valVolume) valVolume.textContent = volumeLevel;
}

function updateReverbValue(val) {
    reverbLevel = parseInt(val);
    const reverbValues = [0.0, 0.2, 0.4, 0.6, 0.8];
    const actualMix = reverbValues[reverbLevel - 1];
    if (wetGain && dryGain && audioCtx) {
        wetGain.gain.setTargetAtTime(actualMix, audioCtx.currentTime, 0.05);
        dryGain.gain.setTargetAtTime(1.0 - (actualMix * 0.5), audioCtx.currentTime, 0.05);
    }
    if (valReverb) valReverb.textContent = reverbLevel;
}

function updateDecayValue(val) {
    decayLevel = parseInt(val);
    if (valDecay) valDecay.textContent = decayLevel === 1 ? "OFF" : decayLevel;
}

function updateDelayValue(val) {
    delayLevel = parseInt(val);
    const delaySettings = [
        { wet: 0.0, fb: 0.0 }, { wet: 0.2, fb: 0.25 }, { wet: 0.4, fb: 0.35 },
        { wet: 0.6, fb: 0.45 }, { wet: 0.8, fb: 0.55 }
    ];
    const settings = delaySettings[delayLevel - 1];
    if (delayWetGain && delayFeedbackNode && audioCtx) {
        delayWetGain.gain.setTargetAtTime(settings.wet, audioCtx.currentTime, 0.05);
        delayFeedbackNode.gain.setTargetAtTime(settings.fb, audioCtx.currentTime, 0.05);
    }
    if (valDelay) valDelay.textContent = delayLevel === 1 ? "OFF" : delayLevel;
}

function updatePadVolValue(val) {
    padVolumeLevel = parseInt(val);
    if (valPadVol) valPadVol.textContent = padVolumeLevel;
    if (knobPadVol) {
        const indicator = knobPadVol.querySelector('.pad-knob-indicator');
        if (indicator) {
            const angles = { 1: -135, 2: -67.5, 3: 0, 4: 67.5, 5: 135 };
            indicator.style.transform = `translateX(-50%) rotate(${angles[padVolumeLevel] || 0}deg)`;
        }
        knobPadVol.dataset.level = padVolumeLevel;
    }
}

if (sliderVolume) sliderVolume.addEventListener('input', (e) => updateVolumeValue(e.target.value));
if (sliderReverb) sliderReverb.addEventListener('input', (e) => updateReverbValue(e.target.value));
if (sliderDecay) sliderDecay.addEventListener('input', (e) => updateDecayValue(e.target.value));
if (sliderDelay) sliderDelay.addEventListener('input', (e) => updateDelayValue(e.target.value));

if (knobPadVol) {
    updatePadVolValue(padVolumeLevel);
    knobPadVol.addEventListener('click', () => {
        let currentLevel = parseInt(knobPadVol.dataset.level) || padVolumeLevel;
        updatePadVolValue(currentLevel >= 5 ? 1 : currentLevel + 1);
    });
}

if (btnPadToggle) {
    btnPadToggle.addEventListener('click', () => {
        padEnabled = !padEnabled;
        if (padEnabled) {
            btnPadToggle.textContent = "ON";
            btnPadToggle.className = "pad-btn-on";
            btnPadToggle.style.background = "#ff8c00";
            btnPadToggle.style.color = "#000";
        } else {
            btnPadToggle.textContent = "OFF";
            btnPadToggle.className = "pad-btn-off";
            btnPadToggle.style.background = "#555";
            btnPadToggle.style.color = "#fff";
            Object.keys(activePadOscillators).forEach(note => stopPadInstance(note));
        }
    });
}

if (btnSustain) {
    btnSustain.addEventListener('click', () => {
        sustainButtonActive = !sustainButtonActive;
        if (sustainButtonActive) {
            btnSustain.textContent = "ON";
            btnSustain.className = "sustain-btn-on";
        } else {
            btnSustain.textContent = "OFF";
            btnSustain.className = "sustain-btn-off";
            releaseAllSustainedNotes();
        }
    });
}

// ==========================================
// REVERB IMPULSE
// ==========================================
function createReverbImpulse() {
    if (!audioCtx) return;
    const rate = audioCtx.sampleRate;
    const length = rate * 2.5;
    const impulse = audioCtx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / (rate * 0.5));
        left[i] = (Math.random() * 2 - 1) * decay;
        right[i] = (Math.random() * 2 - 1) * decay;
    }
    convolverNode.buffer = impulse;
}

// ==========================================
// CAMBIO DE PRESET
// ==========================================
if (presetSelect) {
    presetSelect.addEventListener('change', async () => {
        initAudioEngine();
        const selectedPreset = presetSelect.value;
        if (statusDiv) statusDiv.textContent = `Cambiado a ${selectedPreset}...`;
        await loadPresetSamples(selectedPreset);
    });
}

// ==========================================
// SUSTAIN
// ==========================================
function releaseSustainedNotes() {
    sustainedNotes.forEach(note => {
        const keyElement = midiElements[note];
        if (keyElement) keyElement.classList.remove('active');
        if (keyElement && !keyElement.hasAttribute('data-pressed')) {
            releaseNoteWithFade(note);
        }
    });
    sustainedNotes.clear();
    requestStaffDraw();
}

function releaseAllSustainedNotes() {
    sustainedNotes.forEach(note => {
        releaseNoteWithFade(note);
    });
    sustainedNotes.clear();
    requestStaffDraw();
}

function releaseNoteWithFade(note) {
    const keyElement = midiElements[note];

    if (sustainTimers[note]) {
        clearTimeout(sustainTimers[note]);
        delete sustainTimers[note];
    }

    sustainedNotes.delete(note);

    if (activeOscillators[note]) {
        const instance = activeOscillators[note];
        if (instance.source && instance.gainNode) {
            const { source, gainNode } = instance;
            const now = audioCtx.currentTime;
            const releaseTime = getDecayTime();
            try {
                gainNode.gain.cancelScheduledValues(now);
                gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                gainNode.gain.linearRampToValueAtTime(0.0001, now + releaseTime);
                source.onended = () => {
                    source.disconnect();
                    gainNode.disconnect();
                };
                source.stop(now + releaseTime + 0.05);
            } catch (e) {
                try { source.stop(); } catch (err) {}
            }
        }
        delete activeOscillators[note];
    }

    stopPadInstance(note);
    requestStaffDraw();
}

// ==========================================
// PENTAGRAMA
// ==========================================
function getDiatonicStep(midi) {
    const diatonicBase = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    const octave = Math.floor(midi / 12);
    return (octave * 7) + diatonicBase[midi % 12];
}

function drawStaff() {
    if (!staffCanvas) return;
    const ctx = staffCanvas.getContext('2d');
    const width = staffCanvas.width;
    const height = staffCanvas.height;

    ctx.clearRect(0, 0, width, height);

    const lineSpacing = 12;
    const midLineY = 90;
    const topLineY = 66;
    const bottomLineY = 114;

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#d1d5db';

    const leftStartX = 40;
    const leftEndX = 360;
    for (let i = 0; i < 5; i++) {
        const y = topLineY + (i * lineSpacing);
        ctx.beginPath();
        ctx.moveTo(leftStartX, y);
        ctx.lineTo(leftEndX, y);
        ctx.stroke();
    }

    ctx.fillStyle = '#00bcd4';
    ctx.font = '44px Arial';
    ctx.fillText('𝄢', 50, 102);

    const rightStartX = 440;
    const rightEndX = 760;
    for (let i = 0; i < 5; i++) {
        const y = topLineY + (i * lineSpacing);
        ctx.beginPath();
        ctx.moveTo(rightStartX, y);
        ctx.lineTo(rightEndX, y);
        ctx.stroke();
    }

    ctx.fillStyle = '#00bcd4';
    ctx.font = '48px Arial';
    ctx.fillText('𝄞', 440, 106);

    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 55);
    ctx.lineTo(400, 125);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    activeNotesSet.forEach(midiNote => {
        const step = getDiatonicStep(midiNote);
        let y;
        const semitoneSpacing = 8;
        let x;
        if (midiNote < 60) {
            x = 60 + ((midiNote - 36) * semitoneSpacing);
        } else {
            x = 460 + ((midiNote - 60) * semitoneSpacing);
        }

        if (midiNote < 60) {
            const f3Step = getDiatonicStep(53);
            y = 78 - (step - f3Step) * (lineSpacing / 2);
        } else {
            const c4Step = getDiatonicStep(60);
            y = 126 - (step - c4Step) * (lineSpacing / 2);
        }

        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 2.0;

        if (y < topLineY) {
            for (let ledgerY = topLineY - lineSpacing; ledgerY >= y; ledgerY -= lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(x - 14, ledgerY);
                ctx.lineTo(x + 14, ledgerY);
                ctx.stroke();
            }
        } else if (y > bottomLineY) {
            for (let ledgerY = bottomLineY + lineSpacing; ledgerY <= y; ledgerY += lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(x - 14, ledgerY);
                ctx.lineTo(x + 14, ledgerY);
                ctx.stroke();
            }
        }

        ctx.fillStyle = '#ff8c00';
        ctx.beginPath();
        ctx.ellipse(x, y, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ff8c00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (y <= midLineY) {
            ctx.moveTo(x - 7, y);
            ctx.lineTo(x - 7, y + 25);
        } else {
            ctx.moveTo(x + 7, y);
            ctx.lineTo(x + 7, y - 25);
        }
        ctx.stroke();
    });
}

// ==========================================
// TECLADO
// ==========================================
function buildKeyboard() {
    if (!keyboardDiv) return;

    const whiteKeyWidth = 36;
    const pianoPadding = 10;
    let whiteIndex = 0;
    let totalWhiteKeys = 0;

    for (let i = 0; i < numKeys; i++) {
        const nInOct = (startNote + i) % 12;
        if (![1, 3, 6, 8, 10].includes(nInOct)) totalWhiteKeys++;
    }

    keyboardDiv.style.width = `${totalWhiteKeys * whiteKeyWidth + pianoPadding * 2}px`;

    for (let i = 0; i < numKeys; i++) {
        const noteNumber = startNote + i;
        const noteInOctave = noteNumber % 12;
        const octave = Math.floor(noteNumber / 12) - 1;
        const isBlack = [1, 3, 6, 8, 10].includes(noteInOctave);

        const key = document.createElement('div');
        key.className = `key ${isBlack ? 'black' : 'white'}`;
        key.dataset.note = noteNumber;
        key.innerHTML = `<span>${noteNames[noteInOctave]}</span><span style="font-size:0.8rem; opacity:0.7;">${octave}</span>`;

        let touchStartTime = 0;

        const startNoteEvent = (e) => {
            if (e.cancelable) e.preventDefault();
            key.setAttribute('data-pressed', 'true');
            touchStartTime = performance.now();
            noteOn(noteNumber, 100, true);
        };

        const endNoteEvent = (e) => {
            if (e.cancelable) e.preventDefault();
            key.removeAttribute('data-pressed');
            noteOff(noteNumber, true);
        };

        key.addEventListener('mousedown', startNoteEvent);
        key.addEventListener('mouseup', endNoteEvent);
        key.addEventListener('mouseleave', () => {
            if (key.hasAttribute('data-pressed')) endNoteEvent(new Event('mouseup'));
        });
        key.addEventListener('touchstart', startNoteEvent, { passive: false });
        key.addEventListener('touchend', endNoteEvent, { passive: false });

        if (!isBlack) {
            key.style.left = `${pianoPadding + whiteIndex * whiteKeyWidth}px`;
            keyboardDiv.appendChild(key);
            whiteIndex++;
        } else {
            key.style.left = `${pianoPadding + (whiteIndex - 1) * whiteKeyWidth + whiteKeyWidth - 11}px`;
            keyboardDiv.appendChild(key);
        }

        midiElements[noteNumber] = key;
    }
}

buildKeyboard();

// ==========================================
// NOTE ON / OFF
// ==========================================
async function noteOn(note, velocity, fromMouse = false) {
    initAudioEngine();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const keyElement = midiElements[note];
    if (keyElement) keyElement.classList.add('active');

    activeNotesSet.add(note);
    updateChordRecognition();
    sustainedNotes.delete(note);

    if (sustainTimers[note]) {
        clearTimeout(sustainTimers[note]);
        delete sustainTimers[note];
    }

    const keysPlaying = Object.keys(activeOscillators);
    if (keysPlaying.length > 12) {
        const now = performance.now();
        let oldest = null, oldestTime = Infinity;
        for (const [n, inst] of Object.entries(activeOscillators)) {
            if (inst.startTime && inst.startTime < oldestTime) {
                oldestTime = inst.startTime;
                oldest = n;
            }
        }
        if (oldest && (now - oldestTime) > 500) {
            stopNoteInstance(oldest, false);
            stopPadInstance(oldest);
        }
    }

    if (activeOscillators[note]) stopNoteInstance(note, false);
    if (activePadOscillators[note]) stopPadInstance(note);

    const currentPreset = presetSelect ? presetSelect.value : 'piano-korg';
    if (!loadedSampleBuffers[currentPreset]) await loadPresetSamples(currentPreset);

    activeOscillators[note] = playSampleNote(note, velocity, currentPreset);

    if (padEnabled && padPresetSelect) {
        activePadOscillators[note] = playPadNote(note, padPresetSelect.value);
    }

    if (fromMouse && activeMidiOutput) activeMidiOutput.send([144, note, velocity]);

    requestStaffDraw();
}

function noteOff(note, fromMouse = false) {
    const keyElement = midiElements[note];
    activeNotesSet.delete(note);
    updateChordRecognition();

    if (keyElement) keyElement.classList.remove('active');

    if (sustainButtonActive || sustainActive) {
        sustainedNotes.add(note);

        if (sustainTimers[note]) clearTimeout(sustainTimers[note]);

        sustainTimers[note] = setTimeout(() => {
            releaseNoteWithFade(note);
        }, getDecayTime() * 1000);

    } else {
        stopPadInstance(note);
        stopNoteInstance(note, true);
    }

    if (fromMouse && activeMidiOutput) activeMidiOutput.send([128, note, 0]);

    requestStaffDraw();
}

// ==========================================
// RECONOCIMIENTO DE ACORDES
// ==========================================
const chordDictionary = {
    "0,4,7": "Mayor", "0,3,7": "Menor", "0,4,8": "Aumentado (aug)", "0,3,6": "Disminuido (dim)",
    "0,2,7": "sus2", "0,5,7": "sus4", "0,5,10": "7sus4", "0,2,7,10": "9sus4",
    "0,4,7,10": "7 (Dominante)", "0,4,7,11": "Maj7", "0,3,7,10": "m7", "0,3,7,11": "mMaj7",
    "0,3,6,10": "m7(b5)", "0,3,6,9": "dim7", "0,4,8,10": "+7", "0,4,8,11": "Maj7(#5)",
    "0,4,7,9": "6", "0,3,7,9": "m6", "0,2,4,7": "add9", "0,2,3,7": "m(add9)",
    "0,4,7,10,14": "9", "0,4,7,11,14": "Maj9", "0,3,7,10,14": "m9", "0,4,7,10,13": "7(b9)",
    "0,4,7,10,15": "7(#9)", "0,3,6,10,13": "m9(b5)", "0,3,6,9,13": "dim9",
    "0,4,7,10,14,17": "11", "0,3,7,10,14,17": "m11", "0,4,7,10,14,21": "13",
    "0,4,7,11,14,21": "Maj13", "0,3,7,10,14,21": "m13", "0,4,7,10,14,18,21": "13(#11)"
};

function updateChordRecognition() {
    if (!chordNameDisplay || !notesDetectedDisplay) return;
    if (activeNotesSet.size === 0) {
        chordNameDisplay.textContent = "Esperando notas...";
        notesDetectedDisplay.textContent = "Ninguna";
        return;
    }
    const sortedNotes = Array.from(activeNotesSet).sort((a, b) => a - b);
    const noteNamesList = sortedNotes.map(n => `${noteNames[n % 12]}${Math.floor(n / 12) - 1}`);
    notesDetectedDisplay.textContent = noteNamesList.join(", ");

    if (activeNotesSet.size === 1) {
        chordNameDisplay.textContent = `${noteNames[sortedNotes[0] % 12]} (Nota)`;
        return;
    }
    let bestMatch = null;
    for (let i = 0; i < sortedNotes.length; i++) {
        const root = sortedNotes[i];
        const intervals = sortedNotes.map(n => (n - root + 120) % 12).sort((a, b) => a - b);
        const uniqueIntervals = [];
        intervals.forEach(iv => { if (!uniqueIntervals.includes(iv)) uniqueIntervals.push(iv); });
        const keyPattern = uniqueIntervals.join(",");
        if (chordDictionary[keyPattern]) {
            const rootName = noteNames[root % 12];
            const chordQuality = chordDictionary[keyPattern];
            let inversionText = i > 0 ? ` / ${noteNames[sortedNotes[0] % 12]} (Inv)` : "";
            bestMatch = `${rootName} ${chordQuality}${inversionText}`;
            break;
        }
    }
    chordNameDisplay.textContent = bestMatch || "Acorde avanzado / Abierto";
}

// ==========================================
// STOP INSTANCES
// ==========================================
function stopNoteInstance(note, gradualRelease = true) {
    if (activeOscillators[note]) {
        const instance = activeOscillators[note];
        if (instance.source && instance.gainNode) {
            const { source, gainNode } = instance;
            const now = audioCtx.currentTime;
            const releaseTime = gradualRelease ? getDecayTime() : 0.05;
            try {
                gainNode.gain.cancelScheduledValues(now);
                gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
                source.onended = () => {
                    source.disconnect();
                    gainNode.disconnect();
                };
                source.stop(now + releaseTime + 0.05);
            } catch (e) {
                try { source.stop(); } catch (err) {}
            }
        }
        delete activeOscillators[note];
    }
}

function stopPadInstance(note) {
    if (activePadOscillators[note]) {
        const { oscs, gainNode } = activePadOscillators[note];
        const now = audioCtx.currentTime;
        const releaseTime = Math.max(0.1, getDecayTime() * 0.8);
        try {
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(gainNode.gain.value, now);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
        } catch (e) {}
        oscs.forEach(o => {
            try { o.stop(now + releaseTime + 0.05); } catch (e) {}
            o.onended = () => {
                try { o.disconnect(); } catch (e) {}
            };
        });
        setTimeout(() => {
            try { gainNode.disconnect(); } catch (e) {}
        }, (releaseTime * 1000) + 50);
        delete activePadOscillators[note];
    }
}

// ==========================================
// PLAY SAMPLE NOTE
// ==========================================
function playSampleNote(midiNote, velocity, preset) {
    const buffers = loadedSampleBuffers[preset];
    const targetNoteName = getClosestSampleNote(midiNote);
    const gainNode = audioCtx.createGain();
    gainNode.connect(mainMasterGain);
    const velocityScale = velocity / 127;
    const now = audioCtx.currentTime;

    gainNode.gain.setValueAtTime(0.9 * velocityScale, now);

    if (buffers && buffers[targetNoteName]) {
        const source = audioCtx.createBufferSource();
        source.buffer = buffers[targetNoteName];

        const baseNoteMidi = baseMidiMap[targetNoteName] || 60;
        const cents = (midiNote - baseNoteMidi) * 100;
        source.detune.value = cents;

        source.connect(gainNode);
        source.start(now);

        return {
            source,
            gainNode,
            startTime: performance.now(),
            cutShort: (fadeDuration = getDecayTime()) => {
                try {
                    const t = audioCtx.currentTime;
                    gainNode.gain.cancelScheduledValues(t);
                    gainNode.gain.setValueAtTime(gainNode.gain.value, t);
                    gainNode.gain.linearRampToValueAtTime(0.0001, t + fadeDuration);
                    source.onended = () => {
                        source.disconnect();
                        gainNode.disconnect();
                    };
                    source.stop(t + fadeDuration + 0.05);
                } catch (e) {}
            }
        };
    }
    return { source: null, gainNode, startTime: performance.now(), cutShort: () => {} };
}

// ==========================================
// PAD SYNTH
// ==========================================
function playPadNote(midiNote, padType) {
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const now = audioCtx.currentTime;
    const padVolValues = [0.0, 0.05, 0.1, 0.15, 0.22];
    const targetGain = padVolValues[padVolumeLevel - 1];
    const gainNode = audioCtx.createGain();
    gainNode.connect(mainMasterGain);
    const filter = audioCtx.createBiquadFilter();
    let oscs = [];

    if (padType === 'warm_pad') {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        osc1.type = 'sawtooth'; osc2.type = 'triangle';
        osc1.frequency.value = freq; osc2.frequency.value = freq * 1.005;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 1.5, now);
        filter.frequency.linearRampToValueAtTime(freq * 3.5, now + 0.5);
        osc1.connect(filter); osc2.connect(filter); filter.connect(gainNode);
        oscs = [osc1, osc2];
    } else if (padType === 'soft_strings') {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        osc1.type = 'sawtooth'; osc2.type = 'sawtooth';
        osc1.frequency.value = freq; osc2.frequency.value = freq * 2;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2, now);
        filter.frequency.linearRampToValueAtTime(freq * 4, now + 0.6);
        osc1.connect(filter); osc2.connect(filter); filter.connect(gainNode);
        oscs = [osc1, osc2];
    } else {
        const osc1 = audioCtx.createOscillator();
        osc1.type = 'sawtooth'; osc1.frequency.value = freq;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq, now);
        filter.frequency.exponentialRampToValueAtTime(freq * 5, now + 0.8);
        osc1.connect(filter); filter.connect(gainNode);
        oscs = [osc1];
    }
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.4);
    oscs.forEach(o => o.start(now));
    return { oscs, gainNode };
}

// ==========================================
// MIDI
// ==========================================
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
} else {
    if (statusDiv) statusDiv.textContent = "Web MIDI no soportado.";
}

function onMIDISuccess(midiAccess) {
    currentMidiAccess = midiAccess;
    updateMidiPorts();
    currentMidiAccess.onstatechange = () => updateMidiPorts();
}

function onMIDIFailure() {
    if (statusDiv) statusDiv.textContent = "Error al inicializar MIDI.";
}

function updateMidiPorts() {
    if (!midiInputSelect || !midiOutputSelect) return;
    const inputs = Array.from(currentMidiAccess.inputs.values());
    const currentInId = midiInputSelect.value;
    midiInputSelect.innerHTML = '';
    if (inputs.length === 0) {
        midiInputSelect.add(new Option("Sin entradas USB", ""));
    } else {
        inputs.forEach(input => midiInputSelect.add(new Option(input.name, input.id)));
        if (inputs.some(i => i.id === currentInId)) midiInputSelect.value = currentInId;
    }
    connectInput();

    const outputs = Array.from(currentMidiAccess.outputs.values());
    const currentOutId = midiOutputSelect.value;
    midiOutputSelect.innerHTML = '<option value="">(Sin Salida)</option>';
    if (outputs.length > 0) {
        outputs.forEach(output => midiOutputSelect.add(new Option(output.name, output.id)));
        if (outputs.some(o => o.id === currentOutId)) midiOutputSelect.value = currentOutId;
    }
    connectOutput();
}

function connectInput() {
    if (!midiInputSelect) return;
    if (activeMidiInput) { activeMidiInput.onmidimessage = null; activeMidiInput = null; }
    const selectedId = midiInputSelect.value;
    if (selectedId && currentMidiAccess) {
        const input = currentMidiAccess.inputs.get(selectedId);
        if (input) {
            activeMidiInput = input;
            activeMidiInput.onmidimessage = handleIncomingMidiMessage;
        }
    }
}

function connectOutput() {
    if (!midiOutputSelect) return;
    activeMidiOutput = null;
    const selectedId = midiOutputSelect.value;
    if (selectedId && currentMidiAccess) {
        const output = currentMidiAccess.outputs.get(selectedId);
        if (output) activeMidiOutput = output;
    }
}

function handleIncomingMidiMessage(event) {
    const [status, note, velocity] = event.data;
    const command = status >> 4;

    if (command === 9 && velocity > 0) {
        noteOn(note, velocity, false);
    } else if (command === 8 || (command === 9 && velocity === 0)) {
        noteOff(note, false);
    } else if (command === 11) {
        if (note === 64) {
            sustainActive = (velocity >= 64);
            if (!sustainActive) {
                releaseSustainedNotes();
            }
        }
    }
}

if (midiInputSelect) midiInputSelect.addEventListener('change', connectInput);
if (midiOutputSelect) midiOutputSelect.addEventListener('change', connectOutput);

// ==========================================
// POPUP COLABORADORES
// ==========================================
const btnCollaborators = document.getElementById('btn-collaborators');
const collaboratorsModal = document.getElementById('collaborators-modal');
const modalBox = document.getElementById('modal-box');
const btnCloseModal = document.getElementById('btn-close-modal');

function toggleCollaboratorsModal(open) {
    const isOpen = open !== undefined ? open : !collaboratorsModal.classList.contains('active');
    if (isOpen) {
        collaboratorsModal.classList.add('active');
    } else {
        collaboratorsModal.classList.remove('active');
    }
}

if (btnCollaborators) {
    btnCollaborators.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCollaboratorsModal();
    });
}

if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => toggleCollaboratorsModal(false));
}

if (collaboratorsModal) {
    collaboratorsModal.addEventListener('click', (e) => {
        if (!modalBox.contains(e.target)) {
            toggleCollaboratorsModal(false);
        }
    });
}

// ==========================================
// 🎬 GRABAR / REPRODUCIR / IMPORTAR / EXPORTAR MIDI
// ==========================================

// --- Estado ---
let isRecording = false;
let recordedEvents = [];
let recordStartTime = 0;
let isPlaying = false;
let playbackTimers = [];
let isPaused = false;
let pauseOffset = 0;
let playbackStartTime = 0;
let playbackPausedElapsed = 0;
let playbackRemainingEvents = [];

// --- Referencias DOM ---
const btnRecord = document.getElementById('btn-record');
const btnPause = document.getElementById('btn-pause');
const btnPlayback = document.getElementById('btn-playback');
const btnStop = document.getElementById('btn-stop');
const btnExportJson = document.getElementById('btn-export-json');
const btnExportMidi = document.getElementById('btn-export-midi');
const midiFileInput = document.getElementById('midi-file-input');
const recStatus = document.getElementById('rec-status');
// ==========================================
// CONTROL DE VELOCIDAD DE REPRODUCCIÓN
// ==========================================
// ==========================================
// CONTROL DE VELOCIDAD DE REPRODUCCIÓN
// ==========================================
let playbackSpeed = 1.0;

const selectSpeed = document.getElementById('select-speed');

if (selectSpeed) {
    selectSpeed.addEventListener('change', (e) => {
        playbackSpeed = parseInt(e.target.value) / 10;
    });
}   

// ==========================================
// PATCH: Interceptar noteOn / noteOff
// ==========================================
const _originalNoteOn = noteOn;
const _originalNoteOff = noteOff;

window.noteOn = function(note, velocity, fromMouse = false) {
    if (isRecording && !isPaused) {
        recordedEvents.push({
            type: 'on',
            note: note,
            velocity: velocity || 100,
            time: performance.now() - recordStartTime
        });
    }
    return _originalNoteOn(note, velocity, fromMouse);
};

window.noteOff = function(note, fromMouse = false) {
    if (isRecording && !isPaused) {
        recordedEvents.push({
            type: 'off',
            note: note,
            velocity: 0,
            time: performance.now() - recordStartTime
        });
    }
    return _originalNoteOff(note, fromMouse);
};

// ==========================================
// BOTÓN: GRABAR
// ==========================================
if (btnRecord) {
    btnRecord.addEventListener('click', () => {
        if (!isRecording) {
            isRecording = true;
            isPaused = false;
            pauseOffset = 0;
            recordedEvents = [];
            recordStartTime = performance.now();
            btnRecord.textContent = '⏹ STOP';
            btnRecord.className = 'record-btn-on';
            recStatus.textContent = '⏺ Grabando...';
            recStatus.className = 'rec-status recording';
            btnPause.disabled = false;
            btnPause.textContent = '⏸ Pausa';
            btnPause.classList.remove('paused');
            btnPlayback.disabled = true;
            btnStop.disabled = true;
        } else {
            isRecording = false;
            isPaused = false;
            pauseOffset = 0;
            btnRecord.textContent = '⏺ REC';
            btnRecord.className = 'record-btn-off';
            recStatus.textContent = `✅ Grabado: ${recordedEvents.length} eventos`;
            recStatus.className = 'rec-status';
            btnPause.disabled = true;
            btnPause.textContent = '⏸ Pausa';
            btnPause.classList.remove('paused');
            btnPlayback.disabled = false;
            btnStop.disabled = false;
            btnExportJson.disabled = false;
            btnExportMidi.disabled = false;
        }
    });
}

// ==========================================
// BOTÓN: PAUSA (funciona en grabación Y reproducción)
// ==========================================
if (btnPause) {
    btnPause.addEventListener('click', () => {
        // --- MODO GRABACIÓN ---
        if (isRecording) {
            if (!isPaused) {
                isPaused = true;
                pauseOffset += performance.now() - recordStartTime;
                btnPause.textContent = '▶ Reanudar';
                btnPause.classList.add('paused');
                recStatus.textContent = '⏸ Pausado (grabación)';
                recStatus.className = 'rec-status';
            } else {
                isPaused = false;
                recordStartTime = performance.now() - pauseOffset;
                btnPause.textContent = '⏸ Pausa';
                btnPause.classList.remove('paused');
                recStatus.textContent = '⏺ Grabando...';
                recStatus.className = 'rec-status recording';
            }
            return;
        }

        // --- MODO REPRODUCCIÓN ---
        if (isPlaying) {
            if (!isPaused) {
                // PAUSAR
                isPaused = true;
                playbackPausedElapsed = performance.now() - playbackStartTime;
                playbackTimers.forEach(t => clearTimeout(t));
                playbackTimers = [];
                if (progressRAF) cancelAnimationFrame(progressRAF); 
                activeNotesSet.forEach(note => noteOff(note, false));
                playbackRemainingEvents = recordedEvents.filter(evt => evt.time > playbackPausedElapsed);
                btnPause.textContent = '▶ Reanudar';
                btnPause.classList.add('paused');
                recStatus.textContent = '⏸ Pausado (reproducción)';
                recStatus.className = 'rec-status';
            } else {
                // REANUDAR
                isPaused = false;
                btnPause.textContent = '⏸ Pausa';
                btnPause.classList.remove('paused');
                recStatus.textContent = '▶ Reproduciendo...';
                recStatus.className = 'rec-status playing';
                startProgressBar();

                playbackRemainingEvents.forEach(evt => {
                    const remaining = (evt.time - playbackPausedElapsed) / playbackSpeed;
                    if (remaining > 0) {
                        const timer = setTimeout(() => {
                            if (evt.type === 'on') noteOn(evt.note, evt.velocity, false);
                            else noteOff(evt.note, false);
                        }, remaining);
                        playbackTimers.push(timer);
                    }
                });

                const lastEvt = playbackRemainingEvents[playbackRemainingEvents.length - 1];
                if (lastEvt) {
                    const endDelay = (lastEvt.time - playbackPausedElapsed) / playbackSpeed + 500;
                    const endTimer = setTimeout(() => {
                        stopPlayback();
                        recStatus.textContent = '✅ Reproducción terminada';
                        recStatus.className = 'rec-status';
                    }, endDelay);
                    playbackTimers.push(endTimer);
                } else {
                    stopPlayback();
                    recStatus.textContent = '✅ Reproducción terminada';
                    recStatus.className = 'rec-status';
                }
                playbackRemainingEvents = [];
            }
            return;
        }
    });
}

// ==========================================
// BOTÓN: REPRODUCIR
// ==========================================
if (btnPlayback) {
    btnPlayback.addEventListener('click', () => {
        if (recordedEvents.length === 0 || isPlaying) return;

        isPlaying = true;
        isPaused = false;
        playbackStartTime = performance.now();
        playbackPausedElapsed = 0;
        btnPause.disabled = false;
        btnPause.textContent = '⏸ Pausa';
        btnPause.classList.remove('paused');
        btnPlayback.disabled = true;
        btnStop.disabled = false;
        recStatus.textContent = `▶ Reproduciendo (${playbackSpeed.toFixed(1)}×)...`;
        recStatus.className = 'rec-status playing';

        recordedEvents.forEach(evt => {
            const timer = setTimeout(() => {
                if (evt.type === 'on') noteOn(evt.note, evt.velocity, false);
                else noteOff(evt.note, false);
            }, evt.time / playbackSpeed);  // ✅ AQUÍ: dividir por velocidad
            playbackTimers.push(timer);
        });

        const totalDuration = recordedEvents[recordedEvents.length - 1].time / playbackSpeed + 500;
        const endTimer = setTimeout(() => {
            stopPlayback();
            recStatus.textContent = '✅ Reproducción terminada';
            recStatus.className = 'rec-status';
        }, totalDuration);
        playbackTimers.push(endTimer);
        startProgressBar();
    });
}   
// ==========================================
// BOTÓN: DETENER
// ==========================================
function stopPlayback() {
    isPlaying = false;
    isPaused = false;
    playbackTimers.forEach(t => clearTimeout(t));
    playbackTimers = [];
    playbackRemainingEvents = [];
    activeNotesSet.forEach(note => noteOff(note, false));
    btnPlayback.disabled = recordedEvents.length === 0;
    btnStop.disabled = true;
    btnPause.disabled = true;
    btnPause.textContent = '⏸ Pausa';
    btnPause.classList.remove('paused');
    stopProgressBar();
}

if (btnStop) {
    btnStop.addEventListener('click', () => {
        stopPlayback();
        recStatus.textContent = '⏹ Detenido';
        recStatus.className = 'rec-status';
    });
}

// ==========================================
// EXPORTAR JSON
// ==========================================
if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
        if (recordedEvents.length === 0) return;
        const data = {
            app: 'Yamirla Piano PWA-3',
            exported: new Date().toISOString(),
            duration: recordedEvents[recordedEvents.length - 1].time,
            events: recordedEvents
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grabacion-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        recStatus.textContent = '💾 Exportado JSON';
    });
}

// ==========================================
// EXPORTAR MIDI
// ==========================================
if (btnExportMidi) {
    btnExportMidi.addEventListener('click', () => {
        if (recordedEvents.length === 0) return;
        const midiBytes = buildMidiFile(recordedEvents);
        const blob = new Blob([midiBytes], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grabacion-${Date.now()}.mid`;
        a.click();
        URL.revokeObjectURL(url);
        recStatus.textContent = '📤 Exportado MIDI';
    });
}

function buildMidiFile(events) {
    const TPQ = 480;
    const tempo = 500000;
    const sorted = [...events].sort((a, b) => a.time - b.time);
    const ticksPerMs = TPQ / 500;
    let midiEvents = [];
    midiEvents.push({ tick: 0, data: [0xFF, 0x51, 0x03, (tempo >> 16) & 0xFF, (tempo >> 8) & 0xFF, tempo & 0xFF] });
    midiEvents.push({ tick: 0, data: [0xC0, 0x00] });
    sorted.forEach(evt => {
        const tick = Math.round(evt.time * ticksPerMs);
        if (evt.type === 'on') midiEvents.push({ tick, data: [0x90, evt.note & 0x7F, evt.velocity & 0x7F] });
        else midiEvents.push({ tick, data: [0x80, evt.note & 0x7F, 0x00] });
    });
    const lastEventTick = midiEvents.length > 0 ? Math.max(...midiEvents.map(e => e.tick)) : 0;
    midiEvents.push({ tick: lastEventTick, data: [0xFF, 0x2F, 0x00] });
    midiEvents.sort((a, b) => a.tick - b.tick);
    let prevTick = 0;
    const trackData = [];
    midiEvents.forEach(evt => {
        const delta = evt.tick - prevTick;
        trackData.push(...writeVarLen(delta), ...evt.data);
        prevTick = evt.tick;
    });
    const header = [0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, (TPQ >> 8) & 0xFF, TPQ & 0xFF];
    const trackLen = trackData.length;
    const trackHeader = [0x4D, 0x54, 0x72, 0x6B, (trackLen >> 24) & 0xFF, (trackLen >> 16) & 0xFF, (trackLen >> 8) & 0xFF, trackLen & 0xFF];
    return new Uint8Array([...header, ...trackHeader, ...trackData]);
}

function writeVarLen(value) {
    if (value === 0) return [0];
    const bytes = [];
    while (value > 0) { bytes.unshift(value & 0x7F); value >>= 7; }
    for (let i = 0; i < bytes.length - 1; i++) bytes[i] |= 0x80;
    return bytes;
}

// ==========================================
// PARSER MIDI INLINE
// ==========================================
function parseMidiFile(uint8) {
    let pos = 0;
    function readStr(n) { const s = []; for (let i = 0; i < n; i++) s.push(uint8[pos++]); return String.fromCharCode(...s); }
    function readU16() { return (uint8[pos++] << 8) | uint8[pos++]; }
    function readU32() { return (uint8[pos++] << 24) | (uint8[pos++] << 16) | (uint8[pos++] << 8) | uint8[pos++]; }
    function readVarLen() { let val = 0, byte; do { byte = uint8[pos++]; val = (val << 7) | (byte & 0x7F); } while (byte & 0x80); return val; }

    if (readStr(4) !== 'MThd') throw new Error('No es un archivo MIDI válido');
    readU32();
    const format = readU16();
    const ntrks = readU16();
    const TPQ = readU16();
    let tempo = 500000;
    const allEvents = [];

    for (let t = 0; t < ntrks; t++) {
        if (readStr(4) !== 'MTrk') throw new Error('Track inválido');
        const trackLen = readU32();
        const trackEnd = pos + trackLen;
        let tick = 0;
        let runningStatus = 0;

        while (pos < trackEnd) {
            tick += readVarLen();
            let status = uint8[pos++];
            if (status < 0x80) { pos--; status = runningStatus; }

            if (status === 0xFF) {
                const metaType = uint8[pos++];
                const metaLen = readVarLen();
                if (metaType === 0x51 && metaLen === 3) {
                    tempo = (uint8[pos] << 16) | (uint8[pos + 1] << 8) | uint8[pos + 2];
                }
                pos += metaLen;
                runningStatus = 0;
                continue;
            }
            if (status === 0xF0 || status === 0xF7) {
                const sysexLen = readVarLen();
                pos += sysexLen;
                runningStatus = 0;
                continue;
            }

            const type = (status >> 4) & 0x0F;
            runningStatus = status;

            if (type === 9 || type === 8) {
                const note = uint8[pos++];
                const vel = uint8[pos++];
                if (type === 9 && vel > 0) allEvents.push({ type: 'on', note, velocity: vel, tick });
                else allEvents.push({ type: 'off', note, velocity: 0, tick });
            } else if (type === 11) { pos += 2; }
            else if (type === 12 || type === 14) { pos += 1; }
            else if (type === 13 || type === 15) { pos += 2; }
            else { pos = trackEnd; }
        }
        pos = trackEnd;
    }
    return { TPQ, tempo, events: allEvents };
}

// ==========================================
// IMPORTAR MIDI
// ==========================================
if (midiFileInput) {
    midiFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        recStatus.textContent = '⏳ Leyendo archivo MIDI...';
        recStatus.className = 'rec-status';

        const reader = new FileReader();
        reader.onload = (fileEvent) => {
            try {
                const uint8 = new Uint8Array(fileEvent.target.result);
                const parsed = parseMidiFile(uint8);
                if (!parsed.events || parsed.events.length === 0) {
                    recStatus.textContent = '❌ No se encontraron notas en el MIDI.';
                    return;
                }
                const msPerTick = (parsed.tempo / 1000) / parsed.TPQ;
                parsed.events.sort((a, b) => a.tick - b.tick);
                recordedEvents = parsed.events.map(evt => ({
                    type: evt.type, note: evt.note, velocity: evt.velocity, time: evt.tick * msPerTick
                }));
                btnPlayback.disabled = false;
                btnStop.disabled = false;
                btnExportJson.disabled = false;
                btnExportMidi.disabled = false;
                const duration = recordedEvents[recordedEvents.length - 1].time;
                recStatus.textContent = `✅ Importado: ${recordedEvents.length} eventos (${(duration / 1000).toFixed(1)}s)`;
                recStatus.className = 'rec-status';
            } catch (err) {
                console.error('Error importando MIDI:', err);
                recStatus.textContent = '❌ Error: ' + err.message;
                recStatus.className = 'rec-status';
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    });
}   
// ==========================================
// BARRA DE PROGRESO (clicable / seek)
// ==========================================
const progressBar = document.getElementById('progress-bar');
const progressBarFill = document.getElementById('progress-fill');
const progressTime = document.getElementById('progress-time');
let progressRAF = null;

function getPlaybackDuration() {
    if (recordedEvents.length === 0) return 1;
    return recordedEvents[recordedEvents.length - 1].time / playbackSpeed;
}

function updateProgressBar() {
    if (!isPlaying || isPaused) return;

    const elapsed = performance.now() - playbackStartTime;
    const totalDuration = getPlaybackDuration();
    const percent = Math.min(100, (elapsed / totalDuration) * 100);
    const currentSec = (elapsed / 1000).toFixed(1);
    const totalSec = (totalDuration / 1000).toFixed(1);

    if (progressBarFill) progressBarFill.style.width = percent + '%';
    if (progressTime) progressTime.textContent = `${currentSec}s / ${totalSec}s`;

    progressRAF = requestAnimationFrame(updateProgressBar);
}

function startProgressBar() {
    if (progressRAF) cancelAnimationFrame(progressRAF);
    progressRAF = requestAnimationFrame(updateProgressBar);
}

function stopProgressBar() {
    if (progressRAF) cancelAnimationFrame(progressRAF);
    progressRAF = null;
    if (progressBarFill) progressBarFill.style.width = '0%';
    if (progressTime) progressTime.textContent = '0.0s / 0.0s';
}

// --- SEEK: clic en la barra ---
if (progressBar) {
    progressBar.addEventListener('click', (e) => {
        if (!isPlaying && recordedEvents.length === 0) return;

        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, clickX / rect.width));
        const seekMs = percent * getPlaybackDuration(); // posición en ms (ya con velocidad aplicada)

        // Detener todo lo actual
        playbackTimers.forEach(t => clearTimeout(t));
        playbackTimers = [];
        activeNotesSet.forEach(note => noteOff(note, false));

        // Calcular posición original (sin velocidad) para filtrar eventos
        const seekOriginal = seekMs * playbackSpeed;

        // Eventos pendientes (los que aún no suenan)
        const remaining = recordedEvents.filter(evt => evt.time >= seekOriginal);

        // Re-agendar
        playbackStartTime = performance.now();
        playbackPausedElapsed = 0;

        remaining.forEach(evt => {
            const delay = (evt.time - seekOriginal) / playbackSpeed;
            if (delay >= 0) {
                const timer = setTimeout(() => {
                    if (evt.type === 'on') noteOn(evt.note, evt.velocity, false);
                    else noteOff(evt.note, false);
                }, delay);
                playbackTimers.push(timer);
            }
        });

        // Timer de fin
        const totalDuration = getPlaybackDuration();
        const endTimer = setTimeout(() => {
            stopPlayback();
            recStatus.textContent = '✅ Reproducción terminada';
            recStatus.className = 'rec-status';
        }, totalDuration - seekMs + 500);
        playbackTimers.push(endTimer);
        startProgressBar();

        // Actualizar UI
        if (!isPlaying) {
            isPlaying = true;
            isPaused = false;
            btnPlayback.disabled = true;
            btnStop.disabled = false;
            btnPause.disabled = false;
            btnPause.textContent = '⏸ Pausa';
            btnPause.classList.remove('paused');
        }
        recStatus.textContent = `▶ ${((seekMs / 1000).toFixed(1))}s (${playbackSpeed.toFixed(1)}×)`;
        recStatus.className = 'rec-status playing';
        startProgressBar();
    });
}   
