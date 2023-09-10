const AWS = require('aws-sdk');

// Configuration for the role in Account B
const assumeRoleParams = {
  RoleArn: 'arn:aws:iam::ACCOUNT-B-ID:role/ROLE-NAME-IN-ACCOUNT-B',
  RoleSessionName: 'SessionName', // Replace with a unique session name
};

// Create an STS client using the instance's IAM role
const sts = new AWS.STS();

// Assume the role in Account B to get temporary credentials
sts.assumeRole(assumeRoleParams, (err, data) => {
  if (err) {
    console.error('Error assuming role:', err);
    return;
  }

  const { AccessKeyId, SecretAccessKey, SessionToken } = data.Credentials;

  // Configuration with temporary credentials
  const awsConfigB = new AWS.Config({
    accessKeyId: AccessKeyId,
    secretAccessKey: SecretAccessKey,
    sessionToken: SessionToken,
    region: 'us-east-1', // Replace with the desired region in Account B
  });

  // Create an EC2 client for Account B using temporary credentials
  const ec2 = new AWS.EC2(awsConfigB);

  // Specify EC2 instance launch parameters for Account B
  const instanceParams = {
    ImageId: 'AMI_ID', // Replace with the desired AMI ID in Account B
    InstanceType: 't2.micro', // Replace with the desired instance type
    MinCount: 1,
    MaxCount: 1,
    KeyName: 'YOUR_KEY_PAIR_NAME', // Replace with your key pair name
  };

  // Launch the EC2 instance in Account B
  ec2.runInstances(instanceParams, (err, data) => {
    if (err) {
      console.error('Error launching EC2 instance in Account B:', err);
    } else {
      console.log(
        'EC2 instance launched successfully in Account B:',
        data.Instances[0].InstanceId
      );
    }
  });
});
