"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWaveformLoop = void 0;
const tone_1 = require("tone");
// const canvasWidth = 512; // This constant doesn't seem to be used. Remove?
const makeCanvas = () => {
    const div = document.getElementById("waveform");
    if (!div) {
        console.error("Waveform container div with ID 'waveform' not found.");
        return null;
    }
    const canvas = document.createElement("canvas");
    div.appendChild(canvas);
    canvas.id = "waveform-canvas";
    // Set canvas size based on actual div size, ensure it's not zero
    canvas.width = div.offsetWidth > 0 ? div.offsetWidth : 512; // Default width if offsetWidth is 0
    canvas.height = div.offsetHeight > 0 ? div.offsetHeight : 100; // Default height if offsetHeight is 0
    return canvas;
};
// Returns the nearest power of 2, flooring.
// Example: nearestPowerOf2(500) will return 256.
// For Waveform, sizes like 32, 64, 128, 256, 512, 1024, 2048, 4096 are typical.
const nearestPowerOf2 = (n) => {
    if (n <= 0)
        return 32; // Default to a small power of 2 if input is invalid
    return Math.pow(2, Math.floor(Math.log2(n)));
};
const startWaveformLoop = () => {
    const canvas = makeCanvas();
    if (!canvas) {
        console.error("Canvas element could not be created for waveform display.");
        return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Could not get 2D rendering context for canvas.");
        return;
    }
    const midpt = canvas.height / 2;
    // Ensure waveformWidth is a power of two, suitable for Tone.Waveform
    const waveformWidth = nearestPowerOf2(canvas.width);
    const waveformPointInterval = canvas.width / waveformWidth;
    // Initialize Waveform with a valid size (power of 2)
    const waveform = new tone_1.Waveform(waveformWidth);
    tone_1.Master.connect(waveform); // Connect Master output to the waveform analyzer
    const repeat = (time) => {
        // Use Draw.schedule to ensure drawing is synced with Tone.js Transport's animation frame
        tone_1.Draw.schedule(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const waveData = waveform.getValue(); // Float32Array of waveform values
            ctx.beginPath();
            ctx.strokeStyle = "black"; // Set a stroke color
            // Iterate over the waveData array to draw the waveform
            // waveData is a Float32Array where values range from -1 to 1
            for (let i = 0; i < waveData.length; i++) {
                const x = i * waveformPointInterval;
                const y = midpt + waveData[i] * midpt; // Scale y to canvas height
                if (i === 0) {
                    ctx.moveTo(x, y);
                }
                else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }, time); // Schedule the drawing callback at the given time
    };
    tone_1.Transport.scheduleRepeat(repeat, "0.1"); // Schedule the repeat function every 0.1 seconds
};
exports.startWaveformLoop = startWaveformLoop;
//# sourceMappingURL=waveform.js.map