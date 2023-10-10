const { combineResolvers } = require('graphql-resolvers');
const {
  getServer,
  getServers,
  getServerTypes,
  createServer,
  getServerStatus,
  deleteServer,
} = require('../controllers/servers.js');
const { protectUser } = require('../middleware/auth.js');

module.exports = {
  Query: {
    server: combineResolvers(protectUser, getServer),
    servers: combineResolvers(protectUser, getServers),
    server_types: combineResolvers(protectUser, getServerTypes),
    server_getStatus: combineResolvers(protectUser, getServerStatus),
  },
  Mutation: {
    server_create: combineResolvers(protectUser, createServer),
    server_delete: combineResolvers(protectUser, deleteServer),
  },
};
