const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./alerts.controller');

router.use(requireAuth);

router.get('/', requirePermission('alerts.view'), ctrl.list);

module.exports = router;
