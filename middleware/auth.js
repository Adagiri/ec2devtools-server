const { skip } = require('graphql-resolvers');
const jwt = require('jsonwebtoken');
const { ErrorResponse } = require('../utils/responses');
const User = require('../models/User');
const Admin = require('../models/Admin');

async function getUserInfo(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);

    console.log(payload, 'payload');
    if (payload) {
      return payload;
    }
    return null;
  } catch (error) {
    console.log(error, 'error whilst verifying jwttoken');
  }
}

async function protectUser(_, __, context) {
  const user = await User.findById(context.user?.id)
    .populate('activeAccount')
    .select('username photo activeAccount');

  if (!user) {
    return new ErrorResponse(401, 'Please login to continue');
  }

  context.user = user;
  context.user.id = user._id;

  return skip;
}

async function protectAdmin(_, __, context) {
  const admin = await Admin.findById(context.user?.id).select(
    'username email phone'
  );

  if (!admin) {
    return new ErrorResponse(401, 'Please log in to continue');
  }

  context.user = admin;
  context.user.id = admin._id;

  return skip;
}

function authorize(...roles) {
  return (_, __, context) => {
    if (!roles.includes(context.user.role)) {
      return new ErrorResponse(
        403,
        'You are not authorized to perform this action'
      );
    }

    return skip;
  };
}

module.exports = {
  protectAdmin,
  protectUser,
  authorize,
  getUserInfo,
};
