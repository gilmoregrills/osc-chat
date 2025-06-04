import { Express, Request, Response } from "express";
import { getControlMessages } from "./ddb";
import { readFileSync } from "fs";
import { marked } from "marked";
import path from "path"; // Import path module for robust path handling
import osc from "osc"; // Import osc for udpPort
import { OSCMessage } from "../osc/types";

// Create a UDP port instance - this might need to be shared from osc.ts or initialized here
// For now, let's assume it's initialized similarly to how it's done in osc.ts
// This is a placeholder and might need adjustment based on your application structure.
const udpPort = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 57122, // Using a different port for sending to avoid conflict if osc.ts is also running
  remoteAddress: "0.0.0.0", // Sending to the same machine where osc.ts UDP listener is
  remotePort: 57121,
  broadcast: true,
});
udpPort.open(); // Open the port

export default (app: Express): void => {
  app.get("/", (req: Request, res: Response) => {
    // Use path.join for constructing file paths
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });

  const serveMarkdown = (filePath: string) => (req: Request, res: Response) => {
    const absolutePath = path.join(__dirname, filePath);
    try {
      const file = readFileSync(absolutePath, "utf8");
      res.send(marked.parse(file.toString()));
    } catch (error) {
      console.error(`Error reading markdown file at ${absolutePath}:`, error);
      res.status(500).send("Error loading page content.");
    }
  };

  app.get("/spec", serveMarkdown("/../../doc/spec.md"));
  app.get("/api", serveMarkdown("/../../doc/api.md"));
  app.get("/about", serveMarkdown("/../../doc/about.md"));
  app.get("/sequencer", serveMarkdown("/../../doc/sequencer.md"));

  app.post("/api/send-message", (req: Request, res: Response) => {
    const { address, args } = req.body as OSCMessage; // Assume req.body is an OSCMessage
    console.log(
      `Received OSC message via API: ${JSON.stringify(req.body)}, redirecting it to UDP port`,
    );
    udpPort.send(
      {
        address: address,
        args: args,
      },
      "0.0.0.0", // Target IP
      57121, // Target Port, ensure this is a number
    );

    res.send(
      `OSC message sent to channel ${address} with args ${args.toString()}`,
    );
  });

  app.get("/api/get-control-messages", async (req: Request, res: Response) => {
    try {
      const messages = await getControlMessages();
      console.log(`Retrieved control messages: ${JSON.stringify(messages)}`);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ controlMessages: messages }));
    } catch (error) {
      console.error("Error retrieving control messages:", error);
      res.status(500).send("Error retrieving control messages.");
    }
  });
};
