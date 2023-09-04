const { ses } = require('../services/AwsService');

const mainEmail = process.env.MAIN_EMAIL;

const generateEmailArguments = (from, to, subject, message) => {
  if (!from) {
    from = `Propatize <${mainEmail}>`;
  }

  return {
    Destination: {
      ToAddresses: typeof to === 'string' ? [to] : to,
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: message,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
    },
    Source: from,
    ReplyToAddresses: ['no-reply@propatize.com'],
  };
};

const sendEmail = (params) => {
  return ses.sendEmail(params).promise();
};

module.exports = {
  sendEmail,
  generateEmailArguments,
};
