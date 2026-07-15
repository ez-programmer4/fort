class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function notFound(req, res, next) {
  next(new ApiError(404, `Not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: {
      message: status === 500 ? 'Internal server error' : err.message,
      status,
    },
  });
}

module.exports = { ApiError, notFound, errorHandler };
