const { uniqueNamesGenerator, names } = require("unique-names-generator");
const ipInt = require("ip-to-int");

// Import actual providers with specific names
const actualFromSSO = require("@aws-sdk/credential-provider-sso").fromSSO;
const actualFromInstanceMetadata = require("@aws-sdk/credential-providers").fromInstanceMetadata;

module.exports = {
  generateNameFromIp: (ip) => {
    const seed = ipInt(ip).toInt();
    return uniqueNamesGenerator({
      dictionaries: [names],
      seed: seed,
    }).toLowerCase();
  },

  getAWSCredentialsDependingOnEnvironment: (providers = {}) => {
    const {
      fromInstanceMetadataProvider = actualFromInstanceMetadata,
      fromSSOProvider = actualFromSSO
    } = providers;

    if (process.env.NODE_ENV == "production") {
      return fromInstanceMetadataProvider()();
    } else {
      return fromSSOProvider({ profile: "osc-chat" })();
    }
  },
};
