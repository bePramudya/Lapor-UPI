const Post = require('../models/postModel');
const factory = require('./handlerFactory');

exports.setUserId = (req, res, next) => {
  req.body.author = req.user.id;
  next();
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
