# osc-chat

multiplayer osc message processor and sender

## todo

- [x] use webpack so i can structure my frontend code more nicely
- [x] model and load channels in a way that's more maintainable and makes adding channels easier
- [ ] add some configurable attributes to channels (volume, sound source, type of wave, routing through additional components/effects, etc) and stop using Tone.js' inbuilt instruments, allow configuration through the control channel but set some basic defaults, add a button that resets all channels to neutral
- [ ] start storing some minimal state for persistent config of channel settings between sessions: loading of state i guess should be done on page load, but in general state changes will happen in response to OSC messages, so an OSC message to the control channel might change the state of another channel while live, but it also needs to persist that setting change to a DB so new sessions start with the same state.
- [ ] start persisting all OSC message logs, displaying the 5 most recent and making the full/most recent tail available on /logs
- [ ] assign new connections a randomly generated username and include that username in the logs
- [ ] OPTIONAL (if possible): persist that username between sessions somehow?

## running locally

always:
```bash
yarn install
yarn build
```

### without docker

```bash
yarn run start
```

### with docker

```bash
yarn run build:docker
yarn run start:docker
```


then go to `http://localhost:8080` in your browser, or send OSC messages to `localhost:57121`

## deploying to aws

log in to the right aws account, then run:

```bash
yarn build
yarn cdk deploy
```
