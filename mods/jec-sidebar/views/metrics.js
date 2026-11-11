export function parseMetrics(raw) {
  try {
    const data = JSON.parse(String(raw).replace(/^\uFEFF/, '').trim());
    const keys = ['cpu', 'memUsed', 'memTotal'];
    if (!data) return null;
    const values = Object.fromEntries(keys.map(k => {
      const value = data[k];
      if (typeof value === 'number') return [k, value];
      if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return [k, NaN];
      return [k, Number(value)];
    }));
    if (keys.some(k => !Number.isFinite(values[k]))) return null;
    if (values.cpu < 0 || values.cpu > 100 || values.memTotal <= 0 || values.memUsed < 0 || values.memUsed > values.memTotal) return null;
    return values;
  } catch { return null; }
}
export const gb = n => (n / 1073741824).toFixed(1);
