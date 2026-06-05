import { useCallback, useEffect, useState } from 'react';
import { subscribeLineOrdersBoard } from '../lib/lineOrdersFeed';
import { fetchLineOrdersForBoard } from '../services/lineOrderService';

/**
 * รายการออเดอร์ LINE บนบอร์ด — real-time ถ้า Firestore listener ใช้ได้
 * @param {boolean} enabled
 */
export function useLineOrdersFeed(enabled = true) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [realtime, setRealtime] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setLoading(false);
      setRealtime(false);
      return undefined;
    }

    return subscribeLineOrdersBoard((rows, { ready, realtime: rt }) => {
      setOrders(rows);
      setLoading(!ready);
      setRealtime(rt);
    });
  }, [enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) return [];
    const rows = await fetchLineOrdersForBoard();
    setOrders(rows);
    setLoading(false);
    return rows;
  }, [enabled]);

  return { orders, loading, realtime, refresh };
}
