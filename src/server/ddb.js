const {
  DescribeTableCommand,
  DynamoDBClient,
} = require("@aws-sdk/client-dynamodb");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const {
  ScanCommand,
  PutCommand,
  DynamoDBDocumentClient,
} = require("@aws-sdk/lib-dynamodb");
const getAWSCredentialsDependingOnEnvironment =
  require("./utils").getAWSCredentialsDependingOnEnvironment;

const getDynamoDBTableName = async () => {
  credentials = getAWSCredentialsDependingOnEnvironment();
  const ssmClient = new SSMClient({
    region: "eu-west-2",
    credentials: credentials,
  });
  const command = new GetParameterCommand({
    Name: "/osc-chat/dynamodb-table-name",
  });
  const response = await ssmClient.send(command);
  console.log(`Retrieved DynamoDB table name: ${response.Parameter.Value}`);
  return response.Parameter.Value;
};

module.exports = {
  saveControlMessage: async (oscMsg) => {
    const credentials = getAWSCredentialsDependingOnEnvironment();
    const tableName = await getDynamoDBTableName();

    console.log(
      `Saving control message ${JSON.stringify(oscMsg)} to DynamoDB table: ${tableName}`,
    );

    const ddbClient = new DynamoDBClient({
      region: "eu-west-2",
      credentials: credentials,
    });
    const docClient = DynamoDBDocumentClient.from(ddbClient);

    const command = new PutCommand({
      TableName: tableName,
      Item: {
        channelAndGroup: `${oscMsg.args[1][0]}${oscMsg.args[1][1]}`,
        channel: oscMsg.address,
        args: oscMsg.args,
        timestamp: Date.now().toString(),
      },
    });

    const response = await docClient.send(command);
    return response;
  },

  getControlMessages: async () => {
    const credentials = getAWSCredentialsDependingOnEnvironment();
    const tableName = await getDynamoDBTableName();
    const ddbClient = new DynamoDBClient({
      region: "eu-west-2",
      credentials: credentials,
    });
    const docClient = DynamoDBDocumentClient.from(ddbClient);

    console.log(
      `Fetching all control messages from DynamoDB table: ${tableName}`,
    );

    const command = new ScanCommand({
      TableName: tableName,
    });

    const response = await docClient.send(command);
    // Handle cases where Items might be undefined
    return (response.Items || []).map((item) => ({
      address: item.channel,
      args: ["loader", item.args],
    }));
  },
};
