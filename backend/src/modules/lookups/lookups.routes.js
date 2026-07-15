const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const prisma = require('../../utils/prisma');

router.use(requireAuth);

// Grouped lookup values: { doseForm: [...], route: [...], doseUnit: [...], unit: [...] }
router.get('/', async (req, res, next) => {
  try {
    const rows = await prisma.lookup.findMany({ orderBy: [{ category: 'asc' }, { value: 'asc' }] });
    const grouped = {};
    for (const r of rows) (grouped[r.category] ||= []).push(r.value);
    res.json({ lookups: grouped });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
