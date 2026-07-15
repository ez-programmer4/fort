const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./dashboard.controller');

router.use(requireAuth);

router.get('/', requirePermission('dashboard.view'), ctrl.overview);

module.exports = router;
