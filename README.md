# osc-chat

multiplayer osc message sequencer, receiver, and sound generator

## todo

### general features

- [x] use webpack so i can structure my frontend code more nicely
- [x] model and load channels in a way that's more maintainable and makes adding channels easier
- [x] add some basic channel settings and ensure they're extensible
- [x] add per-channel volume control
- [x] start persisting channel config to a db (must be done entirely server-side) and loading from it on startup
- [ ] add global settings (time sig?? bpm??) to option groups in control channel
- [ ] add effects to channels, or a way of adding/confguring effects
- [x] quantize messages that trigger sound
- [ ] add more voices to the instrument channels
- [ ] add a second synth channel
- [x] assign new connections a randomly generated username based on IP and include that username in the logs
- [x] OPTIONAL (if possible): persist that username between sessions somehow?
- [x] add some visual feedback on channels when a sound is produced
- [ ] add some visual feedback on channels when settings are changed
- [ ] improve overall visual design
- [x] change the way user names are set, so that messages from the inbuilt sequencer from different clients can be distinguished
- [ ] add a message explainer (message spec docs page? on to the i/o panel?))
- [x] add a documentation nav bar
- [ ] try setting up again with bun
- [ ] typescript??
- [ ] get testy

### channel types

- [x] control channel (used to modify other channels)
- [x] instrument channel with selectable voices
- [x] synth channel with configurable wave & envelope
- [ ] sampler channel with configurable samples for each note
- [ ] effects channel (reverb)
- [ ] effects channel (????)

## Decisions

### Message format

The messages all have to be ORCA comatible for no other reason other than that I like it and want to use it. ORCA only lets you send numbers, so osc-chat accepts only numbers.

### Channel configuration

Configuration is saved to the channels and not done live on each message to encourage interference between users.

### State

Because messages are broadcast to all clients, any configuration changes are also broadcast to all clients. This makes it hard to persist configuration state between connections, because writing from the client side would result in multiple redundant writes. Instead, the server stores the most recent configuration message of each type, and sends them all as a batch to new clients when they connect.

## development

### running locally

always:
```bash
yarn install
yarn build
```

#### without docker

```bash
yarn run start
```

#### with docker

```bash
yarn run build:docker
yarn run start:docker
```


then go to `http://localhost:8080` in your browser, or send OSC messages to `localhost:57121`

### deploying to aws

log in to the right aws account, then run:

```bash
yarn build
yarn cdk deploy
```
