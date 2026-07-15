const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export const apiUrl = (path: string) => `${BASE}/api${path}`;

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("tiktoke_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const fmt = (n: number | string | undefined | null) =>
  Number(n ?? 0).toLocaleString("uz-UZ");

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("uz-UZ") : "—";

export const payLabel = (m: string) =>
  ({ cash: "Naqd", card: "Karta", transfer: "O'tkazma", credit: "Nasiya" }[m] ?? m);

export function exportXlsx(data: object[], filename: string) {
  import("xlsx").then((XLSX) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ma'lumotlar");
    XLSX.writeFile(wb, filename);
  });
}

export const today = () => new Date().toISOString().split("T")[0];
export const monthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split("T")[0];
};
