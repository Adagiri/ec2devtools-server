const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const { getSignedJwtToken } = require('../utils/general');
const { ErrorResponse, SuccessResponse } = require('../utils/responses');

module.exports.getAllUsers = asyncHandler(async (_, args) => {
  const { filter, sort, skip, limit } = getQueryArguments(args);

  let users = await User.find(filter).sort(sort).skip(skip).limit(limit);

  users = users.map((user) => {
    user.id = user._id;
    return user;
  });

  return users;
});

module.exports.getUserById = asyncHandler(async (_, args) => {
  const user = await User.findById(args.userId);

  if (!user) {
    return new ErrorResponse(400, `User with id: ${args.userId} not found`);
  }

  return user;
});

module.exports.getLoggedInUser = asyncHandler(async (_, args, context) => {
  const user = await User.findById(context.user.id).populate('activeAccount');

  return user;
});

module.exports.signup = asyncHandler(async (_, args, context) => {
  const existingUser = await User.findOne({ githubId: args.githubId });

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRY_IN_SECS * 1000
    ),
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'None',
  };

  if (existingUser) {
    const token = getSignedJwtToken(existingUser);
    context.res.cookie('token', token, options);
    return new SuccessResponse(200, true, existingUser);
  } else {
    const user = await User.create(args);
    const token = getSignedJwtToken(user);
    context.res.cookie('token', token, options);
    return new SuccessResponse(201, true, user);
  }
});

module.exports.login = asyncHandler(async (_, args, context) => {
  const existingUser = await User.findOne({ githubId: args.githubId });

  if (!existingUser) {
    return new ErrorResponse(400, 'Unregistered account. Please sign up');
  } else {
    // Update user data with fresh records
    args.email && (existingUser.email = args.email);
    args.email && (existingUser.username = args.username);
    args.email && (existingUser.photoURL = args.photoURL);
    await existingUser.save();

    const options = {
      expires: new Date(
        Date.now() + process.env.JWT_COOKIE_EXPIRY_IN_SECS * 1000
      ),
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'None', // Set SameSite attribute to None
    };

    console.log(options, 'options');
    const token = getSignedJwtToken(existingUser);
    context.res.cookie('token', token, options);
    return new SuccessResponse(200, true, existingUser);
  }
});

module.exports.signout = asyncHandler(async (_, __, context) => {
  // Set the expiration date to a time in the past (e.g., one second ago)
  const pastExpirationDate = new Date(0);

  // Define the options with the past expiration date
  const options = {
    expires: pastExpirationDate,
    httpOnly: true,
    secure: true,
    path: '/',
  };

  // Clear the existing 'token' cookie by setting it to expire in the past
  context.res.cookie('token', '', options);

  return new SuccessResponse(200, true);
});
