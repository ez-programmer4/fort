const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./sales.controller');

fs.mkdirSync(ctrl.UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: ctrl.UPLOAD_DIR,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

router.get('/', requirePermission('sales.view', 'sales.dispense'), ctrl.list);
router.get('/:id', requirePermission('sales.view', 'sales.dispense'), ctrl.getOne);
router.post('/', requirePermission('sales.dispense'), ctrl.create);
router.post('/:id/attachments', requirePermission('sales.view', 'sales.dispense'), upload.single('file'), ctrl.addAttachment);
router.get('/:id/attachments/:attId', requirePermission('sales.view', 'sales.dispense'), ctrl.downloadAttachment);
router.patch('/:id/withholding-receipt', requirePermission('finance.manage'), ctrl.updateWithholdingReceipt);

module.exports = router;
