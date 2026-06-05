/**
 * ออเดอร์ LINE แบบ real-time (Firestore onSnapshot) — listener เดียวแชร์ทั้งแอป
 * ล้มเหลว → fallback REST แบบ fetchLineOrdersForBoard
 */
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseReady } from '../firebase';
import { boardLineOrdersFromRows } from './lineOrderBoard';
import { countPendingLineOrdersForBadge } from './lineOrderBadge';
import { fetchLineOrdersForBoard } from '../services/lineOrderService';

const REST_FALLBACK_MS = 60_000;

let boardRows = [];
let boardReady = false;
let usingRealtime = false;
let restTimer = null;
let unsubPending = null;
let unsubDelivering = null;
const subscribers = new Set();

function docToRow(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

function mergeStatusSnapshots(pendingDocs, deliveringDocs) {
  const seen = new Set();
  const merged = [];
  for (const docSnap of [...pendingDocs, ...deliveringDocs]) {
    if (seen.has(docSnap.id)) continue;
    seen.add(docSnap.id);
    merged.push(docToRow(docSnap));
  }
  return boardLineOrdersFromRows(merged);
}

function notify() {
  for (const fn of subscribers) {
    try {
      fn(boardRows, { ready: boardReady, realtime: usingRealtime });
    } catch (e) {
      console.warn('subscribeLineOrdersBoard callback', e);
    }
  }
}

function setBoard(rows, { ready = true, realtime = usingRealtime } = {}) {
  boardRows = rows;
  boardReady = ready;
  usingRealtime = realtime;
  notify();
}

function clearRestFallback() {
  if (restTimer) {
    clearInterval(restTimer);
    restTimer = null;
  }
}

function teardownSnapshots() {
  unsubPending?.();
  unsubDelivering?.();
  unsubPending = null;
  unsubDelivering = null;
}

async function pullRestBoard() {
  try {
    const rows = await fetchLineOrdersForBoard();
    setBoard(rows, { ready: true, realtime: false });
  } catch (e) {
    console.warn('lineOrdersFeed REST fallback', e);
    setBoard(boardRows, { ready: boardReady, realtime: false });
  }
}

function startRestFallback() {
  teardownSnapshots();
  usingRealtime = false;
  if (!restTimer) {
    pullRestBoard();
    restTimer = setInterval(pullRestBoard, REST_FALLBACK_MS);
  }
}

let pendingDocs = [];
let deliveringDocs = [];

function applyMergedSnapshots() {
  setBoard(mergeStatusSnapshots(pendingDocs, deliveringDocs), { ready: true, realtime: true });
}

function startRealtime() {
  if (!db || !isFirebaseReady) {
    startRestFallback();
    return;
  }

  clearRestFallback();
  pendingDocs = [];
  deliveringDocs = [];

  const col = collection(db, 'lineOrders');
  const qPending = query(col, where('status', '==', 'pending'));
  const qDelivering = query(col, where('status', '==', 'delivering'));

  unsubPending = onSnapshot(
    qPending,
    (snap) => {
      pendingDocs = snap.docs;
      applyMergedSnapshots();
    },
    (err) => {
      console.warn('lineOrders pending snapshot', err);
      startRestFallback();
    },
  );

  unsubDelivering = onSnapshot(
    qDelivering,
    (snap) => {
      deliveringDocs = snap.docs;
      applyMergedSnapshots();
    },
    (err) => {
      console.warn('lineOrders delivering snapshot', err);
      startRestFallback();
    },
  );

  usingRealtime = true;
}

function ensureFeed() {
  if (unsubPending || unsubDelivering || restTimer) return;
  if (!boardReady) setBoard([], { ready: false, realtime: false });
  startRealtime();
}

function teardownFeed() {
  teardownSnapshots();
  clearRestFallback();
  boardReady = false;
  usingRealtime = false;
  pendingDocs = [];
  deliveringDocs = [];
}

/**
 * @param {(rows: Array, meta: { ready: boolean, realtime: boolean }) => void} onData
 * @returns {() => void} unsubscribe
 */
export function subscribeLineOrdersBoard(onData) {
  subscribers.add(onData);
  ensureFeed();
  onData(boardRows, { ready: boardReady, realtime: usingRealtime });

  return () => {
    subscribers.delete(onData);
    if (subscribers.size === 0) teardownFeed();
  };
}

export function getLineOrdersBoardSnapshot() {
  return {
    rows: boardRows,
    ready: boardReady,
    realtime: usingRealtime,
  };
}

export function countLineOrdersBoardBadge(rows = boardRows) {
  return countPendingLineOrdersForBadge(rows);
}
