#!/usr/bin/env node

const cdk = require("aws-cdk-lib");
const { OscChatStack } = require("../lib/osc-chat-stack");

const app = new cdk.App();
new OscChatStack(app, "OscChatStack", {
  env: {
    account: "553762194992",
    region: "eu-west-2",
  },
});
