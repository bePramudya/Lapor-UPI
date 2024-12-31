const express = require('express');
const postController = require('../controllers/postController');
const authController = require('../controllers/authController');

const router = express.Router();

// router.param('id', tourController.checkID);

router.route('/monthly-stats/:year&:month').get(postController.getMonthlyPosts);

router.route('/softDelete/:id').delete(postController.softDelete);

router
  .route('/')
  .get(postController.getAllPosts)
  .post(
    postController.uploadPostImages,
    postController.formatPostImages,
    authController.protect,
    postController.setUserIdAndCreatedAt,
    postController.createPost,
  );

router
  .route('/:id')
  .get(postController.getPost)
  .patch(
    postController.uploadPostImages,
    postController.formatPostImages,
    authController.protect,
    authController.restrictTo('admin'),
    postController.updatePost,
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin'),
    postController.hardDeletePost,
  );

module.exports = router;
