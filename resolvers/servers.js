const { combineResolvers } = require('graphql-resolvers');
const { getServerTypes } = require('../controllers/servers.js');
const { protectUser } = require('../middleware/auth.js');

module.exports = {
  Query: {
    server_types: combineResolvers(protectUser, getServerTypes),
  },
  Mutation: {},
};
