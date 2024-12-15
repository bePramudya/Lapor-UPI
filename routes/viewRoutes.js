const express = require('express');
const viewController = require('../controllers/viewController');

const router = express.Router();

router.get('/', viewController.login);
router.get('/laporan', viewController.laporan);

module.exports = router;
