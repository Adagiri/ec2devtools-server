const mongoose = require('mongoose');

const AwsRoleSchema = new mongoose.Schema({
  arn: {
    type: String,
    required: true,
  },

  name: {
    type: String,
    required: true,
  },

  trustedEntityCount: {
    type: Number,
    default: 0,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('AwsRole', AwsRoleSchema);
