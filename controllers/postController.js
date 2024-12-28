const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');

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
    if (!req.files || req.files.length === 0) return next();
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
    const month = +req.params.month;

    const allTime = await Post.aggregate([
      {
        $group: {
          _id: 'All Time Stats',
          totalPosts: { $sum: 1 },
        },
      },
    ]);

    const totalPost = await Post.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${year}-${month}-01`),
            $lte: new Date(`${year}-${month}-31`),
          },
        },
      },
      {
        $group: {
          _id: month,
          numOfPosts: { $sum: 1 },
          post: { $push: '$title' },
        },
      },
    ]);

    const spStats = await Post.aggregate([
      {
        $match: {
          category: { $eq: 'sp' },
        },
      },
      {
        $group: {
          _id: '$category',
          numOfPosts: { $sum: 1 },
          posts: { $push: '$title' },
        },
      },
    ]);

    const ksStats = await Post.aggregate([
      {
        $match: {
          category: { $eq: 'ks' },
        },
      },
      {
        $group: {
          _id: '$category',
          numOfPosts: { $sum: 1 },
          posts: { $push: '$title' },
        },
      },
    ]);

    const envStats = await Post.aggregate([
      {
        $match: {
          category: { $eq: 'env' },
        },
      },
      {
        $group: {
          _id: '$category',
          numOfPosts: { $sum: 1 },
          posts: { $push: '$title' },
        },
      },
    ]);

    const otherStats = await Post.aggregate([
      {
        $match: {
          category: { $eq: 'other' },
        },
      },
      {
        $group: {
          _id: '$category',
          numOfPosts: { $sum: 1 },
          posts: { $push: '$title' },
        },
      },
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        allTime: allTime[0],
        totalPost: totalPost[0],
        postPerCategory: {
          sp: spStats[0],
          ks: ksStats[0],
          env: envStats[0],
          other: otherStats[0],
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
