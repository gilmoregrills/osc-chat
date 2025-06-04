"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OscChatStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const aws_ecr_assets_1 = require("aws-cdk-lib/aws-ecr-assets");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const r53 = __importStar(require("aws-cdk-lib/aws-route53"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
class OscChatStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // const name = "OscChat"; // This constant is not used
        const vpc = new ec2.Vpc(this, `Vpc`, {
            ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
            maxAzs: 1, // Default is all AZs in region, using 1 for cost/simplicity
            subnetConfiguration: [
                {
                    cidrMask: 20, // Creates a /20 subnet (4096 addresses)
                    name: "public",
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                // Add private subnets if needed for other resources
            ],
        });
        // Assuming Dockerfile is in the project root directory (where cdk.json is)
        const dockerImageAsset = new aws_ecr_assets_1.DockerImageAsset(this, `DockerImage`, {
            directory: path.join(__dirname, ".."), // Assumes Dockerfile is in the root of the CDK project
            platform: aws_ecr_assets_1.Platform.LINUX_ARM64,
        });
        const securityGroup = new ec2.SecurityGroup(this, `Sg`, {
            vpc,
            description: "Allows inbound traffic for OSC Chat server",
            allowAllOutbound: true, // Default is true, explicitly stated
        });
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080), "Allow HTTP for app");
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8081), "Allow WebSocket for OSC");
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP for web server");
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow HTTPS for web server");
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(57121), "Allow UDP for OSC");
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "Allow SSH access (consider restricting Peer)");
        const eip = new ec2.CfnEIP(this, `Eip`);
        const hostedZone = r53.HostedZone.fromLookup(this, `Zone`, {
            domainName: "eelgirl.biz",
        });
        const aRecord = new r53.ARecord(this, `ARecord`, {
            zone: hostedZone,
            recordName: "osc-chat.eelgirl.biz", // Subdomain for the app
            target: r53.RecordTarget.fromIpAddresses(eip.ref), // Associate with the EIP
            ttl: aws_cdk_lib_1.Duration.minutes(5), // Optional: set TTL
        });
        const ec2Instance = new ec2.Instance(this, `WebServerInstance`, {
            vpc,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
            machineImage: ec2.MachineImage.fromSsmParameter("/aws/service/ecs/optimized-ami/amazon-linux-2/arm64/recommended/image_id"),
            securityGroup: securityGroup,
            userDataCausesReplacement: true, // Recreate instance if userData changes
            userData: ec2.UserData.custom((0, fs_1.readFileSync)(path.join(__dirname, "assets/userdata.yaml"), "utf-8")
                .replace(/\$\{domain\}/g, aRecord.domainName) // Use g flag for replaceAll
                .replace(/\$\{docker_image\}/g, dockerImageAsset.imageUri)),
        });
        dockerImageAsset.repository.grantPull(ec2Instance); // Grant EC2 instance permission to pull from ECR
        new ec2.CfnEIPAssociation(this, `EipAssoc`, {
            eip: eip.ref,
            instanceId: ec2Instance.instanceId,
        });
        const configurationMessagesTable = new dynamodb.Table(this, `ConfigurationMessagesTable`, {
            partitionKey: {
                name: "channelAndGroup", // Primary key
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Serverless billing
            removalPolicy: aws_cdk_lib_1.Duration.seconds(0) ? undefined : undefined, // TODO: Consider removal policy for production (e.g., RETAIN)
        });
        configurationMessagesTable.grantReadWriteData(ec2Instance); // Grant instance R/W access to the table
        const tableNameSsmParameter = new ssm.StringParameter(this, `TableNameSSMParam`, {
            parameterName: "/osc-chat/dynamodb-table-name",
            stringValue: configurationMessagesTable.tableName,
            description: "Name of the DynamoDB table for OSC Chat configuration messages",
        });
        tableNameSsmParameter.grantRead(ec2Instance); // Grant instance read access to the SSM parameter
    }
}
exports.OscChatStack = OscChatStack;
// module.exports = { OscChatStack }; // Not needed for ES Modules
//# sourceMappingURL=osc-chat-stack.js.map