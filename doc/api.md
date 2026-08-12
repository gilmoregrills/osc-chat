# api

- [chat](/)
- [spec](/spec)
- [about](/about)

For details of the OSC message spec, see [osc msg spec](../spec).

All API endpoints append to the base URL `/api` (this page lol).

## POST /api/send-message

Send an OSC message as JSON to the server, which will convert it to OSC and send it to the UDP port.

### request body

```json
{
  "address": string,
  "args": [int]
}
```

| attribute | description                                             |
|-----------|---------------------------------------------------------|
| address   | The channel number, with a `/` prepended, like: `"/1"`. |
| args      | A list of the args, as integers, like: `[1, 2, 3]`      |

### example

```shell
curl -X POST -H "Content-Type: application/json" -d '{"address": 0, "args2, 5]}' http://localhost:8080/api/send-message
```

## GET /api/get-control-messages

Fetch all persisted control messages, used to configure newly-connected clients.

### response body

```json
{
  "controlMessages": [
    {
      "address": string,
      "args": [int]
    }
  ]
}
```

### example

```shell
curl http://localhost:8080/api/get-control-messages
```
