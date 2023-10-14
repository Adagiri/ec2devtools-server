const mongoose = require('mongoose');

const TemporaryCredentialSchema = new mongoose.Schema({
  account: { type: mongoose.Types.ObjectId, required: true, ref: 'Account' },
  accessKeyId: { type: String, required: true },
  secretAccessKey: { type: String, required: true },
  sessionToken: { type: String, required: true },

  expirationTime: {
    type: Date,
    required: true,
    expires: '1m',
  },
});

module.exports = mongoose.model(
  'TemporaryCredential',
  TemporaryCredentialSchema
);
