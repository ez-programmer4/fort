const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./customers.controller');

router.use(requireAuth);

// Any signed-in user who can dispense or view sales/dashboard may search customers;
// creating (quick-create) requires being able to dispense.
router.get('/', requirePermission('sales.dispense', 'sales.view', 'dashboard.view'), ctrl.list);
router.post('/', requirePermission('sales.dispense'), ctrl.create);

module.exports = router;
