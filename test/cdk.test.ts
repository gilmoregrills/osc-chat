import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { OscChatStack } from '../lib/osc-chat-stack'; // Adjusted import

// Example test for the OscChatStack
test('DynamoDB Table Created with Correct Partition Key', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new OscChatStack(app, 'MyTestStack', {
    env: { account: '123456789012', region: 'us-east-1' }
  });
  // THEN
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      {
        AttributeName: 'channelAndGroup',
        KeyType: 'HASH',
      }
    ],
    AttributeDefinitions: [
      {
        AttributeName: 'channelAndGroup',
        AttributeType: 'S',
      }
    ],
    BillingMode: 'PAY_PER_REQUEST' // Also checking for PAY_PER_REQUEST billing mode
  });
});

// It's good practice to have more than one test.
// Let's add another test to check for an EC2 instance.
test('EC2 Instance Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new OscChatStack(app, 'MyTestStack', {
    env: { account: '123456789012', region: 'us-east-1' }
  });
  // THEN
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::EC2::Instance', 1);
});
