// const Post = require('../models/postModel');
// const User = require('../models/userModel');
// const AppError = require('../utils/appError');

exports.test = async (req, res, next) => {
  try {
    res.status(200).render('base', { title: 'Reports' });
  } catch (err) {
    next(err);
  }
};
