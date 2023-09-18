const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const generateRandomKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

const getKeyBuffer = (key) => {
  const keyLength = 32; // 256 bits for AES-256
  return Buffer.alloc(keyLength, key, 'utf-8');
};

module.exports.generateEmailArguments = (from, to, subject, message) => {
  const mainEmail = process.env.MAIN_EMAIL;
  if (!from) {
    from = `Ec2DevTools <${mainEmail}>`;
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
    ReplyToAddresses: ['no-reply@ec2devtools.com'],
  };
};

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

module.exports.encrypt = (text) => {
  const SECRET_KEY = getKeyBuffer(process.env.CRYPTO_SECRET_KEY);
  const iv = crypto.randomBytes(12); // Initialization Vector (IV) should be 12 bytes for GCM mode.
  const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag(); // Get the authentication tag for integrity checking.

  // Return IV, encrypted text, and authentication tag as a combined string.
  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
};

module.exports.decrypt = (encryptedText) => {
  const SECRET_KEY = getKeyBuffer(process.env.CRYPTO_SECRET_KEY);

  const [ivHex, encryptedHex, tagHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, iv);
  decipher.setAuthTag(tag); // Set the authentication tag for integrity checking.
  let decrypted = decipher.update(encrypted, null, 'utf-8');
  decrypted += decipher.final('utf-8');

  return decrypted;
};
