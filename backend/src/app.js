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
app.use('/api/products', require('./modules/products/products.routes'));
app.use('/api/lookups', require('./modules/lookups/lookups.routes'));
app.use('/api/reports', require('./modules/reports/reports.routes'));
app.use('/api/inventory', require('./modules/inventory/inventory.routes'));
app.use('/api/procurement', require('./modules/procurement/procurement.routes'));
app.use('/api/sales', require('./modules/sales/sales.routes'));
app.use('/api/wallet', require('./modules/wallet/wallet.routes'));
app.use('/api/alerts', require('./modules/alerts/alerts.routes'));
app.use('/api/dashboard', require('./modules/dashboard/dashboard.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
