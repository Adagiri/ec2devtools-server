const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  accountType: {
    type: String,
    default: 'Admin',
  },

  username: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    lowercase: true,
    validate: {
      validator: function (value) {
        // Regular expression for basic email validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(value);
      },
      message: 'Invalid email format',
    },
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Admin', AdminSchema);
