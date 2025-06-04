import { uniqueNamesGenerator, names, Config } from "unique-names-generator";
import ipInt from "ip-to-int";
import { fromSSO } from "@aws-sdk/credential-provider-sso";
import { fromInstanceMetadata } from "@aws-sdk/credential-providers";
import { AwsCredentialIdentityProvider } from "@aws-sdk/types";

export const generateNameFromIp = (ip: string): string => {
  const seed: number = ipInt(ip).toInt();
  const config: Config = {
    dictionaries: [names],
    seed: seed,
  };
  return uniqueNamesGenerator(config).toLowerCase();
};

export const getAWSCredentialsDependingOnEnvironment = (): AwsCredentialIdentityProvider => {
  if (process.env.NODE_ENV === "production") {
    return fromInstanceMetadata();
  } else {
    // The return type of fromSSO is () => Promise<AWSCredentials> which is compatible with AwsCredentialIdentityProvider
    return fromSSO({ profile: "osc-chat" });
  }
};
