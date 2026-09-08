const express = require('express');
const authRouter = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public
authRouter.post('/register', authController.registerUser);
authRouter.post('/login', authController.loginUser);
authRouter.post('/logout', authController.logout);

// Authenticated
authRouter.get('/me', authenticate, authController.getCurrentUser);
authRouter.patch('/profile', authenticate, authController.updateProfile);
authRouter.patch('/password', authenticate, authController.changePassword);
authRouter.delete('/account', authenticate, authController.deleteAccount);

// Admin check
authRouter.get('/admin', authenticate, requireAdmin, authController.getAdminAccess);

module.exports = authRouter;
