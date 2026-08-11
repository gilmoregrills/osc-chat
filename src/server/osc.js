const WebSocket = require("ws");
const osc = require("osc");
const generateNameFromIp = require("./utils").generateNameFromIp;
const saveControlMessage = require("./ddb").saveControlMessage;

module.exports = {
  initialise: () => {
    const udpPort = new osc.UDPPort({
      localAddress: "0.0.0.0",
      localPort: 57121,
      remoteAddress: "127.0.0.1",
      remotePort: 8081,
      broadcast: true,
    });

    udpPort.on("ready", () => {
      console.log(
        "Broadcasting OSC over UDP to",
        udpPort.options.remoteAddress + ", Port:",
        udpPort.options.remotePort,
      );
    });

    udpPort.on("message", (oscMsg, timeTag, info) => {
      if (oscMsg.address === "/0") {
        saveControlMessage(oscMsg);
      }
    });

    udpPort.open();

    console.log("UDP port created on 0.0.0.0:57121");

    const wss = new WebSocket.Server({
      port: 8081,
    });

    wss.on("connection", (socket) => {
      console.log("A WebSocket connection has been established.");
      var socketPort = new osc.WebSocketPort({
        socket: socket,
      });

      function forwardMessageToWebSocket(oscMsg, timeTag, info) {
        console.log(
          `Received OSC message via UDP: ${JSON.stringify(oscMsg)}, redirecting it to WebSocket.`,
        );
        try {
          socketPort.send({
            address: oscMsg.address,
            args: [
              {
                type: "s",
                value: generateNameFromIp(info.address),
              },
              oscMsg.args,
            ],
          });
        } catch (error) {
          if (error.code === "ERR_UNHANDLED_ERROR") {
            console.log(
              `Error sending OSC message to WebSocket: ${error.message}, closing the connection and removing the listener.`,
            );
            udpPort.removeListener("message", forwardMessageToWebSocket);
            socketPort.close();
          } else {
            throw error;
          }
        }
      }

      udpPort.on("message", forwardMessageToWebSocket);

      socketPort.on("message", (oscMsg) => {
        console.log(
          `Received OSC message via WebSocket: ${JSON.stringify(oscMsg)}, redirecting it to UDP port.`,
        );
        udpPort.send(oscMsg, "127.0.0.1", "57121");
      });
    });
  },
};
