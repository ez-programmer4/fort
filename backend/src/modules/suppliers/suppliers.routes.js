const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./suppliers.controller');

router.use(requireAuth);

// Any signed-in user may list suppliers (product forms link to them);
// changes require suppliers.manage
router.get('/', ctrl.list);
router.post('/', requirePermission('suppliers.manage'), ctrl.create);
router.patch('/:id', requirePermission('suppliers.manage'), ctrl.update);
router.delete('/:id', requirePermission('suppliers.manage'), ctrl.remove);

module.exports = router;
