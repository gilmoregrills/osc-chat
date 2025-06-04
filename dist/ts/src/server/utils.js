"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAWSCredentialsDependingOnEnvironment = exports.generateNameFromIp = void 0;
const unique_names_generator_1 = require("unique-names-generator");
const ip_to_int_1 = __importDefault(require("ip-to-int"));
const credential_provider_sso_1 = require("@aws-sdk/credential-provider-sso");
const credential_providers_1 = require("@aws-sdk/credential-providers");
const generateNameFromIp = (ip) => {
    const seed = (0, ip_to_int_1.default)(ip).toInt();
    const config = {
        dictionaries: [unique_names_generator_1.names],
        seed: seed,
    };
    return (0, unique_names_generator_1.uniqueNamesGenerator)(config).toLowerCase();
};
exports.generateNameFromIp = generateNameFromIp;
const getAWSCredentialsDependingOnEnvironment = () => {
    if (process.env.NODE_ENV === "production") {
        return (0, credential_providers_1.fromInstanceMetadata)();
    }
    else {
        // The return type of fromSSO is () => Promise<AWSCredentials> which is compatible with AwsCredentialIdentityProvider
        return (0, credential_provider_sso_1.fromSSO)({ profile: "osc-chat" });
    }
};
exports.getAWSCredentialsDependingOnEnvironment = getAWSCredentialsDependingOnEnvironment;
//# sourceMappingURL=utils.js.map