<img width="973" height="641" alt="CapturaYamirla" src="https://github.com/user-attachments/assets/46760e3e-5692-481b-8ce3-dc662fe59b26" />


# 🎹 Yamirla Piano PWA-3

> **El piano online más completo y potente de la red.**
> Un instrumento virtual de nivel profesional, 100% en tu navegador, sin instalación.


## ✨ ¿Por qué es el mejor piano online?

| Característica | Yamirla Piano PWA-3 | Otros pianos web |
|---|:---:|:---:|
| Samples reales de piano (Korg) | ✅ | ❌ |
| 14 presets de instrumentos | ✅ | ❌ |
| Grabación + Exportación MIDI | ✅ | ❌ |
| Importación de archivos .mid | ✅ | ❌ |
| Velocidad de reproducción (0.1×–1×) | ✅ | ❌ |
| Barra de progreso con seek | ✅ | ❌ |
| Entrada/Salida MIDI USB | ✅ | ❌ |
| Efectos: Reverb, Decay, Delay | ✅ | ❌ |
| Sustain | ✅ | ❌ |
| Synth Pad con 3 presets | ✅ | ❌ |
| Detección de acordes en tiempo real | ✅ | ❌ |
| Pentagrama visual (canvas) | ✅ | ❌ |
| PWA instalable + Offline | ✅ | ❌ |
| Knob interactivo de volumen | ✅ | ❌ |

---

## 🚀 Funcionalidades

### 🎵 Instrumentos (14 presets)

- **Pianos Acústicos:** Korg Grand (samples reales), Kawai Grand, Bright Yamaha, Motif Sustain
- **Pianos Eléctricos:** Wurlitzer, Rhodes
- **Guitarras:** Acústica, Donnys-Guitar
- **Acordeones Colombianos:** Hohner Corona (Vallenato), Sabanero (Cumbia)
- **Órganos:** Hammond 1, Jazz
- **Cuerdas:** String-Roland
- **Metales:** Trompeta, Trombón

### 🎬 Grabación & MIDI

- ⏺ **Grabar** notas tocadas en tiempo real
- ▶ **Reproducir** / ⏸ **Pausar** / ⏹ **Detener**
- 💾 **Exportar JSON** (estructura de notas + timestamps)
- 📤 **Exportar MIDI** (`.mid` compatible con cualquier DAW)
- 📥 **Importar MIDI** (carga archivos `.mid` / `.midi`)
- 🎚️ **Velocidad de reproducción:** 0.1× (Estudio) → 1.0× (Normal)
- 📊 **Barra de progreso** con *click-to-seek*

### 🎛️ Efectos y Control

- **Volumen Master** (slider vertical 1–5)
- **Reverberación** (slider vertical 1–5)
- **Decay** (slider vertical OFF–5)
- **Delay** (slider vertical OFF–5)
- **Sustain** (toggle ON/OFF)

### 🎹 Synth Pad

- Toggle ON/OFF
- 3 presets: *Warm Pad*, *Soft Strings*, *Analog Sweep*
- **Knob interactivo** de volumen (clic para girar, 1–5)

### 🎼 Análisis Musical

- **Pentagrama en canvas** con visualización de notas en tiempo real
- **Detección de acordes** (muestra nombre del acorde + notas activas)

### 🔌 Conectividad MIDI

- **Entrada MIDI USB:** selecciona tu teclado/interfaz
- **Salida MIDI USB:** envía señales MIDI a dispositivos externos

### 📱 PWA (Progressive Web App)

- **Instalable** en Android, iOS y desktop
- **Funciona offline** (Service Worker)
- **Responsive** (móvil, tablet, desktop)
- Icono webp, theme-color, meta tags Apple

---

## 🛠️ Stack Técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Audio | Web Audio API + Samples |
| MIDI | Web MIDI API |
| PWA | Service Worker + Manifest |
| Visualización | Canvas API |
| Analítica | GoatCounter (privacy-friendly) |
| Despliegue | Estático (GitHub Pages / Netlify / Vercel) |

---

## 📂 Estructura del Proyecto
 yamirla-piano-pwa-3/
├── index.html # Estructura principal
├── style.css # Estilos y diseño
├── app.js # Lógica: audio, MIDI, grabación, UI
├── manifest.json # PWA manifest
├── sw.js # Service Worker (offline)
├── image/
│ └── icon-192.webp # Icono PWA
└── README.md  
