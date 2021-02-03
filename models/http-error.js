class HttpError extends Error {
  // based on a build-in error
  constructor(message, errorCode) {
    super(message); // dodanie 'message' property
    this.code = errorCode; // dodanie 'code' property
  }
}

module.exports = HttpError;
