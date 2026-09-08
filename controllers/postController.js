const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');

const validObjectId = (id) => mongoose.isValidObjectId(id);
const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 20);
};

exports.createPost = async (req, res) => {
  try {
    const { title, link } = req.body;
    const tags = normalizeTags(req.body.tag || req.body.tags);
    if (!title || !link) return res.status(400).json({ message: 'Title and link are required.' });

    const normalizedLink = String(link).trim();
    try { new URL(normalizedLink); } catch { return res.status(400).json({ message: 'Please provide a valid post URL.' }); }

    const existing = await Post.findOne({ link: normalizedLink });
    if (existing) return res.status(409).json({ message: 'A post with this link already exists.', post: existing });

    const post = await Post.create({ title: String(title).trim(), link: normalizedLink, author: req.user._id, tag: tags, source: req.body.source ? String(req.body.source).trim() : undefined });
    const populated = await post.populate('author', 'name email role');
    res.status(201).json({ message: 'Post created successfully.', post: populated });
  } catch (error) {
    console.error('Post creation error:', error);
    if (error.code === 11000) return res.status(409).json({ message: 'A post with this link already exists.' });
    res.status(500).json({ message: 'Server error while creating post.' });
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const tag = String(req.query.tag || '').trim().toLowerCase();
    const filter = {};

    if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }, { source: { $regex: search, $options: 'i' } }];
    if (tag) filter.tag = tag;

    const [posts, total] = await Promise.all([
      Post.find(filter).populate('author', 'name email role').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Post.countDocuments(filter),
    ]);

    res.status(200).json({ posts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Fetch posts error:', error);
    res.status(500).json({ message: 'Server error while fetching posts.' });
  }
};

exports.getPostById = async (req, res) => {
  try {
    if (!validObjectId(req.params.postId)) return res.status(400).json({ message: 'Invalid post ID.' });
    const post = await Post.findById(req.params.postId).populate('author', 'name email role');
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    res.status(200).json({ post });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Server error while fetching post.' });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(400).json({ message: 'Invalid post ID.' });
    const update = {};
    if (req.body.title !== undefined) update.title = String(req.body.title).trim();
    if (req.body.link !== undefined) {
      update.link = String(req.body.link).trim();
      try { new URL(update.link); } catch { return res.status(400).json({ message: 'Please provide a valid post URL.' }); }
    }
    if (req.body.tag !== undefined || req.body.tags !== undefined) update.tag = normalizeTags(req.body.tag || req.body.tags);
    if (req.body.source !== undefined) update.source = String(req.body.source).trim();
    if (!Object.keys(update).length) return res.status(400).json({ message: 'No valid fields to update.' });

    const post = await Post.findByIdAndUpdate(postId, update, { new: true, runValidators: true }).populate('author', 'name email role');
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    res.status(200).json({ message: 'Post updated successfully.', post });
  } catch (error) {
    console.error('Update post error:', error);
    if (error.code === 11000) return res.status(409).json({ message: 'A post with this link already exists.' });
    res.status(500).json({ message: 'Server error while updating post.' });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const postId = req.params.postId || req.body.postId;
    if (!validObjectId(postId)) return res.status(400).json({ message: 'Valid post ID is required.' });
    const deletedPost = await Post.findByIdAndDelete(postId);
    if (!deletedPost) return res.status(404).json({ message: 'Post not found.' });
    await User.updateMany({ favorites: deletedPost._id }, { $pull: { favorites: deletedPost._id } });
    res.status(200).json({ message: 'Post deleted successfully.', post: deletedPost });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error while deleting post.' });
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(400).json({ message: 'Invalid post ID.' });
    const postExists = await Post.exists({ _id: postId });
    if (!postExists) return res.status(404).json({ message: 'Post not found.' });

    const user = await User.findById(req.user._id);
    const alreadyFavorite = user.favorites.some((id) => id.toString() === postId);
    if (alreadyFavorite) user.favorites.pull(postId);
    else user.favorites.addToSet(postId);
    await user.save();

    res.status(200).json({ message: alreadyFavorite ? 'Removed from favorites.' : 'Added to favorites.', favorited: !alreadyFavorite });
  } catch (error) {
    console.error('Favorite error:', error);
    res.status(500).json({ message: 'Server error while updating favorite.' });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({ path: 'favorites', populate: { path: 'author', select: 'name email role' } });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.status(200).json({ posts: user.favorites });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ message: 'Server error while fetching favorites.' });
  }
};

exports.recordClick = async (req, res) => {
  try {
    if (!validObjectId(req.params.postId)) return res.status(400).json({ message: 'Invalid post ID.' });
    const post = await Post.findByIdAndUpdate(req.params.postId, { $inc: { clicks: 1 } }, { new: true }).select('_id clicks link');
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    res.status(200).json({ message: 'Click recorded.', clicks: post.clicks, link: post.link });
  } catch (error) {
    console.error('Click tracking error:', error);
    res.status(500).json({ message: 'Server error while recording click.' });
  }
};
