const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const { ApiError } = require('../../middleware/error');
const { getSettings, saveSettings, DEFAULTS } = require('../../utils/settings.service');

router.use(requireAuth);

// Any signed-in user may read (branding for slips, WHT defaults in forms)
router.get('/', async (req, res, next) => {
  try {
    res.json({ settings: await getSettings() });
  } catch (err) {
    next(err);
  }
});

router.put('/', requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const patch = req.body || {};
    for (const key of ['defaultExpiryAlertDays']) {
      if (patch[key] !== undefined) {
        const n = Number(patch[key]);
        if (!Number.isInteger(n) || n < 0) throw new ApiError(400, `${key} must be a non-negative whole number`);
        patch[key] = n;
      }
    }
    for (const key of ['whtGoodsRate', 'whtServicesRate']) {
      if (patch[key] !== undefined) {
        const n = Number(patch[key]);
        if (!Number.isFinite(n) || n < 0 || n > 100) throw new ApiError(400, `${key} must be between 0 and 100`);
        patch[key] = n;
      }
    }
    for (const key of ['pharmacyName', 'pharmacyAddress', 'pharmacyPhone', 'logoInitial']) {
      if (patch[key] !== undefined) patch[key] = String(patch[key]).trim();
    }
    if (patch.logoInitial !== undefined) patch.logoInitial = (patch.logoInitial || DEFAULTS.logoInitial).slice(0, 2);
    if (patch.pharmacyName !== undefined && !patch.pharmacyName) throw new ApiError(400, 'Pharmacy name cannot be empty');

    res.json({ settings: await saveSettings(patch) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
