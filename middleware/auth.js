const jwt = require('jsonwebtoken');

const SECRET = 'itkan-secret-key-2024';

function authenticate(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/giris');
  try {
    req.user = jwt.verify(token, SECRET);
    res.locals.currentUser = req.user;
    next();
  } catch {
    res.clearCookie('token');
    res.redirect('/giris');
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/giris');
    if (!roles.includes(req.user.role)) {
      return res.status(403).send('Yetkiniz yok');
    }
    next();
  };
}

function optionalAuth(req, res, next) {
  const token = req.cookies.token;
  if (token) {
    try {
      req.user = jwt.verify(token, SECRET);
      res.locals.currentUser = req.user;
    } catch {
      req.user = null;
      res.locals.currentUser = null;
    }
  }
  next();
}

module.exports = { authenticate, requireRole, optionalAuth, SECRET };
