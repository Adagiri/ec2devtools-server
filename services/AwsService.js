const AWS = require('aws-sdk');
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

const awsRegionNamesAndLocations = {
  'us-east-1': 'Virginia',
  'us-east-2': 'Ohio',
  'us-west-1': 'Oregon',
  'us-west-2': 'California',
  'ca-central-1': 'Canada',
  'eu-central-1': 'Frankfurt, Germany',
  'eu-west-1': 'Ireland',
  'eu-west-2': 'London, United Kingdom',
  'eu-west-3': 'Paris, France',
  'eu-north-1': 'Stockholm, Sweden',
  'eu-south-1': 'Milan, Italy',
  'ap-northeast-1': 'Tokyo, Japan',
  'ap-northeast-2': 'Seoul, South Korea',
  'ap-southeast-1': 'Singapore',
  'ap-southeast-2': 'Sydney, Australia',
  'ap-south-1': 'Mumbai, India',
  'sa-east-1': 'São Paulo, Brazil',
  'me-south-1': 'Bahrain',
  'af-south-1': 'Cape Town, South Africa',
  'ap-east-1': 'Hong Kong',
  'ap-southeast-3': 'Jakarta, Indonesia',
  'ap-southeast-5': 'Auckland, New Zealand',
  'eu-south-2': 'Barcelona, Spain',
  'eu-west-4': 'Amsterdam, Netherlands',
  'me-central-1': 'Al Ain, United Arab Emirates',
  'us-gov-east-1': 'Virginia',
  'us-gov-west-1': 'Oregon',
};

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

    const params = {
      AllRegions: true,
    };

    const data = await ec2.describeRegions(params).promise();
    console.log(data, 'data');
    const regions = data.Regions.map((region) => ({
      name: region.RegionName,
      location:
        awsRegionNamesAndLocations[region.RegionName] || region.RegionName,
    }));

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

module.exports = { getRegions, sendEmail, getCredentials };
