const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const bincard = require('./bincard.controller');
const finance = require('./finance.controller');

router.use(requireAuth);

router.get('/bincard', requirePermission('products.view', 'inventory.view'), bincard.binCard);

router.get('/finance', requirePermission('reports.view'), finance.financeJson);
router.get('/finance.pdf', requirePermission('reports.view'), finance.financePdf);
router.get('/sales', requirePermission('reports.view'), finance.salesJson);
router.get('/sales.pdf', requirePermission('reports.view'), finance.salesPdf);
router.get('/withholding', requirePermission('reports.view'), finance.withholdingJson);
router.get('/withholding.pdf', requirePermission('reports.view'), finance.withholdingPdf);

module.exports = router;
