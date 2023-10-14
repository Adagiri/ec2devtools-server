const { combineResolvers } = require('graphql-resolvers');
const {
  getLoggedInUser,
  getUserById,
  getAllUsers,
  signup,
  login,
  signout,
} = require('../controllers/users.js');
const { protectUser, protectAdmin } = require('../middleware/auth');

module.exports = {
  Query: {
    user: combineResolvers(protectUser, getLoggedInUser),
    // React Admin
    User: combineResolvers(protectAdmin, getUserById),
    allUsers: combineResolvers(protectAdmin, getAllUsers),
  },
  Mutation: {
    signup: signup,
    login: login,
    signout: combineResolvers(protectUser, signout),
  },
};
