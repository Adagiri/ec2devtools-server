const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const app = express();

app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy:
     process.env.TEST_ENV === 'false'
        ? true
        : false,
  })
);

app.use(express.json());

app.get('/', (req, res) => {
  res.send(`Deploying`);
});

module.exports = app;
