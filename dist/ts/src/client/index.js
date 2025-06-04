"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tone_1 = require("tone");
const logging_1 = require("./logging");
const channels_1 = require("./channels"); // Channel, ControlChannel not directly used, allChannels is the main interface
const osc_1 = require("osc"); // timeTag might not be used directly here
const utils_1 = require("./utils");
const waveform_1 = require("./waveform");
// Setup WebSocket and OSC
const wsUrl = location.hostname === "localhost" // More robust check for localhost
    ? "ws://localhost:8081"
    : `wss://${location.host}/ws`; // Assumes /ws path for WebSocket on deployed server
const oscPort = new osc_1.WebSocketPort({
    url: wsUrl,
    metadata: true, // Important for OSC 1.1 time tags if needed, or general structure
});
console.log(`OSC WebSocketPort created for URL: ${wsUrl}`);
oscPort.on("message", (oscMsg) => {
    if (!oscMsg) {
        console.warn("Received undefined OSC message.");
        return;
    }
    // Ensure oscMsg.address and oscMsg.args are valid
    if (typeof oscMsg.address !== 'string' || !Array.isArray(oscMsg.args)) {
        console.error("Received malformed OSC message:", oscMsg);
        return;
    }
    const targetChannel = channels_1.allChannels.channels[oscMsg.address];
    if (targetChannel) {
        targetChannel.handle(oscMsg);
    }
    else {
        console.log(`Channel not found for address: ${oscMsg.address}`);
    }
    // Assuming args[0] is sender and args[1] is main content, and they have 'value'
    const sender = oscMsg.args[0]?.value;
    const content = oscMsg.args[1]?.value;
    (0, logging_1.updateInputMessageLog)(`${sender || 'unknown'}: ${JSON.stringify(content) || 'N/A'} -> ${oscMsg.address}`);
});
oscPort.on("error", (err) => {
    console.error("OSC Port Error:", err);
});
oscPort.on("open", () => {
    console.log("OSC WebSocketPort opened.");
});
oscPort.on("close", () => {
    console.log("OSC WebSocketPort closed.");
});
// Setup channels
channels_1.allChannels.initialise();
// Setup event listeners/initialisers
window.onload = () => {
    const engineStartButton = document.getElementById("engine-start-button");
    if (engineStartButton) {
        engineStartButton.addEventListener("click", async () => {
            try {
                await (0, tone_1.start)();
                console.log("Audio context is ready.");
                // Destination volume is a Signal, directly set its value or use rampTo
                if (tone_1.Destination && tone_1.Destination.volume) { // Check if Destination and its volume property exist
                    tone_1.Destination.volume.value = -10; // Setting initial volume
                }
                else {
                    console.warn("Tone.Destination.volume is not available to set initial volume.");
                }
                // oscPort.open(); // This call is not needed and incorrect. Connection is attempted on instantiation.
                // The 'open' event of oscPort will confirm when the connection is established.
                (0, waveform_1.startWaveformLoop)();
                tone_1.Transport.start();
                console.log("Tone Transport started.");
                engineStartButton.disabled = true; // Disable button after starting
                engineStartButton.textContent = "Audio Engine Running";
            }
            catch (e) {
                console.error("Error starting Tone.js audio context:", e);
                // Provide user feedback about the error if possible
                const errorDisplay = document.getElementById("error-message-display"); // Assuming such an element exists
                if (errorDisplay) {
                    errorDisplay.textContent = "Could not start audio engine. Please check browser permissions and refresh.";
                }
            }
        });
    }
    else {
        console.warn("Engine start button not found.");
    }
    const broadcastForm = document.getElementById("broadcast-form");
    if (broadcastForm) {
        broadcastForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const messageInput = document.getElementById("text-input-message-field");
            const sentMessageDisplay = document.getElementById("sent-message");
            if (messageInput && messageInput.value) {
                const simpleMessage = (0, utils_1.messageStringToMessage)(messageInput.value);
                // Convert SimplifiedOSCMessage to OSCMessage for sending
                // This assumes args are to be sent as type 's' (string) or 'i' (integer) etc.
                // For simplicity, let's assume all numeric args are integers and others are strings.
                // A more robust solution would infer types or have UI specify them.
                const oscArgs = simpleMessage.args.map(arg => {
                    if (typeof arg === 'number' && Number.isInteger(arg)) {
                        return { type: 'i', value: arg };
                    }
                    // Add more type checks (f for float, etc.) if needed
                    return { type: 's', value: String(arg) };
                });
                const messageToSend = {
                    address: simpleMessage.address,
                    args: oscArgs
                };
                console.log(`Sending OSC from frontend: ${JSON.stringify(messageToSend)}`);
                oscPort.send(messageToSend);
                if (sentMessageDisplay) {
                    sentMessageDisplay.textContent = `Sent: ${JSON.stringify(messageToSend)}`;
                }
                messageInput.value = ""; // Clear input after sending
            }
        });
    }
    else {
        console.warn("Broadcast form not found.");
    }
};
//# sourceMappingURL=index.js.map