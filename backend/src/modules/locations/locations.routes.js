const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./locations.controller');

router.use(requireAuth);

// Any signed-in user may list locations (needed for dispensing, GRV, filters);
// changes require locations.manage
router.get('/', ctrl.list);
router.post('/', requirePermission('locations.manage'), ctrl.create);
router.patch('/:id', requirePermission('locations.manage'), ctrl.update);
router.delete('/:id', requirePermission('locations.manage'), ctrl.remove);

module.exports = router;
