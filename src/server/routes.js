const getControlMessages = require("./ddb").getControlMessages;
const readFileSync = require("fs").readFileSync;
const marked = require("marked");

module.exports = (app) => {
  app.get("/", (req, res) => {
    res.sendFile(__dirname + "../dist/index.html");
  });

  app.get("/spec", (req, res) => {
    var path = __dirname + "/../../doc/spec.md";
    var file = readFileSync(path, "utf8");
    res.send(marked.parse(file.toString()));
  });

  app.get("/api", (req, res) => {
    var path = __dirname + "/../../doc/api.md";
    var file = readFileSync(path, "utf8");
    res.send(marked.parse(file.toString()));
  });

  app.get("/about", (req, res) => {
    var path = __dirname + "/../../doc/about.md";
    var file = readFileSync(path, "utf8");
    res.send(marked.parse(file.toString()));
  });

  app.get("/sequencer", (req, res) => {
    var path = __dirname + "/../../doc/sequencer.md";
    var file = readFileSync(path, "utf8");
    res.send(marked.parse(file.toString()));
  });

  app.post("/api/send-message", (req, res) => {
    const { address, args } = req.body;

    if (!address || args === undefined) { // Check args for undefined specifically, as empty array might be valid
      return res.status(400).send("Address and args are required");
    }

    console.log(
      // Use JSON.stringify for better logging of the body
      `Received OSC message via API: ${JSON.stringify(req.body)}, redirecting it to UDP port`,
    );

    // Defensive check for udpPort (assuming it's expected to be global or injected)
    if (typeof udpPort === 'undefined' || !udpPort || typeof udpPort.send !== 'function') {
      console.error('Error: udpPort is not defined or is not a function.');
      return res.status(500).send('Server configuration error: UDP port not available.');
    }

    udpPort.send(
      {
        address: address,
        args: args,
      },
      "0.0.0.0",
      "57121",
    );

    // Ensure args is an array before calling toString() on it for the response,
    // or handle if it might not be. For OSC, args is typically an array.
    const argsString = Array.isArray(args) ? args.toString() : '';
    res.send(
      `OSC message sent to channel ${address} with args ${argsString}`,
    );
  });

  app.get("/api/get-control-messages", async (req, res) => {
    try {
      const messages = await getControlMessages();
      console.log(`Retrieved control messages: ${JSON.stringify(messages)}`);
      // Using res.json() is generally better for JSON responses
      res.status(200).json({ controlMessages: messages });
    } catch (error) {
      console.error("Error in /api/get-control-messages:", error);
      res.status(500).send("Error fetching control messages");
    }
  });
};
