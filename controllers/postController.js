const multer = require('multer');
const sharp = require('sharp');

const AppError = require('../utils/appError');
const Post = require('../models/postModel');
const factory = require('./handlerFactory');

exports.setUserId = (req, res, next) => {
  req.body.author = req.user.id;
  next();
};

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadPostImages = upload.array('images', 3);

exports.formatPostImages = async (req, res, next) => {
  try {
    if (!req.files) return next();
    let promises = [];
    req.body.images = [];

    req.files.forEach((file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      promises.push(
        sharp(file.buffer)
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toFile(`public/img/posts/${filename}`),
      );

      req.body.images.push(filename);
    });

    await Promise.all(promises);

    next();
  } catch (err) {
    next(err);
  }
};

exports.getAllPosts = factory.getAll(Post);
exports.getPost = factory.getOne(Post);
exports.createPost = factory.createOne(Post);
exports.updatePost = factory.updateOne(Post);
exports.deletePost = factory.deleteOne(Post);

exports.getMonthlyPosts = async (req, res, next) => {
  try {
    const year = +req.params.year;

    const post = await Post.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          numOfPosts: { $sum: 1 },
          posts: { $push: '$title' },
        },
      },
      {
        $addFields: { month: '$_id' },
      },
      {
        $sort: { numOfPosts: -1 },
      },
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        post,
      },
    });
  } catch (err) {
    next(err);
  }
};
