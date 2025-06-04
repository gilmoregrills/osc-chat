import { Stack, Duration, StackProps } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3"; // s3 not used, but keeping for example if needed later
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as path from "path";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam"; // Role, ServicePrincipal not used
import { readFileSync } from "fs";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs"; // Required for scope parameter

export class OscChatStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
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
    const dockerImageAsset = new DockerImageAsset(this, `DockerImage`, {
      directory: ".", // Points to the project root where Dockerfile is expected
      platform: Platform.LINUX_ARM64,
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
      ttl: Duration.minutes(5), // Optional: set TTL
    });

    const ec2Instance = new ec2.Instance(this, `WebServerInstance`, {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.NANO, // Smallest instance size
      ),
      machineImage: ec2.MachineImage.fromSsmParameter(
        "/aws/service/ecs/optimized-ami/amazon-linux-2/arm64/recommended/image_id", // ECS-optimized ARM64 AMI
      ),
      securityGroup: securityGroup,
      userDataCausesReplacement: true, // Recreate instance if userData changes
      userData: ec2.UserData.custom(
        readFileSync(path.join(__dirname, "assets/userdata.yaml"), "utf-8")
          .replace(/\$\{domain\}/g, aRecord.domainName) // Use g flag for replaceAll
          .replace(/\$\{docker_image\}/g, dockerImageAsset.imageUri), // Use g flag for replaceAll
      ),
    });

    dockerImageAsset.repository.grantPull(ec2Instance); // Grant EC2 instance permission to pull from ECR

    new ec2.CfnEIPAssociation(this, `EipAssoc`, { // No need to assign to a variable if not used
      eip: eip.ref,
      instanceId: ec2Instance.instanceId,
    });

    const configurationMessagesTable = new dynamodb.Table(this, `ConfigurationMessagesTable`, {
      partitionKey: {
        name: "channelAndGroup", // Primary key
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Serverless billing
      removalPolicy: Duration.seconds(0) ? undefined : undefined, // TODO: Consider removal policy for production (e.g., RETAIN)
    });
    configurationMessagesTable.grantReadWriteData(ec2Instance); // Grant instance R/W access to the table

    const tableNameSsmParameter = new ssm.StringParameter(
      this,
      `TableNameSSMParam`,
      {
        parameterName: "/osc-chat/dynamodb-table-name",
        stringValue: configurationMessagesTable.tableName,
        description: "Name of the DynamoDB table for OSC Chat configuration messages",
      },
    );
    tableNameSsmParameter.grantRead(ec2Instance); // Grant instance read access to the SSM parameter
  }
}

// module.exports = { OscChatStack }; // Not needed for ES Modules
