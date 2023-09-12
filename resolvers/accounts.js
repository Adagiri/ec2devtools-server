const { combineResolvers } = require('graphql-resolvers');
const {
  getAccountsForLoggedInUser,
  getAccountById,
  getAllAccounts,
  getAccountRegions,
  addAccount,
  editAccount,
  deleteAccount,
} = require('../controllers/accounts.js');
const { protectAdmin, protectUser } = require('../middleware/auth.js');

module.exports = {
  Query: {
    account: combineResolvers(protectUser, getAccountById),
    accounts: combineResolvers(protectUser, getAccountsForLoggedInUser),
    account_getRegions: combineResolvers(protectUser, getAccountRegions),

    // React Admin
    Account: combineResolvers(protectAdmin, getAccountById),
    allAccounts: combineResolvers(protectAdmin, getAllAccounts),
  },
  Mutation: {
    account_add: combineResolvers(protectUser, addAccount),
    account_edit: combineResolvers(protectUser, editAccount),
    account_delete: combineResolvers(protectUser, deleteAccount),
  },
};
