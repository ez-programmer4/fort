const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { ApiError } = require('./error');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Authentication required');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new ApiError(401, 'Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    if (!user || !user.isActive) throw new ApiError(401, 'User not found or inactive');

    req.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role.name,
      roleId: user.roleId,
      permissions: user.role.permissions.map((rp) => rp.permission.key),
    };
    next();
  } catch (err) {
    next(err);
  }
}

function requirePermission(...keys) {
  return (req, res, next) => {
    const ok = keys.some((k) => req.user.permissions.includes(k));
    if (!ok) return next(new ApiError(403, 'You do not have permission to do this'));
    next();
  };
}

module.exports = { requireAuth, requirePermission };
