const asyncHandler = require('../middleware/async');
const { ErrorResponse } = require('../utils/responses');
const AwsService = require('../services/AwsService');
const InstanceType = require('../models/InstanceType');

module.exports.getServerTypes = asyncHandler(async (_, args) => {
  const region = args.region;
  const instanceOption = `monthly${args.instanceOption}Price`;

  let select = `${instanceOption}.${region} type`;

  let serverTypes = await InstanceType.find().select(select);

  // Filter
  serverTypes = serverTypes.filter(
    (serverType) =>
      serverType[instanceOption][region] !== 0 &&
      serverType[instanceOption][region] !== null &&
      serverType[instanceOption][region] !== undefined
  );

  // Sort
  serverTypes = serverTypes.sort(
    (a, b) => a[instanceOption][region] - b[instanceOption][region]
  );
  console.log(serverTypes.length, 'after sort');

  // Transform
  serverTypes = serverTypes.map((serverType) => ({
    type: serverType.type,
    monthlyCost: serverType[instanceOption][region],
  }));

  console.log(serverTypes);
  return serverTypes;
});

// console.log(
//   this.getServerTypes('_', { region: 'us-east-1', instanceOption: 'Spot' })
// );
