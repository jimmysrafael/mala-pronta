const jwt = require('jsonwebtoken');

function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.userId = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    // Mesmo com erro no token, permitimos seguir como guest
    req.userId = null;
    next();
  }
}

module.exports = optionalAuthMiddleware;
