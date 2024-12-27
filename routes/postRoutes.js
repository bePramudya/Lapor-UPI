const express = require('express');
const postController = require('../controllers/postController');
const authController = require('../controllers/authController');

const router = express.Router();

// router.param('id', tourController.checkID);

router.route('/monthly-stats/:year&:month').get(postController.getMonthlyPosts);

router
  .route('/')
  .get(postController.getAllPosts)
  .post(
    authController.protect,
    postController.setUserId,
    postController.createPost,
  );

router
  .route('/:id')
  .get(postController.getPost)
  .patch(
    authController.protect,
    authController.restrictTo('admin'),
    postController.uploadPostImages,
    postController.formatPostImages,
    postController.updatePost,
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin'),
    postController.deletePost,
  );

module.exports = router;
