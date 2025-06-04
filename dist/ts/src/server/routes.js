"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ddb_1 = require("./ddb");
const fs_1 = require("fs");
const marked_1 = require("marked");
const path_1 = __importDefault(require("path")); // Import path module for robust path handling
const osc_1 = __importDefault(require("osc")); // Import osc for udpPort
// Create a UDP port instance - this might need to be shared from osc.ts or initialized here
// For now, let's assume it's initialized similarly to how it's done in osc.ts
// This is a placeholder and might need adjustment based on your application structure.
const udpPort = new osc_1.default.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 57122, // Using a different port for sending to avoid conflict if osc.ts is also running
    remoteAddress: "0.0.0.0", // Sending to the same machine where osc.ts UDP listener is
    remotePort: 57121,
    broadcast: true,
});
udpPort.open(); // Open the port
exports.default = (app) => {
    app.get("/", (req, res) => {
        // Use path.join for constructing file paths
        res.sendFile(path_1.default.join(__dirname, "../dist/index.html"));
    });
    const serveMarkdown = (filePath) => (req, res) => {
        const absolutePath = path_1.default.join(__dirname, filePath);
        try {
            const file = (0, fs_1.readFileSync)(absolutePath, "utf8");
            res.send(marked_1.marked.parse(file.toString()));
        }
        catch (error) {
            console.error(`Error reading markdown file at ${absolutePath}:`, error);
            res.status(500).send("Error loading page content.");
        }
    };
    app.get("/spec", serveMarkdown("/../../doc/spec.md"));
    app.get("/api", serveMarkdown("/../../doc/api.md"));
    app.get("/about", serveMarkdown("/../../doc/about.md"));
    app.get("/sequencer", serveMarkdown("/../../doc/sequencer.md"));
    app.post("/api/send-message", (req, res) => {
        const { address, args } = req.body; // Assume req.body is an OSCMessage
        console.log(`Received OSC message via API: ${JSON.stringify(req.body)}, redirecting it to UDP port`);
        udpPort.send({
            address: address,
            args: args,
        }, "0.0.0.0", // Target IP
        57121);
        res.send(`OSC message sent to channel ${address} with args ${args.toString()}`);
    });
    app.get("/api/get-control-messages", async (req, res) => {
        try {
            const messages = await (0, ddb_1.getControlMessages)();
            console.log(`Retrieved control messages: ${JSON.stringify(messages)}`);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ controlMessages: messages }));
        }
        catch (error) {
            console.error("Error retrieving control messages:", error);
            res.status(500).send("Error retrieving control messages.");
        }
    });
};
//# sourceMappingURL=routes.js.map