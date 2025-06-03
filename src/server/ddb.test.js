const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { mockClient } = require("aws-sdk-client-mock");
require("aws-sdk-client-mock-jest"); // Extends Jest matchers

const { saveControlMessage, getControlMessages } = require("./ddb");
const utils = require("./utils"); // To mock getAWSCredentialsDependingOnEnvironment

// Mock an unexported function by mocking the module it's in (if it were used by other funcs in ddb.js)
// However, getDynamoDBTableName is called internally, so we test its effect.
// For getDynamoDBTableName itself, we will spy on SSMClient.

// Create mock clients
const ddbDocMock = mockClient(DynamoDBDocumentClient);
const ddbClientMock = mockClient(DynamoDBClient); // Although not directly used by ddbDocMock, good practice if ddb.js initializes it
const ssmMock = mockClient(SSMClient);

// Mock getAWSCredentialsDependingOnEnvironment from utils
jest.mock("./utils", () => ({
  ...jest.requireActual("./utils"), // Import and retain default exports
  getAWSCredentialsDependingOnEnvironment: jest.fn(() => ({
    accessKeyId: "fake-key-id",
    secretAccessKey: "fake-secret",
    sessionToken: "fake-token",
  })),
}));


const DUMMY_TABLE_NAME = "test-table";

describe("DynamoDB Operations", () => {
  beforeEach(() => {
    ddbDocMock.reset();
    ssmMock.reset();
    // We don't explicitly mock getDynamoDBTableName here,
    // but rather the SSM call it makes.
  });

  describe("getDynamoDBTableName (indirect testing)", () => {
    it("should fetch table name from SSM when saveControlMessage is called", async () => {
      ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: "ssm-table-for-save" } });
      ddbDocMock.on(PutCommand).resolves({});

      // Ensure args[1] exists and is suitable for channelAndGroup
      const oscMsg = {
        address: "/group/control1",
        args: [
          { type: "s", value: "testValue" }, // args[0]
          "XY"                               // args[1]
        ]
      };
      await saveControlMessage(oscMsg);

      expect(ssmMock).toHaveReceivedCommandWith(GetParameterCommand, { Name: "/osc-chat/dynamodb-table-name" });
      // Also check if PutCommand used the table name from SSM
      expect(ddbDocMock).toHaveReceivedCommandWith(PutCommand, { TableName: "ssm-table-for-save" });
    });

    it("should fetch table name from SSM when getControlMessages is called", async () => {
      ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: "ssm-table-for-get" } });
      ddbDocMock.on(ScanCommand).resolves({ Items: [] }); // Mock Scan to prevent errors

      await getControlMessages();

      expect(ssmMock).toHaveReceivedCommandWith(GetParameterCommand, { Name: "/osc-chat/dynamodb-table-name" });
      expect(ddbDocMock).toHaveReceivedCommandWith(ScanCommand, { TableName: "ssm-table-for-get" });
    });

    // Removed caching test as ddb.js does not implement caching for getDynamoDBTableName
  });

  describe("saveControlMessage", () => {
    beforeEach(async () => {
      // For these tests, assume table name is resolved and potentially cached
      // Or mock SSM consistently for each save/get operation
      ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: DUMMY_TABLE_NAME } });
      ddbDocMock.on(PutCommand).resolves({});
    });

    it("should save a correctly formatted control message", async () => {
      const oscMsg = {
        address: "/group1/controlA",
        // ddb.js expects args[1] to be an array/string for channelAndGroup
        args: [
          { type: "s", value: "mainArg" }, // args[0]
          ["subGroup", "controlElement"]    // args[1] used for channelAndGroup
        ],
      };

      await saveControlMessage(oscMsg);

      expect(ddbDocMock).toHaveReceivedCommandWith(PutCommand, {
        TableName: DUMMY_TABLE_NAME,
        Item: {
          channelAndGroup: "subGroupcontrolElement", // From args[1][0] + args[1][1]
          channel: oscMsg.address,
          args: oscMsg.args, // ddb.js saves the full args array
          timestamp: expect.any(String),
        },
      });
    });

    it("should save message if args[1] is suitable for channelAndGroup", async () => {
      const oscMsg = {
        address: "/group2/controlB",
        args: [
          { type: "s", value: "anotherValue" }, // args[0]
          "CD"                                  // args[1]
        ],
      };

      await saveControlMessage(oscMsg);

      expect(ddbDocMock).toHaveReceivedCommandWith(PutCommand, {
        TableName: DUMMY_TABLE_NAME,
        Item: {
          channelAndGroup: "CD",
          channel: oscMsg.address,
          args: oscMsg.args,
          timestamp: expect.any(String),
        },
      });
    });

    it("should save message with various arg types (args property check)", async () => {
      const complexArgs = [
        { type: "f", value: 1.23 },
        "XY", // For channelAndGroup
        { type: "s", value: "another string" }
      ];
      const oscMsg = {
        address: "/group3/controlC",
        args: complexArgs,
      };
      await saveControlMessage(oscMsg);
      expect(ddbDocMock).toHaveReceivedCommandWith(PutCommand, {
        TableName: DUMMY_TABLE_NAME,
        Item: {
          channelAndGroup: "XY",
          channel: oscMsg.address,
          args: complexArgs, // Entire args array is saved
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe("getControlMessages", () => {
    beforeEach(async () => {
      ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: DUMMY_TABLE_NAME } });
    });

    it("should fetch and transform control messages correctly", async () => {
      const sampleItems = [
        { channelAndGroup: "/g1/c1", channel: "/g1/c1", args: "val1", timestamp: 123 },
        { channelAndGroup: "/g2/c2", channel: "/g2/c2", args: "val2", timestamp: 456 },
      ];
      ddbDocMock.on(ScanCommand).resolves({ Items: sampleItems });

      const messages = await getControlMessages();

      expect(ddbDocMock).toHaveReceivedCommandWith(ScanCommand, { TableName: DUMMY_TABLE_NAME });
      expect(messages).toEqual([
        // Timestamp is not returned by ddb.js's getControlMessages
        { address: "/g1/c1", args: ["loader", "val1"] },
        { address: "/g2/c2", args: ["loader", "val2"] },
      ]);
    });

    it("should handle empty items from DynamoDB", async () => {
      ddbDocMock.on(ScanCommand).resolves({ Items: [] });
      const messages = await getControlMessages();
      expect(ddbDocMock).toHaveReceivedCommandWith(ScanCommand, { TableName: DUMMY_TABLE_NAME });
      expect(messages).toEqual([]);
    });

    it("should handle undefined Items from DynamoDB", async () => {
      ddbDocMock.on(ScanCommand).resolves({}); // No Items property
      const messages = await getControlMessages();
      expect(ddbDocMock).toHaveReceivedCommandWith(ScanCommand, { TableName: DUMMY_TABLE_NAME });
      expect(messages).toEqual([]);
    });
  });
});
