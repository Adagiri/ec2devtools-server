const { getUserInfo } = require('../middleware/auth');

const contextHandler = async ({ req, res }) => {
  let user = null;
  console.log(req.cookies.token);
  const token = req.cookies.token;
  user = await getUserInfo(token);

  return { user, res, req };
};

module.exports = contextHandler;
