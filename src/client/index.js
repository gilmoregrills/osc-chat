import { start, getDestination, Transport } from "tone";
import { updateInputMessageLog } from "./logging";
import { Channel, ControlChannel, allChannels } from "./channels";
import { WebSocketPort, timeTag } from "osc";
import { messageStringToMessage } from "./utils";
import { startWaveformLoop } from "./waveform";

//setup websocket and OSC
const wsUrl =
  location.host == "localhost:8080"
    ? "ws://localhost:8081"
    : `wss://${location.host}/ws`;

var oscPort = new WebSocketPort({
  url: wsUrl,
});
console.log(`OSC WebSocketPort created on ${wsUrl}`);

oscPort.on("message", (oscMsg) => {
  allChannels.channels[oscMsg.address]?.handle(oscMsg) ||
    console.log(`Channel not found: ${oscMsg.address}`);

  updateInputMessageLog(
    `${oscMsg.args[0]}: ${JSON.stringify(oscMsg.args[1])} -> ${oscMsg.address}`,
  );
});

//setup channels
allChannels.initialise();

// setup event listeners/initialisers
window.onload = () => {
  document
    .getElementById("engine-start-button")
    ?.addEventListener("click", async () => {
      await start();
      console.log("Audio context is ready");
      oscPort.open();
      console.log("OSC WebSocketPort opened");
      getDestination().volume.rampTo(-10, 0.001);
      startWaveformLoop();
      Transport.start();
    });

  document
    .getElementById("broadcast-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const message = messageStringToMessage(
        document.getElementById("text-input-message-field").value,
      );
      console.log(
        `Sending osc from frontend to backend and back again: ${JSON.stringify(message)}`,
      );
      oscPort.send(message);
      document.getElementById("sent-message").textContent =
        `sent: ${JSON.stringify(message)}`;
    });
};
