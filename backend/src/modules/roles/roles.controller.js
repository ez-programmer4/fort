const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');

async function list(req, res, next) {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { id: 'asc' },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
    });
    res.json({
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        userCount: r._count.users,
        permissions: r.permissions.map((p) => p.permission.key),
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function listPermissions(req, res, next) {
  try {
    const permissions = await prisma.permission.findMany({ orderBy: { id: 'asc' } });
    res.json({ permissions });
  } catch (err) {
    next(err);
  }
}

async function updatePermissions(req, res, next) {
  try {
    const id = Number(req.params.id);
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw new ApiError(404, 'Role not found');
    if (role.isSystem) throw new ApiError(400, 'The Admin role always has full access and cannot be edited');

    const { permissions } = req.body || {};
    if (!Array.isArray(permissions)) throw new ApiError(400, 'permissions must be an array of permission keys');

    const all = await prisma.permission.findMany({ where: { key: { in: permissions } } });
    if (all.length !== permissions.length) throw new ApiError(400, 'One or more permission keys are invalid');

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.rolePermission.createMany({
        data: all.map((p) => ({ roleId: id, permissionId: p.id })),
      }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, listPermissions, updatePermissions };
