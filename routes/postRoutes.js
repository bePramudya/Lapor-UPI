const express = require('express');
const postController = require('../controllers/postController');
const authController = require('../controllers/authController');

const router = express.Router();

// router.param('id', tourController.checkID);

router.get('/monthly-stats/:year&:month', postController.getMonthlyPosts);

router.delete(
  '/softDelete/:id',
  authController.protect,
  authController.restrictTo('admin'),
  postController.softDelete,
);

router
  .route('/archive')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    postController.getArchive,
  );

router
  .route('/archive/:id')
  .patch(
    authController.protect,
    authController.restrictTo('admin'),
    postController.restorePost,
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin'),
    postController.hardDeletePost,
  );

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
  );

module.exports = router;
