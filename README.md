<img width="942" height="556" alt="Piano-Yamirla-PWA-3" src="https://github.com/user-attachments/assets/a8393b0c-153b-4680-9a04-69339cb9fd45" />


# 🎹 Yamirla Piano PWA-3

> **Yamirla Piano PWA-3** es una estación de trabajo musical y sintetizador web progresivo (PWA) de nivel profesional, diseñada para ofrecer una experiencia de interpretación musical de ultra baja latencia directamente desde el navegador, sin instalaciones pesadas.

---

## ✨ Características Principales

* 🎼 **Visualización de Pentagrama en Vivo:** Detección e iluminación en tiempo real de notas activas en Clave de Sol y Clave de Fa sobre un lienzo interactivo.
* 🧠 **Reconocimiento Avanzado de Acordes:** Identificación automática de acordes complejos, acordes abiertos e inversiones musicales mientras tocas.
* 🎹 **Soporte MIDI Nativo (Web MIDI API):** Conexión Plug & Play con teclados USB y controladores físicos, con soporte completo para pedal de *sustain* (CC 64).
* 🎛️ **Efectos DSP Profesionales:**
  * **Reverberación de Impulsos:** Procesamiento convolutivo para acústicas de sala naturales.
  * **Efecto Decay Regulable:** Envolventes ajustables para el desvanecimiento de las notas.
  * **Delay con Feedback:** Retardo estéreo con control de realimentación y volumen.
* 🎵 **Yamirla Synth Pad:** Capa de sintetizador híbrido de fondo (Warm Pad, Soft Strings) para dar texturas atmosféricas a tus melodías.
* 📂 **Presets Multi-Instrumento:** Muestras de audio de alta fidelidad para pianos acústicos (Korg, Kawai), pianos eléctricos (Wurlitzer, Rhodes), guitarras, acordeones y órganos.
* ⚡ **Tecnología PWA Offline:** Funciona sin conexión a internet gracias a su Service Worker optimizado con caché dinámica de muestras de audio.

---

## 🛠️ Tecnologías y Arquitectura

* **HTML5 Canvas** - Renderizado fluido de partituras y pentagramas.
* **Web Audio API** - Motor central de síntesis, nodos de ganancia, convolución y efectos en tiempo real.
* **Web MIDI API** - Comunicación con hardware externo.
* **Service Workers & Manifest** - Capacidades de aplicación web progresiva e instalación en dispositivos.

---

## 🚀 Despliegue Local / Desarrollo

Si deseas probar el proyecto localmente en tu equipo:

1. Clona este repositorio o descárgalo:
   ```bash
   git clone [https://github.com/TU-USUARIO/yamirla-piano-pwa.git](https://github.com/TU-USUARIO/yamirla-piano-pwa.git)
