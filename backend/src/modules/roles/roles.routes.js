const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./roles.controller');

router.use(requireAuth);

// Any authenticated user may list roles (needed for user forms);
// editing permissions requires roles.manage
router.get('/', ctrl.list);
router.get('/permissions', requirePermission('roles.manage'), ctrl.listPermissions);
router.put('/:id/permissions', requirePermission('roles.manage'), ctrl.updatePermissions);

module.exports = router;
