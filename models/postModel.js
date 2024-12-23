const mongoose = require('mongoose');

const slugify = require('slugify');

const postSchema = mongoose.Schema({
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Post must belong to user'],
  },
  title: {
    type: String,
    required: [true, 'title undefined'],
    trim: true,
    maxLength: [32, 'A tour name must have less or equal than 40 characters'],
    minLength: [8, 'A tour name must have more or equal than 10 characters'],
  },
  slug: String,
  description: {
    type: String,
    required: [true, 'description undefined'],
    trim: true,
  },
  category: {
    type: String,
    required: [true, 'category undefined'],
    enum: {
      values: ['sp', 'ks', 'env', 'other'],
      message: 'category is either sp, ks, env, or another',
    },
  },
  images: [String],
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  solved: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

// DOC MIDDLEWARE
postSchema.pre('save', function (next) {
  this.slug = slugify(this.title, { lower: true });
  next();
});

postSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'author',
    select: 'name photo',
  });

  next();
});

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
