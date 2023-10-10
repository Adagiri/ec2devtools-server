const { getUserInfo } = require('../middleware/auth');

const contextHandler = async ({ req, res }) => {
  let user = null;
  const token = req.cookies.token;
  user = await getUserInfo(token);

  // Set the desired headers

  // if (process.env.TEST_ENV === 'true') {
  //   res.setHeader(
  //     'Access-Control-Allow-Origin',
  //     'https://studio.apollographql.com'
  //   );
  //   res.setHeader('Access-Control-Allow-Credentials', 'true');
  // }

  return { user, res, req };
};

module.exports = contextHandler;
