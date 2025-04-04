const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Comment = require('../models/Comment');
const Recipe = require('../models/Recipe');
const User = require('../models/User');

// @route   POST api/comments/:recipeId
// @desc    Add a comment to a recipe
// @access  Private
router.post(
  '/:recipeId',
  [auth, [check('text', 'Text is required').not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const user = await User.findById(req.user.id).select('-password');
      const recipe = await Recipe.findById(req.params.recipeId);

      if (!recipe) {
        return res.status(404).json({ msg: 'Recipe not found' });
      }

      const newComment = new Comment({
        text: req.body.text,
        name: user.name,
        avatar: user.avatar,
        user: req.user.id,
        recipe: req.params.recipeId
      });

      const comment = await newComment.save();

      res.json(comment);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   GET api/comments/:recipeId
// @desc    Get all comments for a recipe
// @access  Public
router.get('/:recipeId', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.recipeId);

    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    const comments = await Comment.find({ recipe: req.params.recipeId })
      .sort({ date: -1 })
      .populate('user', ['name', 'avatar']);

    res.json(comments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/comments/:recipeId/:commentId
// @desc    Get a comment by ID
// @access  Public
router.get('/:recipeId/:commentId', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId).populate(
      'user',
      ['name', 'avatar']
    );

    if (!comment) {
      return res.status(404).json({ msg: 'Comment not found' });
    }

    // Check if comment belongs to the recipe
    if (comment.recipe.toString() !== req.params.recipeId) {
      return res.status(400).json({ msg: 'Comment does not belong to this recipe' });
    }

    res.json(comment);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Comment not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/comments/:recipeId/:commentId
// @desc    Update a comment
// @access  Private
router.put(
  '/:recipeId/:commentId',
  [auth, [check('text', 'Text is required').not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const comment = await Comment.findById(req.params.commentId);

      if (!comment) {
        return res.status(404).json({ msg: 'Comment not found' });
      }

      // Check if comment belongs to the recipe
      if (comment.recipe.toString() !== req.params.recipeId) {
        return res.status(400).json({ msg: 'Comment does not belong to this recipe' });
      }

      // Check user
      if (comment.user.toString() !== req.user.id) {
        return res.status(401).json({ msg: 'User not authorized' });
      }

      comment.text = req.body.text;
      await comment.save();

      res.json(comment);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   DELETE api/comments/:recipeId/:commentId
// @desc    Delete a comment
// @access  Private
router.delete('/:recipeId/:commentId', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    const recipe = await Recipe.findById(req.params.recipeId);

    if (!comment) {
      return res.status(404).json({ msg: 'Comment not found' });
    }

    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    // Check if comment belongs to the recipe
    if (comment.recipe.toString() !== req.params.recipeId) {
      return res.status(400).json({ msg: 'Comment does not belong to this recipe' });
    }

    // Check user (allow comment author or recipe owner to delete)
    if (
      comment.user.toString() !== req.user.id &&
      recipe.user.toString() !== req.user.id
    ) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    await comment.deleteOne();

    res.json({ msg: 'Comment removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Comment not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/comments/:recipeId/:commentId/like
// @desc    Like a comment
// @access  Private
router.put('/:recipeId/:commentId/like', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ msg: 'Comment not found' });
    }

    // Check if comment belongs to the recipe
    if (comment.recipe.toString() !== req.params.recipeId) {
      return res.status(400).json({ msg: 'Comment does not belong to this recipe' });
    }

    // Check if the comment has already been liked by this user
    if (comment.likes.some(like => like.user.toString() === req.user.id)) {
      return res.status(400).json({ msg: 'Comment already liked' });
    }

    comment.likes.unshift({ user: req.user.id });

    await comment.save();

    res.json(comment.likes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/comments/:recipeId/:commentId/unlike
// @desc    Unlike a comment
// @access  Private
router.put('/:recipeId/:commentId/unlike', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ msg: 'Comment not found' });
    }

    // Check if comment belongs to the recipe
    if (comment.recipe.toString() !== req.params.recipeId) {
      return res.status(400).json({ msg: 'Comment does not belong to this recipe' });
    }

    // Check if the comment has been liked by this user
    if (!comment.likes.some(like => like.user.toString() === req.user.id)) {
      return res.status(400).json({ msg: 'Comment has not yet been liked' });
    }

    // Remove the like
    comment.likes = comment.likes.filter(
      like => like.user.toString() !== req.user.id
    );

    await comment.save();

    res.json(comment.likes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
