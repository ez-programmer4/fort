const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./customers.controller');

router.use(requireAuth);

// Any signed-in user who can dispense or view sales/dashboard may search customers;
// creating (quick-create) requires being able to dispense. Full management (edit,
// activate/deactivate) requires customers.manage.
router.get('/', requirePermission('customers.manage', 'sales.dispense', 'sales.view', 'dashboard.view'), ctrl.list);
router.post('/', requirePermission('customers.manage', 'sales.dispense'), ctrl.create);
router.patch('/:id', requirePermission('customers.manage'), ctrl.update);
router.delete('/:id', requirePermission('customers.manage'), ctrl.remove);
// Payment-history summary, used both by customer management (to inform the manual
// rating) and by the Sales dispense flow (advisory, when a Credit sale is picked).
router.get('/:id/credit-summary', requirePermission('customers.manage', 'sales.dispense', 'sales.view'), ctrl.creditSummary);

module.exports = router;
