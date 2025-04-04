const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const Comment = require('../models/Comment');

// @route   POST api/recipes
// @desc    Create a recipe
// @access  Private
router.post(
  '/',
  [
    auth,
    [
      check('title', 'Title is required').not().isEmpty(),
      check('description', 'Description is required').not().isEmpty(),
      check('ingredients', 'At least one ingredient is required').isArray({ min: 1 }),
      check('instructions', 'At least one instruction is required').isArray({ min: 1 }),
      check('cookingTime', 'Cooking time is required').isNumeric(),
      check('servings', 'Number of servings is required').isNumeric()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        title,
        description,
        ingredients,
        instructions,
        cookingTime,
        servings,
        image,
        tags,
        parentRecipe
      } = req.body;

      // Create recipe object
      const recipeFields = {
        user: req.user.id,
        title,
        description,
        ingredients,
        instructions,
        cookingTime,
        servings
      };

      if (image) recipeFields.image = image;
      if (tags) recipeFields.tags = tags;
      
      // Check if this is a forked recipe
      if (parentRecipe) {
        const originalRecipe = await Recipe.findById(parentRecipe);
        if (!originalRecipe) {
          return res.status(404).json({ msg: 'Parent recipe not found' });
        }
        recipeFields.parentRecipe = parentRecipe;
        recipeFields.isForked = true;
        if (req.body.modifications) {
          recipeFields.modifications = req.body.modifications;
        }
      }

      const recipe = new Recipe(recipeFields);
      await recipe.save();

      res.json(recipe);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   GET api/recipes
// @desc    Get all recipes
// @access  Public
router.get('/', async (req, res) => {
  try {
    const recipes = await Recipe.find()
      .sort({ date: -1 })
      .populate('user', ['name', 'avatar']);
    res.json(recipes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/recipes/:id
// @desc    Get recipe by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate('user', ['name', 'avatar'])
      .populate('parentRecipe');

    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    res.json(recipe);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Recipe not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/recipes/:id
// @desc    Update a recipe
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    let recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    // Check user
    if (recipe.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    // Update recipe
    const {
      title,
      description,
      ingredients,
      instructions,
      cookingTime,
      servings,
      image,
      tags
    } = req.body;

    // Build recipe object
    const recipeFields = {};
    if (title) recipeFields.title = title;
    if (description) recipeFields.description = description;
    if (ingredients) recipeFields.ingredients = ingredients;
    if (instructions) recipeFields.instructions = instructions;
    if (cookingTime) recipeFields.cookingTime = cookingTime;
    if (servings) recipeFields.servings = servings;
    if (image) recipeFields.image = image;
    if (tags) recipeFields.tags = tags;

    recipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      { $set: recipeFields },
      { new: true }
    );

    res.json(recipe);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/recipes/:id
// @desc    Delete a recipe
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    // Check user
    if (recipe.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    await recipe.deleteOne();
    
    // Delete all comments associated with the recipe
    await Comment.deleteMany({ recipe: req.params.id });

    res.json({ msg: 'Recipe removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Recipe not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST api/recipes/:id/fork
// @desc    Fork a recipe
// @access  Private
router.post('/:id/fork', auth, async (req, res) => {
  try {
    const originalRecipe = await Recipe.findById(req.params.id);

    if (!originalRecipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    // Create a new recipe based on the original
    const newRecipe = new Recipe({
      user: req.user.id,
      title: originalRecipe.title,
      description: originalRecipe.description,
      ingredients: originalRecipe.ingredients,
      instructions: originalRecipe.instructions,
      cookingTime: originalRecipe.cookingTime,
      servings: originalRecipe.servings,
      image: originalRecipe.image,
      tags: originalRecipe.tags,
      parentRecipe: originalRecipe._id,
      isForked: true,
      modifications: req.body.modifications || 'Forked recipe'
    });

    await newRecipe.save();

    res.json(newRecipe);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/recipes/:id/image
// @desc    Upload recipe image
// @access  Private
router.post('/:id/image', [auth, upload.single('image')], async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    // Check user
    if (recipe.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    recipe.image = `/uploads/${req.file.filename}`;
    await recipe.save();

    res.json(recipe);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/recipes/user/:userId
// @desc    Get recipes by user ID
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const recipes = await Recipe.find({ user: req.params.userId })
      .sort({ date: -1 })
      .populate('user', ['name', 'avatar']);
    
    res.json(recipes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/recipes/:id/like
// @desc    Like a recipe
// @access  Private
router.put('/:id/like', auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    // Check if the recipe has already been liked by this user
    if (recipe.likes.some(like => like.user.toString() === req.user.id)) {
      return res.status(400).json({ msg: 'Recipe already liked' });
    }

    recipe.likes.unshift({ user: req.user.id });

    await recipe.save();

    res.json(recipe.likes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/recipes/:id/unlike
// @desc    Unlike a recipe
// @access  Private
router.put('/:id/unlike', auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    // Check if the recipe has been liked by this user
    if (!recipe.likes.some(like => like.user.toString() === req.user.id)) {
      return res.status(400).json({ msg: 'Recipe has not yet been liked' });
    }

    // Remove the like
    recipe.likes = recipe.likes.filter(
      like => like.user.toString() !== req.user.id
    );

    await recipe.save();

    res.json(recipe.likes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
