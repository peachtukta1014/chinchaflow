import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_MENU, DEFAULT_TOPPINGS } from './constants';
import { cachedFetch, invalidateCache } from './fetchCache';
import { fsQueryProducts, fsQueryToppings } from './firestoreRest';

export const CATALOG_CACHE_KEY = 'catalog:products+toppings';
export const CATALOG_TTL_MS = 5 * 60 * 1000;

export function useCatalog(enabled) {
  const [menuItems, setMenuItems] = useState(DEFAULT_MENU);
  const [toppingsList, setToppingsList] = useState(DEFAULT_TOPPINGS);

  const refresh = useCallback(async (force = false) => {
    if (!enabled) return;
    try {
      if (force) invalidateCache(CATALOG_CACHE_KEY);
      const [products, toppings] = await cachedFetch(
        CATALOG_CACHE_KEY,
        () => Promise.all([fsQueryProducts(), fsQueryToppings()]),
        CATALOG_TTL_MS,
      );
      if (products.length) setMenuItems(products);
      if (toppings.length) setToppingsList(toppings.filter((t) => t.active !== false));
    } catch (e) {
      console.error(e);
    }
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  return { menuItems, toppingsList, refreshCatalog: () => refresh(true) };
}
