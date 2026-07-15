const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { errorHandler, notFound } = require('./middleware/error');

const app = express();

app.use(helmet());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'fortinventory-api', time: new Date().toISOString() });
});

// Module routers get mounted here as phases are built, e.g.:
// app.use('/api/auth', require('./modules/auth/auth.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
