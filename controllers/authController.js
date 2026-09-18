const User = require('../models/User');

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  favoritesCount: user.favorites?.length || 0,
  createdAt: user.createdAt,
});

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

exports.registerUser = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ message: 'User already exists.' });

    // Public registration can never create an admin account.
    // Use the protected promote-admin script or ADMIN_REGISTRATION_KEY instead.
    let role = 'user';
    if (process.env.ADMIN_REGISTRATION_KEY && req.get('x-admin-registration-key') === process.env.ADMIN_REGISTRATION_KEY) {
      role = 'admin';
    }

    const user = await User.create({ name, email, password, role });
    return res.status(201).json({ message: 'User registered successfully.', user: publicUser(user) });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Server error while registering user.' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password.' });

    res.cookie('userId', user._id.toString(), {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.status(200).json({ message: 'Login successful.', user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error while logging in.' });
  }
};

exports.getCurrentUser = async (req, res) => {
  res.status(200).json({ user: publicUser(req.user) });
};

exports.getAdminAccess = async (req, res) => {
  res.status(200).json({ message: 'Admin access granted.', user: publicUser(req.user) });
};

exports.logout = (req, res) => {
  res.clearCookie('userId', {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.status(200).json({ message: 'Logged out successfully.' });
};

exports.updateProfile = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    if (!name && !email) return res.status(400).json({ message: 'Provide a name or email to update.' });
    if (name && (name.length < 2 || name.length > 80)) return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Please provide a valid email address.' });

    if (email && email !== req.user.email) {
      const exists = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (exists) return res.status(409).json({ message: 'Email is already in use.' });
      req.user.email = email;
    }
    if (name) req.user.name = name;
    await req.user.save();
    res.status(200).json({ message: 'Profile updated.', user: publicUser(req.user) });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error while updating profile.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new passwords are required.' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters long.' });

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ message: 'Current password is incorrect.' });

    user.password = newPassword;
    await user.save();
    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Server error while changing password.' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    if (req.user.role === 'admin') return res.status(400).json({ message: 'Admin accounts cannot be self-deleted through this endpoint.' });
    await User.findByIdAndDelete(req.user._id);
    res.clearCookie('userId');
    res.status(200).json({ message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ message: 'Server error while deleting account.' });
  }
};
