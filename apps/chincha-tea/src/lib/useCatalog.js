import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_MENU, DEFAULT_TOPPINGS } from './constants';
import { fsQueryProducts, fsQueryToppings } from './firestoreRest';

export function useCatalog(enabled) {
  const [menuItems, setMenuItems] = useState(DEFAULT_MENU);
  const [toppingsList, setToppingsList] = useState(DEFAULT_TOPPINGS);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [products, toppings] = await Promise.all([fsQueryProducts(), fsQueryToppings()]);
      if (products.length) setMenuItems(products);
      if (toppings.length) setToppingsList(toppings.filter((t) => t.active !== false));
    } catch (e) {
      console.error(e);
    }
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  return { menuItems, toppingsList, refreshCatalog: refresh };
}
