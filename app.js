const statusDiv = document.getElementById('status');
const keyboardDiv = document.getElementById('keyboard');
const presetSelect = document.getElementById('preset');
const midiInputSelect = document.getElementById('midi-input');
const midiOutputSelect = document.getElementById('midi-output');
const chordNameDisplay = document.getElementById('chord-name');
const notesDetectedDisplay = document.getElementById('notes-detected');

// Referencia al canvas del pentagrama
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

// Referencia al botón de Sustain
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

// Variables para el Sustain del botón
let sustainButtonActive = false;
const sustainTimers = {};

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx, mainMasterGain, convolverNode, wetGain, dryGain;
let delayNode, delayFeedbackNode, delayWetGain;

let volumeLevel = 3;
let reverbLevel = 2;
let decayLevel = 1;
let delayLevel = 1;
let padEnabled = false;
let padVolumeLevel = 3;

const soundPresets = {
    "piano-korg": "sonidos/piano-korg/",
    "piano-kawai": "sonidos/piano-kawai/",
    "bright": "sonidos/bright/",
    "motif": "sonidos/motif/",
    "wurlitzer": "sonidos/electric-piano/",
    "rhodes-piano":"sonidos/rhodes-piano/",
    "acustic-guitar":"sonidos/acustic-guitar/",
    "donnys-guitar":"sonidos/donnys-guitar/",
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

function initAudioEngine() {
    if (audioCtx) return;
    audioCtx = new AudioContext();
    mainMasterGain = audioCtx.createGain();
    updateVolumeValue(volumeLevel);
    
    convolverNode = audioCtx.createConvolver();
    createReverbImpulse();
    wetGain = audioCtx.createGain();
    dryGain = audioCtx.createGain();
    updateReverbValue(reverbLevel);
    
    delayNode = audioCtx.createDelay();
    delayNode.delayTime.value = 0.35;
    delayFeedbackNode = audioCtx.createGain();
    delayWetGain = audioCtx.createGain();
    delayNode.connect(delayFeedbackNode);
    delayFeedbackNode.connect(delayNode);
    updateDecayValue(decayLevel);
    updateDelayValue(delayLevel);
    
    mainMasterGain.connect(dryGain);
    mainMasterGain.connect(convolverNode);
    convolverNode.connect(wetGain);
    dryGain.connect(audioCtx.destination);
    wetGain.connect(audioCtx.destination);
}

// 🎛️ NUEVA FUNCIÓN: Mapea el nivel del slider decay (1 al 5) a segundos de desvanecimiento
function getDecayTime() {
    const decayTimes = [2.0, 0.2, 0.5, 1.2, 2.5]; 
    return decayTimes[decayLevel - 1] || 1.0;
}

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

window.addEventListener('DOMContentLoaded', async () => {
    initAudioEngine();
    const initialPreset = presetSelect ? presetSelect.value : 'piano-korg';
    await loadPresetSamples(initialPreset);
    drawStaff();
});

function updateVolumeValue(val) {
    volumeLevel = parseInt(val);
    const gainValues = [0.0, 0.25, 0.5, 0.75, 1.0];
    if (mainMasterGain && audioCtx) mainMasterGain.gain.setValueAtTime(gainValues[volumeLevel - 1], audioCtx.currentTime);
    if (valVolume) valVolume.textContent = volumeLevel;
}

function updateReverbValue(val) {
    reverbLevel = parseInt(val);
    const reverbValues = [0.0, 0.2, 0.4, 0.6, 0.8];
    const actualMix = reverbValues[reverbLevel - 1];
    if (wetGain && dryGain) {
        wetGain.gain.value = actualMix;
        dryGain.gain.value = 1.0 - (actualMix * 0.5);
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
        delayWetGain.gain.setValueAtTime(settings.wet, audioCtx.currentTime);
        delayFeedbackNode.gain.setValueAtTime(settings.fb, audioCtx.currentTime);
        try { mainMasterGain.disconnect(delayNode); delayWetGain.disconnect(); } catch(e) {}
        if (delayLevel > 1) {
            mainMasterGain.connect(delayNode);
            delayNode.connect(delayWetGain);
            delayWetGain.connect(audioCtx.destination);
        }
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
if (sliderDecay) sliderDecay.addEventListener('input', (e) => { initAudioEngine(); updateDecayValue(e.target.value); });
if (sliderDelay) sliderDelay.addEventListener('input', (e) => { initAudioEngine(); updateDelayValue(e.target.value); });

if (knobPadVol) {
    updatePadVolValue(padVolumeLevel);
    knobPadVol.addEventListener('click', () => {
        initAudioEngine();
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

// Event listener del botón de Sustain
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

if (presetSelect) {
    presetSelect.addEventListener('change', async () => {
        initAudioEngine();
        const selectedPreset = presetSelect.value;
        
        // 1. Feedback visual inmediato en la interfaz
        if (statusDiv) statusDiv.textContent = `Cambiado a ${selectedPreset}...`;
        
        // 2. Carga en segundo plano sin bloquear la UI inmediatamente
        await loadPresetSamples(selectedPreset);
    });
}

// releaseSustainedNotes (para el pedal MIDI)
function releaseSustainedNotes() {
    sustainedNotes.forEach(note => {
        const keyElement = midiElements[note];
        if (keyElement) keyElement.classList.remove('active');
        if (keyElement && !keyElement.hasAttribute('data-pressed')) {
            releaseNoteWithFade(note);
        }
    });
    sustainedNotes.clear();
    drawStaff();
}

// Liberar todas las notas sostenidas (para el botón)
function releaseAllSustainedNotes() {
    sustainedNotes.forEach(note => {
        releaseNoteWithFade(note);
    });
    sustainedNotes.clear();
    drawStaff();
}

// Liberar una nota con fade out adaptado al decay
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
            const releaseTime = getDecayTime(); // ✅ Vinculado al slider decay
            
            try {
                gainNode.gain.cancelScheduledValues(now);
                gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                gainNode.gain.linearRampToValueAtTime(0.0001, now + releaseTime);
                setTimeout(() => {
                    try { source.stop(); source.disconnect(); gainNode.disconnect(); } catch (e) {}
                }, (releaseTime * 1000) + 100);
            } catch (e) { try { source.stop(); } catch(err) {} }
        }
        delete activeOscillators[note];
    }
    
    stopPadInstance(note);
    drawStaff();
}

// ==========================================
// VISUALIZACIÓN DE PENTAGRAMAS
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

    // 1. PENTAGRAMA IZQUIERDO (Clave de Fa)
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

    // 2. PENTAGRAMA DERECHO (Clave de Sol)
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

    // 3. LÍNEA DIVISORIA VERTICAL CENTRAL
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 55);
    ctx.lineTo(400, 125);
    ctx.stroke();

    // 4. DIBUJAR NOTAS ACTIVAS
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
// GENERACIÓN DEL TECLADO
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
        
        const startNoteEvent = (e) => {
            if (e.cancelable) e.preventDefault();
            key.setAttribute('data-pressed', 'true');
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
        const oldestNote = keysPlaying[0];
        stopNoteInstance(oldestNote, false);
        stopPadInstance(oldestNote);
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
    
    drawStaff();
}

// noteOff adaptado para respetar el decay en todos los casos
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
        }, 1500);
        
    } else {
        // Liberar pad y aplicar el tiempo de decay configurado en el slider
        stopPadInstance(note);
        stopNoteInstance(note, true);
    }
    
    if (fromMouse && activeMidiOutput) activeMidiOutput.send([128, note, 0]);
    
    drawStaff();
}

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

