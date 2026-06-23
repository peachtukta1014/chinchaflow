import { useState, useCallback, useEffect, useMemo } from 'react';
import { fsQueryRestocks } from '../lib/firestoreRest';
import { dateKeyBangkok } from '../lib/constants';
import { isRestockPurchased } from '../lib/restockService';
import {
  bootstrapCatalogFromRestocks,
  fsQueryRestockCatalog,
  groupCatalogByCategory,
  restockNameKey,
} from '../lib/restockCatalogService';
import { RestockForm } from './RestockForm';
import { RestockList } from './RestockList';

function catalogUnitPrice(item) {
  return Math.max(0, Math.round(Number(
    item?.latestUnitPrice ?? item?.purchaseUnitPrice ?? item?.unitPrice ?? 0,
  ) || 0));
}

export function RestockTab({ member, t, lang = 'th', onRestockListChange }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [recentRequests, setRecentRequests] = useState([]);
  const [flash, setFlash] = useState('');
  const dateKey = dateKeyBangkok();
  const isAdmin = member?.role === 'admin';

  const latestPriceByKey = useMemo(() => {
    const map = new Map();
    for (const item of catalog || []) {
      const unitPrice = catalogUnitPrice(item);
      if (unitPrice > 0) map.set(restockNameKey(item.name), unitPrice);
    }
    for (const req of recentRequests || []) {
      if (!isRestockPurchased(req)) continue;
      for (const line of req.purchaseItems || []) {
        const key = restockNameKey(line?.name);
        const unitPrice = Math.max(0, Math.round(Number(line?.unitPrice) || 0));
        if (key && unitPrice > 0 && !map.has(key)) map.set(key, unitPrice);
      }
    }
    return map;
  }, [catalog, recentRequests]);

  const catalogWithPrices = useMemo(
    () => (catalog || []).map((item) => ({
      ...item,
      latestUnitPrice: catalogUnitPrice(item) || latestPriceByKey.get(restockNameKey(item.name)) || 0,
    })),
    [catalog, latestPriceByKey],
  );

  const catalogByKey = useMemo(
    () => new Map((catalog || []).map((item) => [restockNameKey(item.name), item])),
    [catalog],
  );

  const catalogGroups = useMemo(
    () => groupCatalogByCategory(catalogWithPrices, t, lang),
    [catalogWithPrices, t, lang],
  );

  const latestPriceForName = useCallback(
    (name) => latestPriceByKey.get(restockNameKey(name)) || 0,
    [latestPriceByKey],
  );

  const notifyRestockChange = useCallback(() => onRestockListChange?.(), [onRestockListChange]);

  const refreshRecent = useCallback(
    () => fsQueryRestocks(20).then(setRecentRequests).catch(() => {}),
    [],
  );

  const refreshCatalog = useCallback(async (recent) => {
    setCatalogLoading(true);
    try {
      let list = await fsQueryRestockCatalog();
      const history = recent ?? await fsQueryRestocks(20);
      if (list.length === 0 && history.length > 0) {
        await bootstrapCatalogFromRestocks(history, member);
        list = await fsQueryRestockCatalog();
      }
      setCatalog(list);
    } catch (e) {
      console.error(e);
    }
    setCatalogLoading(false);
  }, [member]);

  useEffect(() => {
    refreshRecent();
    refreshCatalog();
  }, [refreshCatalog]);

  return (
    <div className="px-4 pt-3 pb-8 space-y-4">
      <RestockForm
        member={member}
        t={t}
        lang={lang}
        isAdmin={isAdmin}
        dateKey={dateKey}
        catalog={catalog}
        setCatalog={setCatalog}
        catalogLoading={catalogLoading}
        catalogGroups={catalogGroups}
        catalogByKey={catalogByKey}
        latestPriceForName={latestPriceForName}
        flash={flash}
        setFlash={setFlash}
        refreshRecent={refreshRecent}
        refreshCatalog={refreshCatalog}
        notifyRestockChange={notifyRestockChange}
      />
      <RestockList
        member={member}
        t={t}
        lang={lang}
        isAdmin={isAdmin}
        dateKey={dateKey}
        recentRequests={recentRequests}
        setRecentRequests={setRecentRequests}
        catalogByKey={catalogByKey}
        latestPriceForName={latestPriceForName}
        notifyRestockChange={notifyRestockChange}
        refreshCatalog={refreshCatalog}
        setFlash={setFlash}
      />
    </div>
  );
}
