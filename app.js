const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const app = express();

let allowedOrigins = ['https://app.propatize.com'];
if (process.env.TEST_ENV === 'true') {
  allowedOrigins.push(
    'http://localhost:3000',
    'https://studio.apollographql.com',
    'https://ab12-102-89-32-34.ngrok-free.app'
  );
}

app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production' && process.env.TEST_ENV === 'false'
        ? true
        : false,
  })
);

app.use(express.json());

app.get('/', (req, res) => {
  res.send(`Deploying`);
});

module.exports = app;
