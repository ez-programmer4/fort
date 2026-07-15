const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');

function signTokens(userId) {
  const accessToken = jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ sub: userId, typ: 'refresh' }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions.map((rp) => rp.permission.key),
  };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw new ApiError(400, 'Email and password are required');

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ApiError(401, 'Invalid email or password');
    }
    if (!user.isActive) throw new ApiError(403, 'This account has been deactivated');

    res.json({ user: publicUser(user), ...signTokens(user.id) });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) throw new ApiError(400, 'refreshToken is required');

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }
    if (payload.typ !== 'refresh') throw new ApiError(401, 'Not a refresh token');

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new ApiError(401, 'User not found or inactive');

    res.json(signTokens(user.id));
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, refresh, me };
