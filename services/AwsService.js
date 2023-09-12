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

const getInstanceTypes = async ({ accountId, instanceOption, region }) => {
  try {
    const { accessKeyId, secretAccessKey, sessionToken } = await getCredentials(
      accountId
    );

    const config = new AWS.Config({
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region: region,
    });

    const ec2 = new AWS.EC2(config);

    const instanceTypesWithCost = [];

    const instanceTypeData = await ec2
      .describeInstanceTypes({
        // MaxResults: 500,
        Filters: [{ Name: 'current-generation', Values: ['true'] }],
      })
      .promise();

    console.log(instanceTypeData.InstanceTypes, 'instance type data');

    for (const instanceType of instanceTypeData.InstanceTypes) {
      const instanceTypeInfo = await getInstanceTypeInfo(
        instanceType.InstanceType,
        instanceOption
      );
      instanceTypesWithCost.push({
        type: instanceType.InstanceType,
        monthlyPrice: instanceTypeInfo.monthlyCost,
      });
    }

    console.log(instanceTypesWithCost, 'instance types with cost');

    return instanceTypesWithCost;
  } catch (error) {
    console.log(error, 'Error occured whilst retrieving instance types');
    throw new ErrorResponse(500, 'Internal server error');
  }
};

async function getInstanceTypeInfo(instanceType, instanceOption) {
  try {
    const pricing = new AWS.Pricing({ region: 'us-east-1' }); // Change region as needed

    const pricingParams = {
      ServiceCode: 'AmazonEC2',
      Filters: [
        {
          Type: 'TERM_MATCH',
          Field: 'instanceType',
          Value: instanceType,
        },
      ],
    };

    if (instanceOption === 'Spot') {
      pricingParams.Filters.push({
        Type: 'TERM_MATCH',
        Field: 'preInstalledSw',
        Value: 'NA', // Filter out Spot instances
      });
    }

    const pricingData = await pricing.getProducts(pricingParams).promise();

    // Extract pricing information
    const pricePerHour = parseFloat(
      pricingData.PriceList[0].terms.OnDemand[
        Object.keys(pricingData.PriceList[0].terms.OnDemand)[0]
      ].priceDimensions[
        Object.keys(
          pricingData.PriceList[0].terms.OnDemand[
            Object.keys(pricingData.PriceList[0].terms.OnDemand)[0]
          ].priceDimensions
        )[0]
      ].pricePerUnit.USD
    );

    // Calculate monthly cost
    const monthlyCost = pricePerHour * 24 * 30; // Assuming an average of 30 days per month

    return { monthlyCost };
  } catch (error) {
    console.log(error, 'Error occured whilst retrieving Instance Pricing Info');
    throw new ErrorResponse(500, 'Internal server error');
  }
}

// getInstanceTypes({
//   accountId: '64fd7ee8abe86184e17f2631',
//   instanceOption: 'OnDemand',
//   region: DEFAULT_REGION,
// });

module.exports = { getRegions, getInstanceTypes };
