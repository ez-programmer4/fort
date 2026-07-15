const router = require('express').Router();
const multer = require('multer');
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./products.controller');
const excel = require('./products.excel');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(requireAuth);

router.get('/', requirePermission('products.view', 'products.manage'), ctrl.list);
router.get('/template', requirePermission('products.manage'), excel.template);
router.get('/export', requirePermission('products.view', 'products.manage'), excel.exportProducts);
router.post('/import', requirePermission('products.manage'), upload.single('file'), excel.importProducts);
router.post('/', requirePermission('products.manage'), ctrl.create);
router.patch('/:id', requirePermission('products.manage'), ctrl.update);

module.exports = router;
