const osc = require("osc");
const WebSocket = require("ws");
const utils = require("./utils");
const ddb = require("./ddb");
const { initialise } = require("./osc"); // Assuming initialise is the main exported function

// Mock external libraries and local modules
jest.mock("osc");
jest.mock("ws");
jest.mock("./utils");
jest.mock("./ddb");

describe("OSC Server Initialization and Message Handling", () => {
  let mockUdpPortInstance;
  let mockWebSocketServerInstance;
  let mockSocketPortInstance;
  let mockClientSocket;

  // Captured event handlers & functions
  let ddbUdpMessageCallback;          // For UDP messages going to DDB
  let websocketForwardingUdpMessageCallback; // For UDP messages going to a specific WebSocket
  let udpPortOnErrorCallback;
  let wssOnConnectionCallback;
  // let clientSocketOnCloseCallback; // client socket.on('close') is not used in osc.js
  let socketPortOnMessageCallback;   // For messages from WebSocket to UDP
  let socketPortOnErrorCallback;


  beforeEach(() => {
    jest.clearAllMocks();

    // --- Mock osc.UDPPort ---
    // Store captured listeners in an object to differentiate them if 'on' is called multiple times for 'message'
    const udpMessageHandlers = {};
    let udpListenerCounter = 0;

    const udpOptionsPassedToConstructor = { // Capture typical options for reference
      localAddress: "0.0.0.0",
      localPort: 57121,
      remoteAddress: "127.0.0.1",
      remotePort: 8081,
      broadcast: true,
    };
    mockUdpPortInstance = {
      open: jest.fn(),
      send: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === "message") {
          if (!ddbUdpMessageCallback) {
            ddbUdpMessageCallback = callback;
          }
          udpMessageHandlers[udpListenerCounter++] = callback;
        }
        if (event === "error") udpPortOnErrorCallback = callback;
        if (event === "ready") mockUdpPortInstance.readyCallback = callback;
      }),
      close: jest.fn(),
      removeListener: jest.fn(),
      // Add the options property that the 'ready' handler in osc.js expects
      options: udpOptionsPassedToConstructor
    };
    // When osc.UDPPort is called, it will be with specific options.
    // We can make the mock store these if needed, or just use the typical ones.
    osc.UDPPort.mockImplementation((options) => {
      // Store the actual options passed if needed for assertions later
      // mockUdpPortInstance.constructorOptions = options;
      // Return the mock instance, potentially with options merged if necessary
      mockUdpPortInstance.options = options; // Ensure the mock has the options it was constructed with
      return mockUdpPortInstance;
    });

    // --- Mock ws.Server (WebSocket.Server) ---
    mockWebSocketServerInstance = {
      on: jest.fn((event, callback) => {
        if (event === "connection") wssOnConnectionCallback = callback;
      }),
      close: jest.fn(),
    };
    WebSocket.Server.mockImplementation(() => mockWebSocketServerInstance);

    // --- Mock osc.WebSocketPort (used inside WSS connection) ---
    mockSocketPortInstance = {
      send: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === "message") socketPortOnMessageCallback = callback;
        if (event === "error") socketPortOnErrorCallback = callback;
      }),
      close: jest.fn(),
    };
    osc.WebSocketPort.mockImplementation(() => mockSocketPortInstance);

    // --- Mock client WebSocket ---
    mockClientSocket = {
      on: jest.fn((event, callback) => {
        // client socket.on('close') is not used in osc.js
        // if (event === "close") clientSocketOnCloseCallback = callback;
      }),
    };

    utils.generateNameFromIp.mockReturnValue("test-client-name");
    ddb.saveControlMessage.mockResolvedValue({});
  });

  test("1. UDP Port Setup: should correctly initialize and open UDP port", () => {
    initialise();
    expect(osc.UDPPort).toHaveBeenCalledWith({
      localAddress: "0.0.0.0",
      localPort: 57121, // Corrected from osc.js
      remoteAddress: "127.0.0.1", // Corrected from osc.js
      remotePort: 8081, // Corrected from osc.js
      // metadata: true, // Not used in osc.js
      broadcast: true,
    });
    expect(mockUdpPortInstance.open).toHaveBeenCalled();
    // Check for specific on('ready') call
    const onCalls = mockUdpPortInstance.on.mock.calls;
    expect(onCalls.find(call => call[0] === 'ready')).toBeTruthy();
    // Removed check for 'error' handler as it's not in osc.js

    if (mockUdpPortInstance.readyCallback) {
      mockUdpPortInstance.readyCallback(); // Simulate for coverage
    }
  });

  test("2. WebSocket Server Setup: should initialize WebSocket.Server correctly", () => {
    initialise();
    expect(WebSocket.Server).toHaveBeenCalledWith({ port: 8081 }); // Corrected
    expect(mockWebSocketServerInstance.on).toHaveBeenCalledWith("connection", expect.any(Function));
  });

  describe("3. WebSocket Connection Handling and Message Forwarding", () => {
    let capturedForwardOscToWebsocket; // To store the dynamically created handler

    beforeEach(() => {
      initialise();
      // Spy on udpPort.on specifically for the 'connection' handler's scope
      // to capture the dynamically added 'forwardOscToWebsocket'
      const originalUdpOn = mockUdpPortInstance.on;
      mockUdpPortInstance.on = jest.fn((event, callback) => {
        originalUdpOn(event, callback); // Call the original mock 'on' to maintain its behavior (like capturing ddbUdpMessageCallback)
        if (event === "message") {
          // Assumption: the last 'message' handler added by wss.on('connection') is the one we want.
          // This is fragile. A better way would be if osc.js returned handles to these.
          websocketForwardingUdpMessageCallback = callback;
          capturedForwardOscToWebsocket = callback; // Capture for removeListener assertion
        }
      });

      if (wssOnConnectionCallback) {
        wssOnConnectionCallback(mockClientSocket, { remoteAddress: "127.0.0.1" });
      } else {
        throw new Error("wssOnConnectionCallback was not captured by the initial initialise() call.");
      }
      mockUdpPortInstance.on = originalUdpOn; // Restore original mock
    });

    test("3.1 WebSocket Connection: should instantiate osc.WebSocketPort on new connection", () => {
      expect(osc.WebSocketPort).toHaveBeenCalledWith({
        socket: mockClientSocket,
        // metadata: true, // Not used in osc.js
      });
      expect(mockSocketPortInstance.on).toHaveBeenCalledWith("message", expect.any(Function));
      // Removed check for 'error' handler on socketPort as it's not in osc.js
      // client socket.on('close') is not used in osc.js
      // expect(mockClientSocket.on).toHaveBeenCalledWith("close", expect.any(Function));
    });

    test("4. UDP to WebSocket Message Forwarding: should forward message with generated name", () => {
      const oscMsg = { address: "/test/udp", args: [{ type: "s", value: "data" }] };
      const info = { address: "192.168.1.100" };
      utils.generateNameFromIp.mockReturnValue("udp-client-name");

      if (!websocketForwardingUdpMessageCallback) throw new Error("UDP message handler for WS forwarding not captured");
      websocketForwardingUdpMessageCallback(oscMsg, null, info);

      expect(utils.generateNameFromIp).toHaveBeenCalledWith(info.address);
      expect(mockSocketPortInstance.send).toHaveBeenCalledWith({
        address: "/test/udp",
        args: [
            { type: "s", value: "udp-client-name" },
            oscMsg.args, // The entire original args array
        ],
      });
    });

    test("4.1 UDP to WebSocket: Error Handling on socketPort.send()", () => {
      const oscMsg = { address: "/test/error", args: [] };
      const info = { address: "1.2.3.4" };
      mockSocketPortInstance.send.mockImplementation(() => {
        const error = new Error("Simulated send error");
        error.code = "ERR_UNHANDLED_ERROR"; // Corrected to match osc.js
        throw error;
      });

      if (!websocketForwardingUdpMessageCallback) throw new Error("UDP message handler for WS forwarding not captured");

      expect(() => websocketForwardingUdpMessageCallback(oscMsg, null, info)).not.toThrow();
      expect(mockSocketPortInstance.close).toHaveBeenCalled();
      // Assert that removeListener was called with the correct function
      expect(mockUdpPortInstance.removeListener).toHaveBeenCalledWith("message", capturedForwardOscToWebsocket);
    });

    test("6. WebSocket to UDP Message Forwarding: should forward message from WebSocket to UDP", () => {
      const oscMsg = { address: "/ws/to/udp", args: [{ type: "f", value: 0.75 }] };
      if (!socketPortOnMessageCallback) throw new Error("socketPort.on('message') callback not captured");

      socketPortOnMessageCallback(oscMsg);

      expect(mockUdpPortInstance.send).toHaveBeenCalledWith(oscMsg, "0.0.0.0", "57121"); // Corrected port to string
    });

    // Removed: test("WebSocket connection close should remove UDP listener", () => { ... })
    // Reason: This functionality is not implemented in osc.js
  });

  test("5. UDP to saveControlMessage (for /0 messages): should call saveControlMessage only for /0", () => {
    // This test relies on ddbUdpMessageCallback captured by the main beforeEach
    initialise(); // Ensure ddbUdpMessageCallback is set up

    if (!ddbUdpMessageCallback) throw new Error("UDP message handler for DDB (ddbUdpMessageCallback) not captured");

    const oscMsgForDDB = { address: "/0", args: [{ type: "i", value: 1 }] };
    ddbUdpMessageCallback(oscMsgForDDB, null, {});
    expect(ddb.saveControlMessage).toHaveBeenCalledWith(oscMsgForDDB);

    ddb.saveControlMessage.mockClear();

    const oscMsgNotForDDB = { address: "/1", args: [{ type: "i", value: 0 }] };
    ddbUdpMessageCallback(oscMsgNotForDDB, null, {});
    expect(ddb.saveControlMessage).not.toHaveBeenCalled();
  });
});
