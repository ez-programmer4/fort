const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./customers.controller');

fs.mkdirSync(ctrl.UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: ctrl.UPLOAD_DIR,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

// Any signed-in user who can dispense or view sales/dashboard may search customers;
// creating (quick-create) requires being able to dispense. Full management (edit,
// activate/deactivate) requires customers.manage.
router.get('/', requirePermission('customers.manage', 'sales.dispense', 'sales.view', 'dashboard.view'), ctrl.list);
router.post('/', requirePermission('customers.manage', 'sales.dispense'), ctrl.create);
router.get('/:id', requirePermission('customers.manage', 'sales.dispense', 'sales.view', 'dashboard.view'), ctrl.getOne);
router.patch('/:id', requirePermission('customers.manage'), ctrl.update);
router.patch('/:id/status', requirePermission('customers.manage'), ctrl.setStatus);
router.delete('/:id', requirePermission('customers.manage'), ctrl.remove);
// Payment-history summary, used both by customer management (to inform the manual
// rating) and by the Sales dispense flow (advisory, when a Credit sale is picked).
router.get('/:id/credit-summary', requirePermission('customers.manage', 'sales.dispense', 'sales.view'), ctrl.creditSummary);
router.get('/:id/purchase-history', requirePermission('customers.manage', 'sales.dispense', 'sales.view'), ctrl.purchaseHistory);
router.get('/:id/payment-history', requirePermission('customers.manage', 'sales.dispense', 'sales.view'), ctrl.paymentHistory);
router.get('/:id/audit-log', requirePermission('customers.manage'), ctrl.auditLog);
router.post('/:id/license', requirePermission('customers.manage'), upload.single('file'), ctrl.uploadLicense);
router.get('/:id/license', requirePermission('customers.manage'), ctrl.downloadLicense);

module.exports = router;
