const fs = require('fs');
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const placesRoutes = require('./routes/places-routes');
// placeRoutes jest teraz middleware

const usersRoutes = require('./routes/users-routes');
const HttpError = require('./models/http-error');

const port = process.env.PORT || 5000;
const app = express();

// outsource routing

app.use(bodyParser.json());

// static - wbudowane w express - zwraca requested file (return - not execute)
app.use('/uploads/images', express.static(path.join('uploads', 'images')));

// nie wysyłamy tu odp, tylko dodajemy nagłowki do response, które będą wysłane podczas podejścia do konkretnych routów
app.use((req, res, next) => {
  // drugi argument - jaka domena powinna mieć dostęp
  // każda domena możw wysyłać requesty
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Poniżej - jakie nagłwoki mogą miec requesty wysyłane przez przeglądrakę
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  // okresla jakie metody http mogą być użyte na frontendzie
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');

  next();
});

// Jeśli ściezki zaczynają się na '/api/places' - request zostaną skierowane do middleware placesRoutes
app.use('/api/places', placesRoutes);
app.use('/api/users', usersRoutes);

// poniższy zadziałą tylkko dla requestów, które nie otrzymają odp
app.use((req, res, next) => {
  const error = new HttpError('Could not find this route.', 404);
  throw error;
});

// middleware - error handler
app.use((error, req, res, next) => {
  if (req.file) {
    // delete file
    fs.unlink(req.file.path, (error) => {
      console.log(error);
    });
  }
  if (res.headerSent) {
    return next(error);
  }
  res.status(error.code || 500);
  res.json({ message: error.message || 'An unknown error occurred!' });
});

// connect zwraca Promise, bo to asynch.
mongoose
  .connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_NAME}.bq38d.mongodb.net/MERN?retryWrites=true&w=majority`, {useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true}
  )
  .then(() => {
    app.listen(port);
  })
  .catch((err) => {
    console.log(err);
  });
