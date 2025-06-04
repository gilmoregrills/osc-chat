"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialise = void 0;
const ws_1 = __importDefault(require("ws"));
const osc_1 = __importDefault(require("osc"));
const utils_1 = require("./utils");
const ddb_1 = require("./ddb");
const initialise = () => {
    const udpPort = new osc_1.default.UDPPort({
        localAddress: "0.0.0.0",
        localPort: 57121,
        remoteAddress: "127.0.0.1",
        remotePort: 8081,
        broadcast: true,
    });
    udpPort.on("ready", () => {
        console.log("Broadcasting OSC over UDP to", udpPort.options.remoteAddress + ", Port:", udpPort.options.remotePort);
    });
    udpPort.on("message", (oscMsg, timeTag, info) => {
        if (oscMsg.address === "/0") {
            (0, ddb_1.saveControlMessage)(oscMsg);
        }
    });
    udpPort.open();
    console.log("UDP port created on 0.0.0.0:57121");
    const wss = new ws_1.default.Server({
        port: 8081,
    });
    wss.on("connection", (socket) => {
        console.log("A WebSocket connection has been established.");
        const socketPort = new osc_1.default.WebSocketPort({
            socket: socket,
        });
        function forwardMessageToWebSocket(oscMsg, timeTag, info) {
            console.log(`Received OSC message via UDP: ${JSON.stringify(oscMsg)}, redirecting it to WebSocket.`);
            try {
                const argsArray = [
                    {
                        type: "s",
                        value: (0, utils_1.generateNameFromIp)(info.address),
                    },
                    // Spread the existing arguments from oscMsg
                    // Assuming oscMsg.args is an array of OSCArgument
                    ...oscMsg.args,
                ];
                socketPort.send({
                    address: oscMsg.address,
                    args: argsArray,
                });
            }
            catch (error) {
                if (error.code === "ERR_UNHANDLED_ERROR") {
                    console.log(`Error sending OSC message to WebSocket: ${error.message}, closing the connection and removing the listener.`);
                    udpPort.removeListener("message", forwardMessageToWebSocket);
                    socketPort.close();
                }
                else {
                    throw error;
                }
            }
        }
        udpPort.on("message", forwardMessageToWebSocket);
        socketPort.on("message", (oscMsg) => {
            if (oscMsg) {
                console.log(`Received OSC message via WebSocket: ${JSON.stringify(oscMsg)}, redirecting it to UDP port.`);
                udpPort.send(oscMsg, "0.0.0.0", 57121); // Ensure remotePort is a number
            }
        });
    });
};
exports.initialise = initialise;
//# sourceMappingURL=osc.js.map