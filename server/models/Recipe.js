const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RecipeSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  ingredients: [
    {
      name: {
        type: String,
        required: true
      },
      quantity: {
        type: String,
        required: true
      },
      unit: {
        type: String
      }
    }
  ],
  instructions: [
    {
      step: {
        type: Number,
        required: true
      },
      text: {
        type: String,
        required: true
      }
    }
  ],
  cookingTime: {
    type: Number,
    required: true
  },
  servings: {
    type: Number,
    required: true
  },
  image: {
    type: String
  },
  tags: [
    {
      type: String
    }
  ],
  parentRecipe: {
    type: Schema.Types.ObjectId,
    ref: 'recipe'
  },
  isForked: {
    type: Boolean,
    default: false
  },
  modifications: {
    type: String
  },
  likes: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: 'user'
      }
    }
  ],
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('recipe', RecipeSchema);
