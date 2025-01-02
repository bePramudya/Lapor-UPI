const multer = require('multer');
const sharp = require('sharp');

const AppError = require('../utils/appError');
const Post = require('../models/postModel');
const factory = require('./handlerFactory');
const authController = require('./authController');
const APIFeatures = require('../utils/apiFeatures');

exports.setUserIdAndCreatedAt = (req, res, next) => {
  req.body.author = req.user.id;
  req.body.createdAt = Date.now();
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

    const promises = [];
    req.body.images = [];
    let filename;

    const currentUser = await authController.getUserInfo(req, res, next, true);

    req.files.forEach((file, i) => {
      if (req.params.id) {
        filename = `post-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;
      } else {
        filename = `post-${currentUser._id}-${Date.now()}-${i + 1}.jpeg`;
      }

      promises.push(
        sharp(file.buffer)
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toBuffer()
          .then((data) => {
            file.buffer = data;
          }),
      );

      req.body.images.push(filename);
      file.filename = filename;
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
exports.hardDeletePost = factory.deleteOne(Post);

const filterArchive = (docs) => {
  const filteredDocs = docs
    .map((doc) => {
      if (!doc.isDeleted) doc = undefined;
      return doc;
    })
    .filter((el) => el !== undefined);

  return filteredDocs;
};

exports.getArchive = async (req, res, next) => {
  try {
    const features = new APIFeatures(Post.find(), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    const docs = await features.query;

    const archiveDocs = filterArchive(docs);

    res.status(200).json({
      status: 'success',
      results: archiveDocs.length,
      data: archiveDocs,
    });
  } catch (err) {
    next(err);
  }
};

exports.restorePost = async (req, res, next) => {
  try {
    const doc = await Post.findByIdAndUpdate(
      req.params.id,
      { isDeleted: false },
      {
        new: true,
      },
    );

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err) {
    next(err);
  }
};

exports.softDelete = async (req, res, next) => {
  try {
    const doc = await Post.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      {
        new: true,
      },
    );

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err) {
    next(err);
  }
};

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
          isDeleted: { $eq: false },
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
