# FortInventory — Build History

Chronological log of everything done on the system. Newest entries at the top.
Each entry: date, phase/module, what was done, and any decisions made.

---

## 2026-07-15 — Phase 1 complete: Auth, Users & Roles

**Phase:** 1 — Auth, Users & Roles

**Done:**
- Prisma models `User`, `Role`, `Permission`, `RolePermission` — migration `init_auth`
- Seed: 18 permissions across 10 modules, 4 roles (Admin, Accountant, Operations, Sales), default admin user
- Auth API: `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me` — JWT access (15 m) + refresh (7 d), bcrypt password hashing
- RBAC middleware: `requireAuth` (loads user + role permissions), `requirePermission(key)`
- Users API: list / create / update (rename, email, role change, activate/deactivate, password reset) — guarded by `users.manage`; self-deactivation blocked
- Roles API: list roles, list permissions, replace a role's permission set — guarded by `roles.manage`; Admin role is locked (`isSystem`)
- Frontend: login page, `AuthProvider` context (token storage + auto-refresh on 401), protected `(app)` layout with permission-filtered sidebar, Dashboard placeholder, Users page (table + add/edit/deactivate), Roles & Permissions page (checkbox grid grouped by module)

**Verified:**
- Admin login → 18 permissions; `/api/auth/me`, users list, roles list all OK
- Created a Sales user via API → login OK → `GET /api/users` correctly returns **403**
- No token → **401**; all four frontend pages render (HTTP 200); `tsc --noEmit` clean

**Decisions / issues hit:**
- **Port conflict:** native PostgreSQL 17 service occupies host port 5432 and `wslrelay` holds 5433 — Docker DB now maps to **host port 5434** (`DATABASE_URL` updated)
- Refresh tokens are stateless JWTs (no DB session table); logout = client discards tokens
- Admin role is non-editable (`isSystem`) to prevent permission lockout
- Default login: `admin@fortinventory.local` / `admin123` (change in production); test user `seller@fortinventory.local` / `seller123` (Sales role)

**Next:** Phase 2 — Locations & Suppliers

---

## 2026-07-15 — Phase 0 complete: Infrastructure & scaffolding

**Phase:** 0 — Project Setup & Infrastructure

**Done:**
- Git repository initialized (`main` branch) + `.gitignore`
- `docker-compose.yml`: PostgreSQL 16 (alpine) with volume + healthcheck — container `fortinventory-db` running healthy on port 5432
- `backend/`: Express 5 app with helmet, cors, morgan, JSON error middleware, `/health` endpoint; Prisma 6 + empty schema; `.env` with DB/JWT config
- `frontend/`: Next.js 15 (App Router, TypeScript) + Tailwind CSS v4, manually scaffolded; landing page; `/api/*` rewrites proxy to backend port 4000

**Verified:**
- `docker compose ps` → db healthy
- `GET http://localhost:4000/health` → `{ status: "ok" }`
- `http://localhost:3000` → renders FortInventory landing page (HTTP 200)

**Decisions:**
- Pinned **Prisma 6** (Prisma 7 requires Node ≥ 20.19; machine runs Node 20.9)
- Skipped `create-next-app` in favor of manual scaffold (deterministic, no prompts)
- DB credentials for dev: `fort` / `fortpass` / db `fortinventory` (change for production)

**How to run:**
```
docker compose up -d          # database
cd backend && npm run dev     # API on :4000
cd frontend && npm run dev    # UI on :3000
```

**Next:** Phase 1 — Auth, Users & Roles

---

## 2026-07-15 — Project kickoff

**Phase:** Planning

**Done:**
- Reviewed requirements ([requirnment.md](requirnment.md))
- Created [BUILD_PLAN.md](BUILD_PLAN.md) — 11 phases (0–10), module by module
- Created this history file

**Decisions:**
- Tech stack per requirements: Node.js backend, Next.js frontend, PostgreSQL in Docker
- Backend framework: Express + Prisma ORM
- Build order: infrastructure → auth/roles → master data (locations, suppliers, products) → inventory core → procurement → dispensing → finance → alerts/dashboard → reports → settings

**Next:** Phase 0 — Docker Compose + backend/frontend scaffolding
