const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const orders = require('./orders.controller');
const receipts = require('./receipts.controller');

router.use(requireAuth);

router.get('/orders', requirePermission('procurement.view', 'procurement.manage'), orders.list);
router.post('/orders', requirePermission('procurement.manage'), orders.create);
router.post('/orders/:id/receive', requirePermission('procurement.manage'), orders.receive);
router.post('/orders/:id/cancel', requirePermission('procurement.manage'), orders.cancel);

router.get('/receipts', requirePermission('procurement.view', 'procurement.manage'), receipts.listReceipts);

router.get('/expenses', requirePermission('procurement.view', 'procurement.manage'), receipts.listExpenses);
router.post('/expenses', requirePermission('procurement.manage'), receipts.createExpense);

module.exports = router;
