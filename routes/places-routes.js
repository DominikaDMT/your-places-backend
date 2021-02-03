const express = require('express');
// express trzeba zaimportować wszędzie, gdzie go używamy

const { check } = require('express-validator');

const placesControllers = require('../controllers/places-controllers');
const fileUpload = require('../middleware/file-upload');
const checkAuth = require('../middleware/check-auth');

// Router method
const router = express.Router();

// po przefiltrowanie: '/api/places/:pid'
router.get('/:pid', placesControllers.getPlaceById);

// '/api/places/user/:uid'
router.get('/user/:uid', placesControllers.getPlacesByUserId);

// middleware, który sprawdza token
router.use(checkAuth);

// '/api/places/
router.post(
  '/',
  // szukamy image w body
  fileUpload.single('image'),
  [
    check('title').not().isEmpty(),
    check('description').isLength({ min: 5 }),
    check('address').not().isEmpty(),
  ],
  placesControllers.createPlace
);
// można podać więcej iddleware'ów, wykonywane od lewej do prawej

router.patch(
  '/:pid',
  [check('title').not().isEmpty(), check('description').isLength({ min: 5 })],
  placesControllers.updatePlace
);

router.delete('/:pid', placesControllers.deletePlace);

module.exports = router;
