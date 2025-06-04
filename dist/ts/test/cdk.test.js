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
const cdk = __importStar(require("aws-cdk-lib"));
const assertions_1 = require("aws-cdk-lib/assertions");
const osc_chat_stack_1 = require("../lib/osc-chat-stack"); // Adjusted import
// Example test for the OscChatStack
test('DynamoDB Table Created with Correct Partition Key', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new osc_chat_stack_1.OscChatStack(app, 'MyTestStack');
    // THEN
    const template = assertions_1.Template.fromStack(stack);
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
    const stack = new osc_chat_stack_1.OscChatStack(app, 'MyTestStack');
    // THEN
    const template = assertions_1.Template.fromStack(stack);
    template.resourceCountIs('AWS::EC2::Instance', 1);
});
//# sourceMappingURL=cdk.test.js.map