import express, { Express } from "express";
import * as osc from "./osc";
import routes from "./routes"; // Assuming routes.ts exports default

osc.initialise();

const app: Express = express();
const port: number = 8080;

// server reference might be needed for WebSocket or other integrations later
const server = app.listen(port, () => {
  console.log(`Express listening on port ${port}.`);
});

app.use(express.static("dist"));
app.use(express.json());

routes(app);
