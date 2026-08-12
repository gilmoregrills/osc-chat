# osc-chat

- [api](/api)
- [chat](/)
- [spec](/spec)

osc-chat is a real-time <a href="https://github.com/hundredrabbits/Orca">ORCA</a>-compatible multiplayer sound generator. Users can chat using any tool that is cabale of sending OSC messages.

## How it works

osc-chat receives simple OSC messages via the server, and broadcasts them to all connected clients like a chatroom, except in this case the messages are used to generate sounds.

This means that all clients should hear the same things, and can influence what other clients hear.

## Getting started
