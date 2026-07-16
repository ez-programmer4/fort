const bcrypt = require('bcryptjs');
const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { parseSort } = require('../../utils/sort');

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  isActive: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
};

const SORT_FIELDS = {
  fullName: 'fullName',
  email: 'email',
  createdAt: 'createdAt',
  role: (dir) => ({ role: { name: dir } }),
};

async function list(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const where = q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const orderBy = parseSort(req.query, SORT_FIELDS, 'fullName');

    // Without ?page, return the full list (backward compatible).
    if (!req.query.page) {
      const users = await prisma.user.findMany({ where, select: userSelect, orderBy });
      return res.json({ users, total: users.length });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ users, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { fullName, email, password, roleId } = req.body || {};
    if (!fullName || !email || !password || !roleId) {
      throw new ApiError(400, 'fullName, email, password and roleId are required');
    }
    if (String(password).length < 6) throw new ApiError(400, 'Password must be at least 6 characters');

    const role = await prisma.role.findUnique({ where: { id: Number(roleId) } });
    if (!role) throw new ApiError(400, 'Role not found');

    const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (existing) throw new ApiError(409, 'A user with this email already exists');

    const user = await prisma.user.create({
      data: {
        fullName: String(fullName).trim(),
        email: String(email).toLowerCase().trim(),
        passwordHash: await bcrypt.hash(String(password), 10),
        roleId: Number(roleId),
      },
      select: userSelect,
    });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new ApiError(404, 'User not found');

    const { fullName, email, password, roleId, isActive } = req.body || {};
    const data = {};
    if (fullName !== undefined) data.fullName = String(fullName).trim();
    if (email !== undefined) data.email = String(email).toLowerCase().trim();
    if (roleId !== undefined) {
      const role = await prisma.role.findUnique({ where: { id: Number(roleId) } });
      if (!role) throw new ApiError(400, 'Role not found');
      data.roleId = Number(roleId);
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (password) {
      if (String(password).length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
      data.passwordHash = await bcrypt.hash(String(password), 10);
    }

    // Don't let the last active admin lock themselves out
    if (id === req.user.id && data.isActive === false) {
      throw new ApiError(400, 'You cannot deactivate your own account');
    }

    const user = await prisma.user.update({ where: { id }, data, select: userSelect });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