function stopNoteInstance(note, gradualRelease = true) {
    if (activeOscillators[note]) {
        const instance = activeOscillators[note];
        if (instance.source && instance.gainNode) {
            const { source, gainNode } = instance;
            const now = audioCtx.currentTime;
            const releaseTime = gradualRelease ? getDecayTime() : 0.05; // ✅ Usa getDecayTime()
            try {
                gainNode.gain.cancelScheduledValues(now);
                gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
                setTimeout(() => {
                    try { source.stop(); source.disconnect(); gainNode.disconnect(); } catch (e) {}
                }, (releaseTime * 1000) + 20);
            } catch (e) { try { source.stop(); } catch(err) {} }
        }
        delete activeOscillators[note];
    }
}

function stopPadInstance(note) {
    if (activePadOscillators[note]) {
        const { oscs, gainNode } = activePadOscillators[note];
        const now = audioCtx.currentTime;
        const releaseTime = Math.max(0.1, getDecayTime() * 0.8); // ✅ Vinculado al decay del pad
        try {
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(gainNode.gain.value, now);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
        } catch (e) {}
        setTimeout(() => {
            oscs.forEach(o => { try { o.stop(); o.disconnect(); } catch (e) {} });
            try { gainNode.disconnect(); } catch (e) {}
        }, (releaseTime * 1000) + 20);
        delete activePadOscillators[note];
    }
}

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
        source.playbackRate.value = Math.pow(2, (midiNote - baseNoteMidi) / 12);
        source.connect(gainNode);
        source.start(now);

        return { 
            source, 
            gainNode,
            cutShort: (fadeDuration = getDecayTime()) => {
                try {
                    const t = audioCtx.currentTime;
                    gainNode.gain.cancelScheduledValues(t);
                    gainNode.gain.setValueAtTime(gainNode.gain.value, t);
                    gainNode.gain.linearRampToValueAtTime(0.0001, t + fadeDuration);
                    setTimeout(() => {
                        try { source.stop(); source.disconnect(); gainNode.disconnect(); } catch (e) {}
                    }, (fadeDuration * 1000) + 50);
                } catch (e) {}
            }
        };
    }
    return { source: null, gainNode, cutShort: () => {} };
}

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
    const channel = status & 0xf;

    if (command === 9 && velocity > 0) {
        noteOn(note, velocity, false);
    } else if (command === 8 || (command === 9 && velocity === 0)) {
        noteOff(note, false);
    } else if (command === 11) {
        // Control Change (Sustain Pedal CC 64)
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
// CONTROL DEL POPUP FLOTANTE DE COLABORADORES
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

// Cierra el popup si se hace clic en cualquier parte fuera de la ventanita del modal
if (collaboratorsModal) {
    collaboratorsModal.addEventListener('click', (e) => {
        if (!modalBox.contains(e.target)) {
            toggleCollaboratorsModal(false);
        }
    });
}
