import WebSocket from "ws";
import osc from "osc";
import { generateNameFromIp } from "./utils";
import { saveControlMessage } from "./ddb";
import { OSCMessage, OSCArgument } from "../osc/types"; // Assuming you have a type definition for OSCMessage

// Define a type for the info object received in UDP messages
interface UDPMessageInfo {
  address: string;
  port: number;
  size: number;
  family: "IPv4" | "IPv6";
}

export const initialise = (): void => {
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

  udpPort.on("message", (oscMsg: OSCMessage, timeTag: number | undefined, info: UDPMessageInfo) => {
    if (oscMsg.address === "/0") {
      saveControlMessage(oscMsg);
    }
  });

  udpPort.open();

  console.log("UDP port created on 0.0.0.0:57121");

  const wss = new WebSocket.Server({
    port: 8081,
  });

  wss.on("connection", (socket: WebSocket) => {
    console.log("A WebSocket connection has been established.");
    const socketPort = new osc.WebSocketPort({
      socket: socket,
    });

    function forwardMessageToWebSocket(oscMsg: OSCMessage, timeTag: number | undefined, info: UDPMessageInfo) {
      console.log(
        `Received OSC message via UDP: ${JSON.stringify(oscMsg)}, redirecting it to WebSocket.`,
      );
      try {
        const argsArray: OSCArgument[] = [
          {
            type: "s",
            value: generateNameFromIp(info.address),
          },
          // Spread the existing arguments from oscMsg
          // Assuming oscMsg.args is an array of OSCArgument
          ...(oscMsg.args as OSCArgument[]),
        ];

        socketPort.send({
          address: oscMsg.address,
          args: argsArray,
        });
      } catch (error: any) {
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

    socketPort.on("message", (oscMsg: OSCMessage | undefined) => {
      if (oscMsg) {
        console.log(
          `Received OSC message via WebSocket: ${JSON.stringify(oscMsg)}, redirecting it to UDP port.`,
        );
        udpPort.send(oscMsg, "0.0.0.0", 57121); // Ensure remotePort is a number
      }
    });
  });
};
