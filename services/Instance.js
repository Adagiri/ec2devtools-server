const AWS = require('aws-sdk');

const { extractServerData } = require('../utils/general');
const { getCredentials } = require('./AwsService');
const { ErrorResponse } = require('../utils/responses');
const Account = require('../models/Account');

const generateTagSpecifications = (extraTags) => [
  {
    ResourceType: 'instance',
    Tags: [
      {
        Key: 'controller',
        Value: 'ec2devtools',
      },
      {
        Key: 'driver',
        Value: 'ec2devtools',
      },
      {
        Key: 'node',
        Value: 'ec2devtools',
      },
      ...extraTags,
    ],
  },
];

const deleteEc2Instance = async ({ region, instanceId, accountId }) => {
  const params = {
    InstanceIds: [instanceId],
  };

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

    const data = await ec2.terminateInstances(params).promise();
    console.log('EC2 instance terminated:', data);

    const instance = JSON.stringify(data['TerminatingInstances'][0]);
    return instance;
  } catch (error) {
    console.error('Error terminating EC2 instance:', error);

    throw error;
  }
};

const releaseElastiIp = async ({
  accountId,
  elasticIpAllocationId,
  region,
}) => {
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

    const releaseIpParams = { AllocationId: elasticIpAllocationId };
    await ec2.releaseAddress(releaseIpParams).promise();
    console.log('Elastic IP released');
  } catch (releaseError) {
    console.error('Error releasing Elastic IP:', releaseError);
    // Send email to user
    throw releaseError;
  }
};

const allocateElasticIp = async ({ region, accountId }) => {
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

    const paramsElasticIp = {
      Domain: 'vpc',
    };

    const data = await ec2.allocateAddress(paramsElasticIp).promise();
    console.log('Elastic IP created:', data.AllocationId);
    return data;
  } catch (error) {
    console.error('Error creating Elastic IP:', error);
    throw error;
  }
};

const associateElasticIpAndSaveRegion = async ({
  elasticIpAllocationId,
  instanceId,
  region,
  accountId,
}) => {
  const params = {
    AllocationId: elasticIpAllocationId,
    InstanceId: instanceId,
  };

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
    const data = await ec2.associateAddress(params).promise();
    console.log('Elastic IP associated:', data);

    // Save region
    await Account.findByIdAndUpdate(accountId, {
      $addToSet: { activeServerRegions: region },
    });
    console.log('Region added to the list of active server regions');
    return data; // You can return data or handle it as needed
  } catch (error) {
    console.error('Error associating Elastic IP:', error);
    await releaseElastiIp({ accountId, elasticIpAllocationId, region });
    await deleteEc2Instance({ region, accountId, instanceId });
    throw error; // Rethrow the error to handle it at a higher level
  }
};

const launchEc2Instance = async ({
  name,
  region,
  type,
  option,
  accountId,
  elasticIpAllocationId,
  publicIp,
}) => {
  try {
    const { accessKeyId, secretAccessKey, sessionToken } = await getCredentials(
      accountId
    );
    const imageId = await getImageId({ region, accountId });
    const paramsInstance = {
      ImageId: imageId,
      InstanceType: type,
      MinCount: 1,
      MaxCount: 1,
      TagSpecifications: generateTagSpecifications([
        {
          Key: 'name',
          Value: name,
        },
        {
          Key: 'publicIp',
          Value: publicIp,
        },
        {
          Key: 'region',
          Value: region,
        },

        { Key: 'ipAllocationId', Value: elasticIpAllocationId },
      ]),
    };

    if (option === 'Spot') {
      paramsInstance.TagSpecifications[0].Tags.push({
        Key: 'isSpot',
        Value: 'true',
      });

      paramsInstance.InstanceMarketOptions = {
        MarketType: 'spot',
        SpotOptions: {
          SpotInstanceType: 'one-time',
          InstanceInterruptionBehavior: 'terminate',
        },
      };
    }

    const config = new AWS.Config({
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region: region,
    });

    const ec2 = new AWS.EC2(config);

    const data = await ec2.runInstances(paramsInstance).promise();

    let instance = data['Instances'][0];
    console.log('EC2 instance launched:', instance.InstanceId);

    instance = extractServerData(instance);
    return instance;
  } catch (error) {
    console.error('Error launching EC2 instance:', error);
    await releaseElastiIp({ accountId, elasticIpAllocationId, region });

    throw error;
  }
};

