const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Folder = require('../models/Folder');
const Recipe = require('../models/Recipe');

// @route   POST api/folders
// @desc    Create a folder
// @access  Private
router.post(
  '/',
  [auth, [check('name', 'Name is required').not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, description, isPublic } = req.body;

      const newFolder = new Folder({
        user: req.user.id,
        name,
        description,
        isPublic: isPublic || false
      });

      const folder = await newFolder.save();

      res.json(folder);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   GET api/folders
// @desc    Get all folders for a user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const folders = await Folder.find({ user: req.user.id }).sort({ date: -1 });
    res.json(folders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/folders/:id
// @desc    Get folder by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id).populate({
      path: 'recipes',
      select: 'title description image date',
      populate: {
        path: 'user',
        select: 'name avatar'
      }
    });

    if (!folder) {
      return res.status(404).json({ msg: 'Folder not found' });
    }

    // Check if folder belongs to user or is public
    if (folder.user.toString() !== req.user.id && !folder.isPublic) {
      return res.status(401).json({ msg: 'Not authorized to view this folder' });
    }

    res.json(folder);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Folder not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/folders/:id
// @desc    Update folder
// @access  Private
router.put('/:id', auth, async (req, res) => {
  const { name, description, isPublic } = req.body;

  // Build folder object
  const folderFields = {};
  if (name) folderFields.name = name;
  if (description !== undefined) folderFields.description = description;
  if (isPublic !== undefined) folderFields.isPublic = isPublic;

  try {
    let folder = await Folder.findById(req.params.id);

    if (!folder) {
      return res.status(404).json({ msg: 'Folder not found' });
    }

    // Check user
    if (folder.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    folder = await Folder.findByIdAndUpdate(
      req.params.id,
      { $set: folderFields },
      { new: true }
    );

    res.json(folder);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/folders/:id
// @desc    Delete folder
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);

    if (!folder) {
      return res.status(404).json({ msg: 'Folder not found' });
    }

    // Check user
    if (folder.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    await folder.deleteOne();

    res.json({ msg: 'Folder removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Folder not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/folders/:id/recipes/:recipeId
// @desc    Add recipe to folder
// @access  Private
router.put('/:id/recipes/:recipeId', auth, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    const recipe = await Recipe.findById(req.params.recipeId);

    if (!folder) {
      return res.status(404).json({ msg: 'Folder not found' });
    }

    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    // Check if folder belongs to user
    if (folder.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    // Check if recipe is already in the folder
    if (folder.recipes.includes(req.params.recipeId)) {
      return res.status(400).json({ msg: 'Recipe already in folder' });
    }

    folder.recipes.push(req.params.recipeId);
    await folder.save();

    res.json(folder);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/folders/:id/recipes/:recipeId
// @desc    Remove recipe from folder
// @access  Private
router.delete('/:id/recipes/:recipeId', auth, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);

    if (!folder) {
      return res.status(404).json({ msg: 'Folder not found' });
    }

    // Check if folder belongs to user
    if (folder.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    // Check if recipe is in the folder
    if (!folder.recipes.includes(req.params.recipeId)) {
      return res.status(400).json({ msg: 'Recipe not in folder' });
    }

    // Remove recipe from folder
    folder.recipes = folder.recipes.filter(
      recipe => recipe.toString() !== req.params.recipeId
    );

    await folder.save();

    res.json(folder);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/folders/public
// @desc    Get all public folders
// @access  Public
router.get('/public/all', async (req, res) => {
  try {
    const folders = await Folder.find({ isPublic: true })
      .sort({ date: -1 })
      .populate('user', ['name', 'avatar']);
    
    res.json(folders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
