"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getControlMessages = exports.saveControlMessage = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_ssm_1 = require("@aws-sdk/client-ssm");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const utils_1 = require("./utils");
const getDynamoDBTableName = async () => {
    const credentials = (0, utils_1.getAWSCredentialsDependingOnEnvironment)();
    const ssmClient = new client_ssm_1.SSMClient({
        region: "eu-west-2",
        credentials,
    });
    const command = new client_ssm_1.GetParameterCommand({
        Name: "/osc-chat/dynamodb-table-name",
    });
    const response = await ssmClient.send(command);
    if (response.Parameter && response.Parameter.Value) {
        console.log(`Retrieved DynamoDB table name: ${response.Parameter.Value}`);
        return response.Parameter.Value;
    }
    throw new Error("DynamoDB table name not found in SSM Parameter Store.");
};
const saveControlMessage = async (oscMsg) => {
    const credentials = (0, utils_1.getAWSCredentialsDependingOnEnvironment)();
    const tableName = await getDynamoDBTableName();
    console.log(`Saving control message ${JSON.stringify(oscMsg)} to DynamoDB table: ${tableName}`);
    const ddbClient = new client_dynamodb_1.DynamoDBClient({
        region: "eu-west-2",
        credentials,
    });
    const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(ddbClient);
    const itemToSave = {
        channelAndGroup: `${oscMsg.args[1].value[0]}${oscMsg.args[1].value[1]}`, // Assuming args[1] is an object with a value property
        channel: oscMsg.address,
        args: oscMsg.args.map(arg => arg.value), // Extracting value from each arg
        timestamp: Date.now().toString(),
    };
    const command = new lib_dynamodb_1.PutCommand({
        TableName: tableName,
        Item: itemToSave,
    });
    const response = await docClient.send(command);
    return response;
};
exports.saveControlMessage = saveControlMessage;
const getControlMessages = async () => {
    const credentials = (0, utils_1.getAWSCredentialsDependingOnEnvironment)();
    const tableName = await getDynamoDBTableName();
    const ddbClient = new client_dynamodb_1.DynamoDBClient({
        region: "eu-west-2",
        credentials,
    });
    const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(ddbClient);
    console.log(`Fetching all control messages from DynamoDB table: ${tableName}`);
    const command = new lib_dynamodb_1.ScanCommand({
        TableName: tableName,
    });
    const response = await docClient.send(command);
    if (response.Items) {
        return response.Items.map((item) => ({
            address: item.channel,
            args: [{ type: 's', value: 'loader' }, { type: 's', value: item.args }], // Constructing OSCArgs
        }));
    }
    return [];
};
exports.getControlMessages = getControlMessages;
//# sourceMappingURL=ddb.js.map