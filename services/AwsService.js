const AWS = require('aws-sdk');

const Account = require('../models/Account');
const TemporaryCredential = require('../models/TemporaryCredential');
const { generateRandomString } = require('../utils/general');
const { ErrorResponse } = require('../utils/responses');

const DEFAULT_REGION = 'us-east-1';
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY,
};
AWS.config.update({ credentials: credentials });

const getCredentials = async (accountId) => {
  try {
    const now = new Date();
    const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000);

    const existingCredentials = await TemporaryCredential.findOne({
      account: accountId,
      expirationTime: { $gt: tenMinutesLater },
    });

    if (!existingCredentials) {
      const account = await Account.findById(accountId);

      // Generate temporary credentials using the Account's IAM Role
      const assumeRoleParams = {
        RoleArn: account.roleArn,
        RoleSessionName: generateRandomString(5),
      };

      const sts = new AWS.STS();
      const data = await sts.assumeRole(assumeRoleParams).promise();
      const { AccessKeyId, SecretAccessKey, SessionToken, Expiration } =
        data.Credentials;

      console.log(data, 'temporary credentials data');

      const credentials = {
        accessKeyId: AccessKeyId,
        secretAccessKey: SecretAccessKey,
        sessionToken: SessionToken,
        expirationTime: Expiration,
      };

      // Create or update to a new credential
      const updatedCredentials = await TemporaryCredential.findOneAndUpdate(
        { account: accountId },
        credentials,
        { upsert: true }
      );
      console.log(updatedCredentials, 'updatedCredentials');
      return updatedCredentials;
    }

    return existingCredentials;
  } catch (error) {
    console.log(error, 'Error occured whilst retrieving credentials');

    if (error.code === 'AccessDenied') {
      throw new ErrorResponse(
        500,
        'We are unable to engage with the currently active account'
      );
    }
    throw error;
  }
};

const getRegions = async (accountId) => {
  try {
    const { accessKeyId, secretAccessKey, sessionToken } = await getCredentials(
      accountId
    );

    const config = new AWS.Config({
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region: DEFAULT_REGION,
    });

    const ec2 = new AWS.EC2(config);

    const data = await ec2.describeRegions().promise();
    const regions = data.Regions.filter(
      (region) =>
        region.IsDefault || region.OptInStatus === 'opt-in-not-required'
    ).map((region) => region.RegionName);

    return regions;
  } catch (error) {
    console.log(error, 'Error occured whilst retrieving regions');
    console.log(error.code);
    throw error;
  }
};

module.exports = { getRegions };
