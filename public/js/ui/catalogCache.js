// Кэширование справочников на клиенте (раздел 16 ТЗ): бренды и категории живут в localStorage 10 минут.
import api from '../core/api.js';

const TTL = 10 * 60 * 1000;
const inflight = {};

async function cached(key, loader) {
  try {
    const entry = JSON.parse(localStorage.getItem(key) || 'null');
    if (entry && Date.now() - entry.at < TTL) return entry.data;
  } catch {
    /* повреждённый кэш — загрузим заново */
  }
  inflight[key] ||= loader()
    .then((data) => {
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
      } catch {
        /* переполнение хранилища — не критично */
      }
      return data;
    })
    .finally(() => {
      delete inflight[key];
    });
  return inflight[key];
}

export const getBrands = () => cached('amf:cache:brands:v1', async () => (await api.get('/brands')).brands);
export const getCategories = () => cached('amf:cache:categories:v1', async () => (await api.get('/categories')).categories);

export function clearCatalogCache() {
  try {
    localStorage.removeItem('amf:cache:brands:v1');
    localStorage.removeItem('amf:cache:categories:v1');
  } catch {
    /* не критично */
  }
}

// Плоский список подкатегорий: slug → { node, parent }
export async function categoryIndex() {
  const roots = await getCategories();
  const index = new Map();
  const walk = (nodes, parent = null) =>
    nodes.forEach((node) => {
      index.set(node.slug, { node, parent });
      walk(node.children || [], node);
    });
  walk(roots);
  return index;
}
