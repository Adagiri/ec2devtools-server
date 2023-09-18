const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const InstanceType = require('./services/InstanceType');
const { generateEmailArguments } = require('./utils/general');
const { sendEmail } = require('./services/AwsService');

const app = express();

app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: process.env.TEST_ENV === 'false' ? true : false,
  })
);

app.use(express.json());

app.get('/', (req, res) => {
  res.send(`Deploying`);
});

app.post('/api/update-instance-types', async (req, res) => {
  try {
    await InstanceType.updateInstanceTypes();
    return res.sendStatus(200);
  } catch (error) {
    console.log(error, 'error occured whilst updating instance types');

    return res.sendStatus(500).send(error);
  }
});

module.exports = app;
