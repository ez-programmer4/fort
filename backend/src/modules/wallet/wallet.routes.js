const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./wallet.controller');

router.use(requireAuth);

router.get('/summary', requirePermission('finance.view', 'finance.manage'), ctrl.summary);
router.get('/credits', requirePermission('finance.view', 'finance.manage'), ctrl.credits);
router.get('/payments', requirePermission('finance.view', 'finance.manage'), ctrl.listPayments);
router.post('/payments', requirePermission('finance.manage'), ctrl.recordPayment);

module.exports = router;
