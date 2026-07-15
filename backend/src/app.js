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

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/users', require('./modules/users/users.routes'));
app.use('/api/roles', require('./modules/roles/roles.routes'));
app.use('/api/locations', require('./modules/locations/locations.routes'));
app.use('/api/suppliers', require('./modules/suppliers/suppliers.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
