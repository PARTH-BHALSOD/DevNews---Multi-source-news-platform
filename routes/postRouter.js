const express = require('express');
const postRouter = express.Router();
const postController = require('../controllers/postController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Authenticated post discovery
postRouter.get('/getPosts', authenticate, postController.getAllPosts);
postRouter.get('/favorites', authenticate, postController.getFavorites);
postRouter.get('/:postId', authenticate, postController.getPostById);
postRouter.post('/:postId/click', authenticate, postController.recordClick);

// Authenticated user actions
postRouter.post('/favorites/:postId', authenticate, postController.toggleFavorite);

// Admin post management
postRouter.post('/create', authenticate, requireAdmin, postController.createPost);
postRouter.patch('/:postId', authenticate, requireAdmin, postController.updatePost);
postRouter.delete('/delete', authenticate, requireAdmin, postController.deletePost);
postRouter.delete('/:postId', authenticate, requireAdmin, postController.deletePost);

module.exports = postRouter;
