const mongoose = require('mongoose');

const GeneralSchema = new mongoose.Schema({
  ec2BaseImageId: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('General', GeneralSchema);