const getInstanceStatus = async ({ region, accountId, instanceId }) => {
  try {
    const params = {
      InstanceIds: [instanceId],
    };

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

    const result = await ec2.describeInstanceStatus(params).promise();

    if (result.InstanceStatuses.length > 0) {
      const instanceStatus = result.InstanceStatuses[0].InstanceStatus;
      const instanceState = result.InstanceStatuses[0].InstanceState;

      return { status: instanceStatus.Status, state: instanceState.Name };
    } else {
      throw new ErrorResponse(400, 'Server not found');
    }
  } catch (error) {
    console.error('Error describing instances:', error);
    throw error;
  }
};

const waitForInstanceStatus = async ({ instanceId, accountId, region }) => {
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

    const params = {
      InstanceIds: [instanceId],
    };

    while (true) {
      const result = await ec2.describeInstanceStatus(params).promise();

      if (result.InstanceStatuses.length > 0) {
        const instanceStatus = result.InstanceStatuses[0].InstanceStatus;

        return instanceStatus.Status;
      }

      // Wait for a few seconds before polling again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } catch (error) {
    console.error('Error describing instances:', error);
    throw error;
  }
};

const getInstance = async ({ accountId, region, instanceId }) => {
  const params = {
    InstanceIds: [instanceId],
  };

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
    const instanceResponse = await ec2.describeInstances(params).promise();
    console.log(JSON.stringify(instanceResponse));

    if (instanceResponse.Reservations.length > 0) {
      let instance = instanceResponse.Reservations[0].Instances[0];
      console.log(JSON.stringify(instance));

      if (instance.State.Name === 'terminated') {
        return new ErrorResponse(
          404,
          `Server with id: ${instanceId} has been deleted`
        );
      } else {
        return extractServerData(instance);
      }
    } else {
      return new ErrorResponse(404, `Server with id: ${instanceId} not found`);
    }

    // return instances;
  } catch (error) {
    console.error('Error fetching instances by tags:', error);
    throw error;
  }
};

const getInstancesInAllRegions = async ({ accountId, regions }) => {
  const tagsToSearch = [
    { Key: 'controller', Value: 'ec2devtools' },
    { Key: 'driver', Value: 'ec2devtools' },
  ];

  const params = {
    Filters: tagsToSearch.map((tag) => ({
      Name: 'tag:' + tag.Key,
      Values: [tag.Value],
    })),
  };

  try {
    const { accessKeyId, secretAccessKey, sessionToken } = await getCredentials(
      accountId
    );

    const config = new AWS.Config({
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region: 'us-east-1',
    });

    const regionNames = regions;

    // Fetch instances from all regions
    const instancePromises = regionNames.map(async (region) => {
      config.update({ region: region });
      const ec2Client = new AWS.EC2(config);

      const instances = await ec2Client.describeInstances(params).promise();
      return instances.Reservations.flatMap(
        (reservation) => reservation.Instances
      );
    });

    const instancesByRegion = await Promise.all(instancePromises);

    // Flatten the array of instances
    let allInstances = instancesByRegion.reduce((acc, instances) => {
      return acc.concat(instances);
    }, []);

    allInstances = allInstances.filter(
      (instance) => instance.State.Name === 'running'
    );
    allInstances = allInstances.map((instance) => extractServerData(instance));
    allInstances = allInstances.sort(
      (a, b) => new Date(b.launchTime) - new Date(a.launchTime)
    );

    return allInstances;
  } catch (error) {
    console.error("Error fetching all regions' instances by tags:", error);
    throw error;
  }
};

const getImageId = async ({ region, accountId }) => {
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

    const params = {
      Owners: ['099720109477'], // Official Account Id for Ubuntu
      Filters: [
        {
          Name: 'architecture',
          Values: ['arm64'],
        },
        { Name: 'state', Values: ['available'] },
        {
          Name: 'name',
          Values: ['ubuntu/images/hvm-ssd/ubuntu-jammy-*'],
        },
      ],
    };

    const response = await ec2.describeImages(params).promise();

    const images = response.Images;
    const latestImage = images.sort(
      (a, b) => new Date(b.CreationDate) - new Date(a.CreationDate)
    )[0];
    console.log(latestImage.ImageId);

    return latestImage.ImageId;
  } catch (error) {
    console.error('Error describing images:', error);
    throw error;
  }
};

module.exports = {
  getInstance,
  allocateElasticIp,
  launchEc2Instance,
  releaseElastiIp,
  associateElasticIpAndSaveRegion,
  deleteEc2Instance,
  getInstanceStatus,
  waitForInstanceStatus,
  getInstancesInAllRegions,
};
