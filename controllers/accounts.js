const asyncHandler = require('../middleware/async');
const Account = require('../models/Account');
const User = require('../models/User');
const { ErrorResponse, SuccessResponse } = require('../utils/responses');
const AwsService = require('../services/AwsService');

module.exports.getAllAccounts = asyncHandler(async (_, args) => {
  const { filter, sort, skip, limit } = getQueryArguments(args);

  let accounts = await Account.find(filter).sort(sort).skip(skip).limit(limit);

  accounts = accounts.map((account) => {
    account.id = account._id;
    return account;
  });

  return accounts;
});

module.exports.getAccountsForLoggedInUser = asyncHandler(
  async (_, args, context) => {
    let accounts = await Account.find({
      user: context.user.id,
    });
    return accounts;
  }
);

module.exports.getAccountRegions = asyncHandler(async (_, args, context) => {
  const activeAccount = context.user.activeAccount;
  if (!activeAccount) {
    return new ErrorResponse(
      400,
      'To select a region, you must first add an account'
    );
  }

  const accountId = activeAccount._id;
  const regions = await AwsService.getRegions(accountId);

  return regions;
});

module.exports.getAccountById = asyncHandler(async (_, args, context) => {
  const account = await Account.findById(args.accountId);

  if (!account) {
    return new ErrorResponse(
      404,
      `Account with id: ${args.accountId} not found`
    );
  }

  if (context.user.accountType !== 'Admin') {
    if (context.user.id !== account.user.toString()) {
      return new ErrorResponse(
        403,
        `You are not authorized to access the account with id ${args.accountId}`
      );
    }
  }

  return account;
});

module.exports.addAccount = asyncHandler(async (_, args, context) => {
  const userId = context.user.id;
  args.user = userId;

  const existingAccount = await Account.findOne({
    roleArn: args.roleArn,
  });

  if (existingAccount) {
    return new ErrorResponse(
      400,
      `The provided role ARN, ${args.roleArn}, already exists. Please create a different role to obtain a new unique role ARN and try again.`
    );
  }
  console.log(args.roleArn);
  const resp = await AwsService.whitelistRole(args.roleArn);

  args.awsRole = resp.awsRole;
  const account = await Account.create(args);

  const user = await User.findById(userId);

  if (!user.activeAccount) {
    user.activeAccount = account._id;
  }

  user.hasCompletedOnboarding = true;

  await user.save();

  return new SuccessResponse(201, true, account);
});

module.exports.editAccount = asyncHandler(async (_, args, context) => {
  const userId = context.user.id;
  const account = await Account.findById(args.accountId);

  if (account.user.toString() !== userId) {
    return new ErrorResponse(
      403,
      `You are not authorized to edit this account`
    );
  }

  account.roleArn = args.roleArn;
  account.title = args.title;
  account.updatedAt = new Date();

  await account.save();

  return new SuccessResponse(200, true, account);
});

module.exports.switchAccount = asyncHandler(async (_, args, context) => {
  const userId = context.user.id;

  const account = await Account.findById(args.accountId);

  if (account.user.toString() !== userId) {
    return new ErrorResponse(403, `You are not authorized for this action`);
  }

  await User.findByIdAndUpdate(userId, { activeAccount: args.accountId });

  return new SuccessResponse(200, true, account);
});

module.exports.deleteAccount = asyncHandler(async (_, args, context) => {
  const user = await User.findById(context.user.id);

  const account = await Account.findById(args.accountId);

  if (account.user.toString() !== user._id.toString()) {
    return new ErrorResponse(
      403,
      `You are not authorized to delete this account`
    );
  }

  await AwsService.blacklistRole({
    awsRoleId: account.awsRole,
    trustedEntity: account.roleArn,
  });

  await account.remove();

  if (user.activeAccount.toString() === args.accountId) {
    const userAccounts = await Account.find({ user: user._id });

    // Set the active-account status for any additional accounts associated with the user
    if (userAccounts.length > 0) {
      user.activeAccount = userAccounts[0]._id;
    } else {
      user.activeAccount = undefined;
    }

    await user.save();
  }

  return new SuccessResponse(200, true, account);
});
