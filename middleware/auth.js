const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const userId = req.signedCookies?.userId;
    if (!userId) return res.status(401).json({ message: 'Authentication required.' });
    const user = await User.findById(userId);
    if (!user) {
      res.clearCookie('userId');
      return res.status(401).json({ message: 'Session is invalid or expired.' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Authentication failed.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' });
  next();
};

module.exports = { authenticate, requireAdmin };
