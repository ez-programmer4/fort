'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';

interface Role {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

interface Permission {
  id: number;
  key: string;
  label: string;
  module: string;
}

export default function RolesPage() {
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ roles: Role[] }>('/api/roles'),
      api<{ permissions: Permission[] }>('/api/roles/permissions'),
    ])
      .then(([r, p]) => {
        setRoles(r.roles);
        setPermissions(p.permissions);
        if (r.roles.length && selectedId === null) {
          setSelectedId(r.roles[0].id);
          setChecked(new Set(r.roles[0].permissions));
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = roles.find((r) => r.id === selectedId) || null;

  const byModule = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    for (const p of permissions) (groups[p.module] ||= []).push(p);
    return groups;
  }, [permissions]);

  function selectRole(role: Role) {
    setSelectedId(role.id);
    setChecked(new Set(role.permissions));
  }

  function toggle(key: string) {
    if (!selected || selected.isSystem) return;
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChecked(next);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/api/roles/${selected.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: Array.from(checked) }),
      });
      setRoles((prev) =>
        prev.map((r) => (r.id === selected.id ? { ...r, permissions: Array.from(checked) } : r)),
      );
      toast.success(`Permissions saved for "${selected.name}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Roles &amp; Permissions</h1>
      <p className="mt-1 text-sm text-slate-500">
        Choose a role, then set what it can access. The Admin role always has full access.
      </p>

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Spinner className="h-4 w-4" />
          Loading roles…
        </div>
      )}

      {!loading && (
        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <div className="w-full space-y-2 lg:w-64">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => selectRole(r)}
                className={`w-full rounded-lg border px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
                  r.id === selectedId
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">
                  {r.name}
                  {r.isSystem && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">
                      locked
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{r.description}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {r.permissions.length} permissions · {r.userCount} user(s)
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
                {!selected.isSystem && (
                  <button
                    onClick={save}
                    disabled={saving}
                    className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                {Object.entries(byModule).map(([module, perms]) => (
                  <div key={module}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {module}
                    </h3>
                    <div className="mt-2 space-y-1.5">
                      {perms.map((p) => (
                        <label
                          key={p.key}
                          className={`flex items-start gap-2 text-sm ${
                            selected.isSystem ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.isSystem || checked.has(p.key)}
                            disabled={selected.isSystem}
                            onChange={() => toggle(p.key)}
                            className="mt-0.5 accent-slate-900"
                          />
                          <span className="text-slate-700">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
