const asyncHandler = require('../middleware/async');
const InstanceType = require('../models/InstanceType');
const {
  allocateElasticIp,
  launchEc2Instance,
  associateElasticIpAndSaveRegion,
  getInstanceStatus,
  waitForInstanceStatus,
  getInstancesInAllRegions,
  deleteEc2Instance,
  releaseElastiIp,
  getInstance,
} = require('../services/Instance');
const { getTransformedServerTypes } = require('../utils/general');
const { SuccessResponse } = require('../utils/responses');

module.exports.getServerTypes = asyncHandler(async (_, args) => {
  const region = args.region;
  const instanceOption = `monthly${args.serverOption}Price`;

  let select = `${instanceOption}.${region} type memorySizeInMiB vcpu`;
  let serverTypes = await InstanceType.find().select(select);

  serverTypes = getTransformedServerTypes({
    serverTypes,
    region,
    instanceOption,
  });
  return serverTypes;
});

module.exports.getServer = asyncHandler(async (_, args, context) => {
  const activeAccount = context.user.activeAccount;
  if (!activeAccount) {
    return new ErrorResponse(
      400,
      "You currently don't possess an active AWS account, which is necessary for launching a server."
    );
  }

  const accountId = activeAccount._id;
  const instanceId = args.serverId;
  const region = args.region;

  const server = await getInstance({ accountId, region, instanceId });

  return server;
});

module.exports.getServers = asyncHandler(async (_, args, context) => {
  const activeAccount = context.user.activeAccount;
  if (!activeAccount) {
    return new ErrorResponse(
      400,
      "You currently don't possess an active AWS account, which is necessary for launching a server."
    );
  }

  const accountId = activeAccount._id;
  const regions = activeAccount.activeServerRegions;

  const servers = await getInstancesInAllRegions({ accountId, regions });

  return servers;
});

module.exports.createServer = asyncHandler(async (_, args, context) => {
  const activeAccount = context.user.activeAccount;

  if (!activeAccount) {
    return new ErrorResponse(
      400,
      "You currently don't possess an active AWS account, which is necessary for launching a server."
    );
  }

  const accountId = activeAccount._id;
  const region = args.region;
  const type = args.type;
  const option = args.option;
  const name = args.name;

  let elasticIpAllocationId;

  elsaticIpData = await allocateElasticIp({
    region,
    accountId,
  });

  elasticIpAllocationId = elsaticIpData.AllocationId;
  const publicIp = elsaticIpData.PublicIp;

  const instance = await launchEc2Instance({
    name,
    region,
    type,
    option,
    accountId,
    elasticIpAllocationId,
    publicIp,
  });

  const instanceId = instance.serverId;

  await waitForInstanceStatus({ region, accountId, instanceId });

  await associateElasticIpAndSaveRegion({
    accountId,
    elasticIpAllocationId,
    instanceId,
    region,
  });

  return new SuccessResponse(201, true, instance);
});

module.exports.deleteServer = asyncHandler(async (_, args, context) => {
  const activeAccount = context.user.activeAccount;

  if (!activeAccount) {
    return new ErrorResponse(
      400,
      "You currently don't possess an active AWS account, which is necessary for launching a server."
    );
  }

  const accountId = activeAccount._id;
  const region = args.region;
  const instanceId = args.serverId;
  const elasticIpAllocationId = args.ipAllocationId;

  await deleteEc2Instance({ region, instanceId, accountId });

  await releaseElastiIp({ accountId, elasticIpAllocationId, region });

  return new SuccessResponse(200, true);
});

module.exports.getServerStatus = asyncHandler(async (_, args, context) => {
  const activeAccount = context.user.activeAccount;

  if (!activeAccount) {
    return new ErrorResponse(
      400,
      "You currently don't possess an active AWS account, which is necessary for launching a server."
    );
  }

  const region = args.region;
  const accountId = activeAccount._id;
  const instanceId = args.serverId;
  const state = await getInstanceStatus({ region, accountId, instanceId });

  return state;
});
