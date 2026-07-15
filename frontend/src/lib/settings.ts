import { useEffect, useState } from 'react';
import { api } from './api';

export interface AppSettings {
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  logoInitial: string;
  defaultExpiryAlertDays: number;
  whtGoodsRate: number;
  whtServicesRate: number;
}

let cached: AppSettings | null = null;

export async function fetchSettings(force = false): Promise<AppSettings> {
  if (cached && !force) return cached;
  const d = await api<{ settings: AppSettings }>('/api/settings');
  cached = d.settings;
  return cached;
}

export function invalidateSettings() {
  cached = null;
}

export function useSettings(): AppSettings | null {
  const [settings, setSettings] = useState<AppSettings | null>(cached);
  useEffect(() => {
    fetchSettings().then(setSettings).catch(() => {});
  }, []);
  return settings;
}
