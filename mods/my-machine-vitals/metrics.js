export function parseMetrics(raw) {
  try {
    const data = JSON.parse(String(raw).replace(/^\uFEFF/, '').trim());
    const keys = ['cpu', 'memUsed', 'memTotal'];
    if (!data || keys.some(k => typeof data[k] !== 'number' || !Number.isFinite(data[k]))) return null;
    if (data.cpu < 0 || data.cpu > 100 || data.memTotal <= 0 || data.memUsed < 0 || data.memUsed > data.memTotal) return null;
    return Object.fromEntries(keys.map(k => [k, data[k]]));
  } catch { return null; }
}
export const gb = n => (n / 1073741824).toFixed(1);
