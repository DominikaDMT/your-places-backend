const fs = require('fs');

const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Place = require('../models/place');
const User = require('../models/user');

const mongooseUniqueValidator = require('mongoose-unique-validator');
const { v4: uuid } = require('uuid');

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid; // {pid: 'p1}

  // findById nie zwraca promisa, ale nadal można użyć try-catch
  // findById().exec() - jeśli potrzebujemy Promisa

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    // err dotyczy problemów z GET request
    const error = new HttpError(
      'Something went wrong. Could not find a place.',
      500
    );
    return next(error);
  }

  if (!place) {
    const error = new HttpError(
      'Could not find a place for the provided id.',
      404
    );
    return next(error);

    // next(error) - jedna opcja (lepsza opcja, gdy kod jest asynchronicznt)
    // throw(error); - druga opcja - dla kodu synchroncizznego
    // podczas użycia thorw nie trzeba używać return
  }

  // wysłanie odpowiedzi z jsonem
  // place jest aktualnie obiektem mongoose, trzeba go zmienić na zwykły
  //  getters: true - usuwa "_" i dodaje dodatkową własciwość "id"
  res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  // let places;
  let userWithPlaces;
  try {
    // places = await Place.find({creator: userId});
    userWithPlaces = await User.findById(userId).populate('places');

    // console.log(places);
    // samo find() zwróci wszystkie places
    // find w mongo zwraca kursor
    // find w mognoose zwraca tablicę
  } catch (err) {
    const error = new HttpError(
      'Fetching places failed, please try again later.',
      500
    );
    return next(error);
  }

  // if (!places || places.length === 0) {
  if (!userWithPlaces || userWithPlaces.places.length === 0) {
    return next(
      new HttpError('Could not find places for the provided user id.', 404)
    );
    // zostanie przekazane do następnego middleware, który obsuguje błędy
    // return next(error)
  }

  // musimy dodac metodę do 'places', ale nie 'toObject', bo mamy tablicę

  // res.json({ places: places.map(place => place.toObject({getters: true})) });
  res.json({
    places: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    )
  });
};

const createPlace = async (req, res, next) => {
  // po middleware, który waliduje, wykona się to:
  const errors = validationResult(req);
  // przekazujemy req, a ta funkcja sprawdzi, czy są jakies errory, wykryte a bazie configu, który ustawilismy w check
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invaid inputs passed, please check your data.', 422)
    );
  }
  // podczas pracy z kodem asynchronicznym 'throw' nie zadziala poprawnie w Express, dlatego trzeba użyć next, a samo next nie zatryma kolejnych funkcji, więc trzeba użyć z return

  const { title, description, address } = req.body;

  // w poniższym może wywołać się error z location, daltego stosujemy try catch
  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
    // w catch nie wychodzimy z funkcji automatycznie
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId,
  });

  let user;

  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError('Creating place failed, please try again.', 500);
    return next(error);
  }

  if (!user) {
    const error = new HttpError('Could not find user for provided id.', 404);
    return next(error);
  }

  console.log(user);

  // save - metoda mongoose - to też jest Promise

  try {
    // sesje i tranzakcje
    const session = await mongoose.startSession();
    session.startTransaction();
    await createdPlace.save({ session: session });
    // push - od mongoose - przekazuje id, ustanawia połączenie
    user.places.push(createdPlace);
    await user.save({ session: session });
    await session.commitTransaction();
  } catch (err) {
    const error = new HttpError('Creating place failed, please try again.', 500);
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invaid inputs passed, please check your data.', 422)
    );
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update place.',
      500
    );
    return next(error);
  }

  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError('You are not allowed to edit this place.', 401);
    return next(error);
  }

  place.title = title;
  place.description = description;

  // save() jest asynchroniczne

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update place.',
      500
    );
    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;
  try {
    // populate - pozwal na odniesienie się do dokumentu z innej kolekcji
    // konieczne jest połączenie w Schematach
    // argument: info o dok, gdzie chcemy coś zmienić i właściwość
    place = await Place.findById(placeId).populate('creator');
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete place.',
      500
    );
    return next(error);
  }

  if (!place) {
    const error = new HttpError('Could not find place for this id.', 404);
    return next(error);
  }

  if (place.creator.id !== req.userData.userId) {
    const error = new HttpError(
      'You are not allowed to delete this place.',
      401
    );
    return next(error);
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.remove({ session: sess });
    // pull -usuwanie id
    // dzięki "populate" możemy używać pull na place.creator - podłaczony został pełen obiekt usera
    place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete place.',
      500
    );
    return next(error);
  }

  // delete
  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: 'Deleted place.' });
};

// module.exports - eksport jednej rzeczy

// eksportowanie więcej elementów:
exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
