const AWS = require('aws-sdk');

const InstanceType = require('../models/InstanceType');
const { generateEmailArguments } = require('../utils/general');
const { sendEmail } = require('./AwsService');

const DEFAULT_REGION = 'us-east-1';

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY,
};

AWS.config.update({ credentials: credentials });

const ec2 = new AWS.EC2({
  region: DEFAULT_REGION,
  credentials: credentials,
});

const sendStartEmail = async () => {
  const params = generateEmailArguments(
    null,
    'ibrahimridwan47@gmail.com',
    'Instance Price Update Process started',
    `Instance Price Update Process Started at: ${new Date()}`
  );

  await sendEmail(params);
};

const sendSuccessEmail = async ({
  priceUpdateStartTime,
  priceUpdateEndTime,
}) => {
  const params = generateEmailArguments(
    null,
    'ibrahimridwan47@gmail.com',
    'Instance Price Update Completed',
    `Instance Price Update completed successfully. Started at: ${priceUpdateStartTime} and ended at: ${priceUpdateEndTime}`
  );

  await sendEmail(params);
};

const sendFailureEmail = async (error) => {
  const params = generateEmailArguments(
    null,
    'ibrahimridwan47@gmail.com',
    'Instance Types Update Failed',
    JSON.stringify(error)
  );

  await sendEmail(params);
};

const fetchAverageSpotPrice = async ({ instanceType, region }) => {
  const ec2 = new AWS.EC2({
    region: region,
    credentials: credentials,
  });

  try {
    const params = {
      InstanceTypes: [instanceType],
      ProductDescriptions: ['Linux/UNIX'], // Adjust for your OS
    };

    const spotPrices = await ec2.describeSpotPriceHistory(params).promise();

    let totalSpotPrice = 0;
    let count = 0;

    for (const spotPrice of spotPrices.SpotPriceHistory) {
      totalSpotPrice += parseFloat(spotPrice.SpotPrice);
      count++;
    }

    const averageSpotPrice = count > 0 ? totalSpotPrice / count : null;

    return averageSpotPrice;
  } catch (error) {
    console.error('Error fetching spot prices:', error);
    throw error;
  }
};

const fetchOnDemandPriceAllRegions = async ({ instanceType }) => {
  const pricing = new AWS.Pricing({
    region: DEFAULT_REGION,
    credentials: credentials,
  });
  try {
    const params = {
      ServiceCode: 'AmazonEC2',
      Filters: [
        { Type: 'TERM_MATCH', Field: 'instanceType', Value: instanceType },
        { Type: 'TERM_MATCH', Field: 'tenancy', Value: 'shared' },
        { Type: 'TERM_MATCH', Field: 'operatingSystem', Value: 'Linux' }, // Adjust for your OS
        { Type: 'TERM_MATCH', Field: 'preInstalledSw', Value: 'NA' },
      ],
    };

    const data = await pricing.getProducts(params).promise();

    if (data.PriceList.length > 0) {
      const prices = data.PriceList.reduce((acc, item) => {
        const product = item;
        const code = product.product.attributes.regionCode;

        const terms = product.terms.OnDemand;
        const priceDimensions = terms[Object.keys(terms)[0]].priceDimensions;
        const onDemandPrice =
          priceDimensions[Object.keys(priceDimensions)[0]].pricePerUnit.USD;
        if (onDemandPrice) {
          acc[code] = onDemandPrice;
        }
        return acc;
      }, {});

      return prices;
    } else {
      console.log(`No on-demand prices found for ${instanceType}.`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching on-demand prices:', error);
    throw error;
  }
};

const getAllAwsRegions = async () => {
  try {
    const data = await ec2.describeRegions().promise();
    const regions = data.Regions.map((region) => region.RegionName);

    // console.log('Aws regions retrieved successfully; total: ', regions.length);
    return regions;
  } catch (error) {
    console.error('Error occured whilst retrieving regions: ', error);
    throw error;
  }
};

const updateInstanceTypePrices = async () => {
  try {
    await sendStartEmail();
    const priceUpdateStartTime = new Date();
    const awsRegions = await getAllAwsRegions();

    const today = new Date();
    const todayString = today.toLocaleDateString();
    const instanceTypes = await InstanceType.find({
      updatedAt: { $ne: todayString },
    }).select('type updatedAt');

    let count = 0;
    // Fetch prices for each instance type and update in the database
    for (const instanceType of instanceTypes) {
      let updates = { updatedAt: todayString };

      const onDemandPrice = await fetchOnDemandPriceAllRegions({
        instanceType: instanceType.type,
      });
      for (const index in onDemandPrice) {
        const region = `monthlyOnDemandPrice.${index}`;
        const price = onDemandPrice[index] * 30 * 24;
        updates[region] = price;
      }

      for (const region of awsRegions) {
        const spotPrice = await fetchAverageSpotPrice({
          region,
          instanceType: instanceType.type,
        });

        spotPrice &&
          (updates[`monthlySpotPrice.${region}`] = spotPrice * 30 * 24);
      }

      // Update the instance type price in the database
      // console.log(instanceType.type, updates);
      await InstanceType.findByIdAndUpdate(instanceType._id, updates);
      updates = {};
      count++;
      console.log(count, 'count');
    }

    console.log('Instance type prices updated successfully.');
    const priceUpdateEndTime = new Date();
    await sendSuccessEmail({ priceUpdateStartTime, priceUpdateEndTime });
  } catch (error) {
    console.error('Error updating instance type prices:', error);
    throw error;
  }
};

const updateInstanceTypesInDB = async (instanceTypes) => {
  const operations = instanceTypes.map((instanceType) => ({
    updateOne: {
      filter: { type: instanceType.type },
      update: { $set: instanceType },
      upsert: true,
    },
  }));

  try {
    await InstanceType.bulkWrite(operations);
  } catch (error) {
    throw error;
  }
};

const fetchAndUpdateInstanceTypes = async () => {
  let allInstanceTypes = [];

  let nextToken;
  do {
    try {
      const params = {
        NextToken: nextToken,
      };

      const instanceTypeData = await ec2
        .describeInstanceTypes(params)
        .promise();

      console.log('Instance types fetched successfully.');

      console.log(instanceTypeData.InstanceTypes);
      const instanceTypes = instanceTypeData.InstanceTypes.map(
        (instanceType) => ({
          type: instanceType.InstanceType,
          currentGeneration: instanceType.CurrentGeneration,
          freeTierEligible: instanceType.FreeTierEligible,
          supportedUsageClass: instanceType.SupportedUsageClass,
          memorySizeInMiB: instanceType.MemoryInfo.SizeInMiB,
          vcpu: instanceType.VCpuInfo.DefaultVCpus,
        })
      );

      allInstanceTypes = allInstanceTypes.concat(instanceTypes);
      nextToken = instanceTypeData.NextToken;
    } catch (error) {
      console.error('Error fetching instance types:', error);
      throw error;
    }
  } while (nextToken);
  try {
    await updateInstanceTypesInDB(allInstanceTypes);
    console.log('Instance types updated successfully');
  } catch (error) {
    console.error('Error updating instance types:', error);
    throw error;
  }
};

const updateInstanceTypes = async () => {
  try {
    await fetchAndUpdateInstanceTypes();
    await updateInstanceTypePrices();
  } catch (error) {
    console.log('Error occured whilst updating instance types: ', error);

    await sendFailureEmail(error);
    throw error;
  }
};

module.exports = { updateInstanceTypes, getAllAwsRegions };
