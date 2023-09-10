const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

module.exports.generateRandomString = (n) => {
  const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomString = '';

  for (let i = 0; i < n; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  return randomString;
};

module.exports.getQueryArguments = (args) => {
  const filter = args.filter || {};
  // Transform the query if the property 'id' was added
  if (filter.id) {
    filter._id = mongoose.Types.ObjectId(filter.id);

    delete filter.id;
  }
  // Transform the query if the property 'ids' was added
  if (filter.ids) {
    filter._id = { $in: filter.ids.map((id) => mongoose.Types.ObjectId(id)) };
    delete filter.ids;
  }

  // Make sure deleted documents are not selected
  filter.deleted = { $ne: true };

  // Set pagination fields
  const page = parseInt(args.page, 10) || 0;
  const limit = parseInt(args.perPage, 10) || 10;
  const skip = page * limit;

  // Transform sort field
  const sort = {};
  if (args.sortField) {
    sort[args.sortField] = args.sortOrder === 'ASC' ? 1 : -1;
  } else {
    sort.createdAt = -1;
  }

  return { filter, skip, limit, sort };
};

module.exports.getSignedJwtToken = function (user) {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      accountType: user.accountType,
    },
    process.env.JWT_SECRET_KEY,
    {
      expiresIn:
        String(process.env.JWT_COOKIE_EXPIRY_IN_SECS / (60 * 60)) + 'h',
    }
  );
};

module.exports.getEncryptedToken = (token) => {
  const encryptedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  return encryptedToken;
};
