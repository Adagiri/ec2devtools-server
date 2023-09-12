const asyncHandler = require('../middleware/async');
const { ErrorResponse } = require('../utils/responses');
const AwsService = require('../services/AwsService');

module.exports.getServerTypes = asyncHandler(async (_, args) => {
  const activeAccount = context.user.activeAccount;
  if (!activeAccount) {
    return new ErrorResponse(
      400,
      'To select a region, you must first add an account'
    );
  }

  const accountId = activeAccount._id;

  const serverTypes = await AwsService.getInstanceTypes({
    accountId,
    instanceOption: args.instanceOption,
    region: args.region,
  });

  return serverTypes;
});
