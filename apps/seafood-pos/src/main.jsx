import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  addDoc, collection, doc, getDoc, getDocs, increment, limit,
  onSnapshot, orderBy, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  Bell, Camera, CheckCircle, ChevronRight, Delete, Edit3,
  Home, LogOut, MapPin, Mic, MicOff, Package, PlusCircle,
  ShoppingCart, Users, X,
} from 'lucide-react';
import { auth, db, storage, isFirebaseReady } from './firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

function dateKeyBangkok(date = new Date()) {
  return new Date(date.getTime() + 7 * 3600000).toISOString().split('T')[0];
}

const CUSTOMERS = [
  { id: 'general', name: 'ลูกค้าทั่วไปและตลาดนัด', zone: 'ทั่วไป' },
  { id: 'c1',  name: 'จ๊ะเขียด',           zone: 'ป่าตอง' },
  { id: 'c2',  name: 'ตาจุ้ยหนึ่ง',           zone: 'ป่าตอง' },
  { id: 'c3',  name: 'ตาจุ้ยสอง',           zone: 'ป่าตอง' },
  { id: 'c4',  name: 'น้องเล็กหนึ่ง',         zone: 'ป่าตอง' },
  { id: 'c5',  name: 'ปุ้ย',               zone: 'ป่าตอง' },
  { id: 'c6',  name: 'ป้าแหวว',            zone: 'ป่าตอง' },
  { id: 'c7',  name: 'ร้านเฟิร์ส',          zone: 'ป่าตอง' },
  { id: 'c8',  name: 'ร้านสองพี่น้องหนึ่ง,    zone: 'ป่าตอง' },
  { id: 'c9',  name: 'ร้านสองพี่น้องสอง',    zone: 'ป่าตอง' },
  { id: 'c10', name: 'ร้านแสนสบาย',         zone: 'ป่าตอง' },
  { id: 'c11', name: 'น้องเล็ก 2',          zone: 'กะทู้'  },
  { id: 'c12', name: 'อีสานรสเด็ด',         zone: 'กะทู้'  },
  { id: 'c13', name: 'โบ๊ทซีฟู้ด',          zone: 'ภูเก็ต' },
  { id: 'c14', name: 'ร้านคุณเชษฐ์',        zone: 'ภูเก็ต' },
  { id: 'c15', name: 'ร้าน มุขมณี',         zone: 'ราไวย์' },
  { id: 'c16', name: 'ร้าน ฟาง',           zone: 'ราไวย์' },
  { id: 'c17', name: 'ร้าน ป้าก้อย',        zone: 'ราไวย์' },
  { id: 'c18', name: 'ร้าน มด',            zone: 'ราไวย์' },
  { id: 'c19', name: 'ร้าน อ้อม',          zone: 'ราไวย์' },
  { id: 'c20', name: 'ร้าน ป้าแมว',         zone: 'ราไวย์' },
  { id: 'c21', name: 'ร้าน เฮง 777',       zone: 'ราไวย์' },
  { id: 'c22', name: 'ร้าน โอเล่',         zone: 'ราไวย์' },
  { id: 'c23', name: 'ร้าน โกห้า',         zone: 'ราไวย์' },
  { id: 'c24', name: 'ร้าน วิทยาซีฟู้ด',   zone: 'ราไวย์' },
  { id: 'c25', name: 'ร้าน ฟลุ๊ค',         zone: 'ราไวย์' },
  { id: 'c26', name: 'ร้าน มุกอันดา',       zone: 'ราไวย์' },
  { id: 'c27', name: 'ร้าน สตูล',          zone: 'ราไวย์' },
];

const PRODUCTS = [
  { id: 'large',  name: 'กุ้งใหญ่,A', emoji: '🦐', type: 'live', price: 1450 },
  { id: 'medium', name: 'กุ้งกลาง,B', emoji: '🦐', type: 'live', price: 1100 },
  { id: 'small',  name: 'กุ้งเล็ก.C',  emoji: '🦐', type: 'live', price: 850  },
  { id: 'dead',   name: 'กุ้งตาย',  emoji: '🦐', type: 'dead', price: 0    },
];

const PAY = [
  { id: 'cash',        label: 'สด',   cls: 'bg-emerald-500' },
  { id: 'transfer',    label: 'โอน',  cls: 'bg-blue-500'    },
  { id: 'credit',      label: 'ค้าง', cls: 'bg-orange-500'  },
  { id: 'installment', label: 'ผ่อน', cls: 'bg-purple-500'  },
];
