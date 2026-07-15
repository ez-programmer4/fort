const prisma = require('./prisma');

const DEFAULTS = {
  pharmacyName: 'FortInventory Pharmacy',
  pharmacyAddress: '',
  pharmacyPhone: '',
  logoInitial: 'F',
  defaultExpiryAlertDays: 90,
  whtGoodsRate: 2,
  whtServicesRate: 2,
};

async function getSettings() {
  const rows = await prisma.setting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULTS, ...stored };
}

async function saveSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULTS)) continue; // only known keys
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  return getSettings();
}

module.exports = { getSettings, saveSettings, DEFAULTS };
