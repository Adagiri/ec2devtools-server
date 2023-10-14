const mongoose = require('mongoose');

const regions = {
  'af-south-1': Number,
  'ap-southeast-3': Number,
  'cn-north-1': Number,
  'ap-south-1': Number,
  'ap-east-1': Number,
  'ap-northeast-3': Number,
  'ap-northeast-2': Number,
  'ca-central-1': Number,
  'ca-east-1': Number,
  'ca-west-1': Number,
  'eu-west-1': Number,
  'eu-west-2': Number,
  'eu-central-1': Number,
  'eu-south-1': Number,
  'eu-west-3': Number,
  'eu-north-1': Number,
  'me-south-1': Number,
  'me-central-1': Number,
  'sa-east-1': Number,
  'us-east-1': Number,
  'us-east-2': Number,
  'us-west-1': Number,
  'us-west-2': Number,
  'us-gov-east-1': Number,
  'us-gov-west-1': Number,
  'cn-northwest-1': Number,
};

const InstanceTypeSchema = new mongoose.Schema({
  type: String,
  currentGeneration: Boolean,
  freeTierEligible: Boolean,
  supportedUsageClass: [String],
  memorySizeInMiB: Number,
  vcpu: Number,
  monthlySpotPrice: { type: Object, default: {} },
  monthlyOnDemandPrice: { type: Object, default: {} },
  updatedAt: String,
});

module.exports = mongoose.model('InstanceType', InstanceTypeSchema);
