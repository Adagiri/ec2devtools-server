const { ErrorResponse } = require('../utils/responses');

const errorHandler = (err) => {
  console.log(err);
  return err;
};

module.exports = errorHandler;
