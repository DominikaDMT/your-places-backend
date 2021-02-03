const jsonwebtoken = require('jsonwebtoken');
const HttpError = require('../models/http-error');

module.exports = (req, res, next) => {
  // konieczne, aby się upewnieć, że options nie będzie zablokowane
  if (req.method === 'OPTIONS') {
    return next();
  }
  // token nie zawsze może być częścią body, bo niektóre req nie mają body (np. delete, get)
  // opcjonalnie - może jako query w url ?token=abc
  // 3 opcja - Headers

  try {
    // wcześniej w app.js dopuśliniśmy załączenie nagłowka 'Authorization' (setHader)
    const token = req.headers.authorization.split(' ')[1]; // Authorization: 'Bearer TOKEN'
    if (!token) {
      throw new Error('Authentication failed!');
    }
    const decodedToken = jsonwebtoken.verify(token, process.env.JWT_KEY);
    // poniżej: dynamiczne dodanie pola do req
    // każdy inny req będzie mógł korzystać z userData
    req.userData = { userId: decodedToken.userId };
    next();
    // powyższe sprawia, że zostaną sprawdzone route'y, które są po tym middleware w place-routes.js
  } catch (err) {
    const error = new HttpError('Authentication failed!', 403);
    return next(error);
  }
};
