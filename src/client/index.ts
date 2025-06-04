import { start, getDestination, Transport, Destination } from "tone";
import { updateInputMessageLog } from "./logging";
import { allChannels } from "./channels"; // Channel, ControlChannel not directly used, allChannels is the main interface
import { WebSocketPort } from "osc"; // timeTag might not be used directly here
import { messageStringToMessage } from "./utils";
import { startWaveformLoop } from "./waveform";
import { OSCMessage } from "../osc/types"; // Corrected path

// Setup WebSocket and OSC
const wsUrl: string =
  location.hostname === "localhost" // More robust check for localhost
    ? "ws://localhost:8081"
    : `wss://${location.host}/ws`; // Assumes /ws path for WebSocket on deployed server

const oscPort = new WebSocketPort({
  url: wsUrl,
  metadata: true, // Important for OSC 1.1 time tags if needed, or general structure
});
console.log(`OSC WebSocketPort created for URL: ${wsUrl}`);

oscPort.on("message", (oscMsg: OSCMessage | undefined) => { // Add type for oscMsg
  if (!oscMsg) {
    console.warn("Received undefined OSC message.");
    return;
  }

  // Ensure oscMsg.address and oscMsg.args are valid
  if (typeof oscMsg.address !== 'string' || !Array.isArray(oscMsg.args)) {
    console.error("Received malformed OSC message:", oscMsg);
    return;
  }

  const targetChannel = allChannels.channels[oscMsg.address];
  if (targetChannel) {
    targetChannel.handle(oscMsg);
  } else {
    console.log(`Channel not found for address: ${oscMsg.address}`);
  }

  // Assuming args[0] is sender and args[1] is main content, and they have 'value'
  const sender = oscMsg.args[0]?.value;
  const content = oscMsg.args[1]?.value;
  updateInputMessageLog(
    `${sender || 'unknown'}: ${JSON.stringify(content) || 'N/A'} -> ${oscMsg.address}`,
  );
});

oscPort.on("error", (err: Error) => {
  console.error("OSC Port Error:", err);
});

oscPort.on("open", () => {
  console.log("OSC WebSocketPort opened.");
});

oscPort.on("close", () => {
  console.log("OSC WebSocketPort closed.");
});


// Setup channels
allChannels.initialise();

// Setup event listeners/initialisers
window.onload = () => {
  const engineStartButton = document.getElementById("engine-start-button") as HTMLButtonElement | null;
  if (engineStartButton) {
    engineStartButton.addEventListener("click", async () => {
      try {
        await start();
        console.log("Audio context is ready.");
        // Destination volume is a Signal, directly set its value or use rampTo
        if (Destination && Destination.volume) { // Check if Destination and its volume property exist
             Destination.volume.value = -10; // Setting initial volume
        } else {
            console.warn("Tone.Destination.volume is not available to set initial volume.");
        }
         // oscPort.open(); // This call is not needed and incorrect. Connection is attempted on instantiation.
         // The 'open' event of oscPort will confirm when the connection is established.
        startWaveformLoop();
        Transport.start();
        console.log("Tone Transport started.");
        engineStartButton.disabled = true; // Disable button after starting
        engineStartButton.textContent = "Audio Engine Running";
      } catch (e) {
        console.error("Error starting Tone.js audio context:", e);
        // Provide user feedback about the error if possible
        const errorDisplay = document.getElementById("error-message-display"); // Assuming such an element exists
        if (errorDisplay) {
            errorDisplay.textContent = "Could not start audio engine. Please check browser permissions and refresh.";
        }
      }
    });
  } else {
    console.warn("Engine start button not found.");
  }

  const broadcastForm = document.getElementById("broadcast-form") as HTMLFormElement | null;
  if (broadcastForm) {
    broadcastForm.addEventListener("submit", (event: SubmitEvent) => {
      event.preventDefault();
      const messageInput = document.getElementById("text-input-message-field") as HTMLInputElement | null;
      const sentMessageDisplay = document.getElementById("sent-message") as HTMLParagraphElement | null;

      if (messageInput && messageInput.value) {
        const simpleMessage = messageStringToMessage(messageInput.value);

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

        const messageToSend: OSCMessage = {
            address: simpleMessage.address,
            args: oscArgs
        };

        console.log(
          `Sending OSC from frontend: ${JSON.stringify(messageToSend)}`,
        );
        oscPort.send(messageToSend);

        if (sentMessageDisplay) {
          sentMessageDisplay.textContent = `Sent: ${JSON.stringify(messageToSend)}`;
        }
        messageInput.value = ""; // Clear input after sending
      }
    });
  } else {
    console.warn("Broadcast form not found.");
  }
};
