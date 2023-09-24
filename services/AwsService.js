const AWS = require('aws-sdk');
const crypto = require('crypto');
const Account = require('../models/Account');
const TemporaryCredential = require('../models/TemporaryCredential');
const { generateRandomString, decrypt, encrypt } = require('../utils/general');
const { ErrorResponse } = require('../utils/responses');

const DEFAULT_REGION = 'us-east-1';
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY,
};
AWS.config.update({ credentials: credentials });

const handleCredentialsEncrypt = (credentials) => {
  const cred = { ...credentials };
  const toEncrypt = ['accessKeyId', 'secretAccessKey', 'sessionToken'];

  for (const element of toEncrypt) {
    const data = cred[element];
    cred[element] = encrypt(data);
  }
  return cred;
};

const handleCredentialsDecrypt = (credentials) => {
  const cred = credentials;
  const toDecrypt = ['accessKeyId', 'secretAccessKey', 'sessionToken'];

  for (const element of toDecrypt) {
    const data = cred[element];
    cred[element] = decrypt(data);
  }

  return cred;
};

const getCredentials = async (accountId) => {
  try {
    const now = new Date();
    const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000);

    let existingCredentials = await TemporaryCredential.findOne({
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

      const credentials = {
        accessKeyId: AccessKeyId,
        secretAccessKey: SecretAccessKey,
        sessionToken: SessionToken,
        expirationTime: Expiration,
      };

      const encryptedCredentials = handleCredentialsEncrypt(credentials);

      // Create or update to a new credential
      await TemporaryCredential.findOneAndUpdate(
        { account: accountId },
        encryptedCredentials,
        { upsert: true }
      );

      return credentials;
    }

    const decryptedCredentials = handleCredentialsDecrypt(existingCredentials);
    return decryptedCredentials;
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

    console.log(regions, 'regions');
    return regions;
  } catch (error) {
    console.log(error, 'Error occured whilst retrieving regions');
    console.log(error.code);
    throw error;
  }
};

const getInstanceTypes = async ({ accountId, instanceOption, region }) => {
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

    console.log(regions, 'regions');
    return regions;
  } catch (error) {
    console.log(error, 'Error occured whilst retrieving regions');
    console.log(error.code);
    throw error;
  }
};
const sendEmail = async (params) => {
  try {
    const ses = new AWS.SES({
      credentials: credentials,
      region: DEFAULT_REGION,
    });

    await ses.sendEmail(params).promise();
  } catch (error) {
    console.log('Error occured whilst sending email through SES', error);
  }
};

module.exports = { getRegions, sendEmail };
