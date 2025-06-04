import {
  DescribeTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import {
  ScanCommand,
  PutCommand,
  DynamoDBDocumentClient,
  PutCommandOutput,
  ScanCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { getAWSCredentialsDependingOnEnvironment } from "./utils";
import { OSCMessage } from "../osc/types"; // Assuming you have a type definition for OSCMessage

interface ControlMessageItem {
  channelAndGroup: string;
  channel: string;
  args: any[];
  timestamp: string;
}

const getDynamoDBTableName = async (): Promise<string> => {
  const credentials = getAWSCredentialsDependingOnEnvironment();
  const ssmClient = new SSMClient({
    region: "eu-west-2",
    credentials,
  });
  const command = new GetParameterCommand({
    Name: "/osc-chat/dynamodb-table-name",
  });
  const response = await ssmClient.send(command);
  if (response.Parameter && response.Parameter.Value) {
    console.log(`Retrieved DynamoDB table name: ${response.Parameter.Value}`);
    return response.Parameter.Value;
  }
  throw new Error("DynamoDB table name not found in SSM Parameter Store.");
};

export const saveControlMessage = async (oscMsg: OSCMessage): Promise<PutCommandOutput> => {
  const credentials = getAWSCredentialsDependingOnEnvironment();
  const tableName = await getDynamoDBTableName();

  console.log(
    `Saving control message ${JSON.stringify(oscMsg)} to DynamoDB table: ${tableName}`,
  );

  const ddbClient = new DynamoDBClient({
    region: "eu-west-2",
    credentials,
  });
  const docClient = DynamoDBDocumentClient.from(ddbClient);

  const itemToSave: ControlMessageItem = {
    channelAndGroup: `${oscMsg.args[1].value[0]}${oscMsg.args[1].value[1]}`, // Assuming args[1] is an object with a value property
    channel: oscMsg.address,
    args: oscMsg.args.map(arg => arg.value), // Extracting value from each arg
    timestamp: Date.now().toString(),
  };

  const command = new PutCommand({
    TableName: tableName,
    Item: itemToSave,
  });

  const response = await docClient.send(command);
  return response;
};

export const getControlMessages = async (): Promise<OSCMessage[]> => {
  const credentials = getAWSCredentialsDependingOnEnvironment();
  const tableName = await getDynamoDBTableName();
  const ddbClient = new DynamoDBClient({
    region: "eu-west-2",
    credentials,
  });
  const docClient = DynamoDBDocumentClient.from(ddbClient);

  console.log(
    `Fetching all control messages from DynamoDB table: ${tableName}`,
  );

  const command = new ScanCommand({
    TableName: tableName,
  });

  const response: ScanCommandOutput = await docClient.send(command);
  if (response.Items) {
    return response.Items.map((item: any) => ({ // Consider defining a stricter type for item
      address: item.channel,
      args: [{ type: 's', value: 'loader' }, { type: 's', value: item.args }], // Constructing OSCArgs
    }));
  }
  return [];
};
