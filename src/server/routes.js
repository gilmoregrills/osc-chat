const getControlMessages = require("./ddb").getControlMessages;
const readFileSync = require("fs").readFileSync;
const marked = require("marked");

const renderer = {
  heading(text, level) {
    const slug = text
      .toLowerCase()
      .trim()
      .replace(/[^\w]+/g, "-");
    return `<h${level} id="${slug}">${text}</h${level}>`;
  },
};

module.exports = (app) => {
  app.get("/", (req, res) => {
    res.sendFile(__dirname + "../dist/index.html");
  });

  app.get("/spec", (req, res) => {
    var path = __dirname + "/../../doc/spec.md";
    var file = readFileSync(path, "utf8");
    marked.use({ renderer });
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
    console.log(
      `Received OSC message via API: ${req.body}, redirecting it to UDP port`,
    );
    udpPort.send(
      {
        address: req.body.address,
        args: req.body.args,
      },
      "0.0.0.0",
      "57121",
    );

    res.send(
      `OSC message sent to channel ${req.body.address} with args ${req.body.args.toString()}`,
    );
  });

  app.get("/api/get-control-messages", async (req, res) => {
    const messages = await getControlMessages();
    console.log(`Retrieved control messages: ${JSON.stringify(messages)}`);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ controlMessages: messages }));
  });
};
