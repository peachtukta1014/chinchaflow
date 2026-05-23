# Seafood POS dateKey patch

สถานะ: เพิ่ม `apps/seafood-pos/src/lib/date.js` แล้ว เหลือผูก helper เข้า `src/main.jsx` แบบ manual patch เท่านั้น เพราะไฟล์ `main.jsx` ใหญ่และมี NBSP จาก copy/paste ทำให้ connector เสี่ยง truncate ถ้า overwrite ทั้งไฟล์

## แก้ใน `apps/seafood-pos/src/main.jsx`

1. ใต้ import firebase:

```js
import { auth, db, storage, isFirebaseReady } from './firebase';
import { dateKeyBangkok, tomorrowDateKeyBangkok } from './lib/date';
```

2. Pending LINE badge:

```diff
- const today = new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
+ const today = dateKeyBangkok();
```

3. Save bill:

```diff
- const dateKey = new Date().toISOString().split('T')[0];
+ const dateKey = dateKeyBangkok();
```

4. Dashboard:

```diff
- const todayKey = new Date().toISOString().split('T')[0];
+ const todayKey = dateKeyBangkok();
```

5. LINE Orders tomorrow:

```diff
- const tomorrow = new Date(Date.now() + 7 * 3600000 + 86400000).toISOString().split('T')[0];
+ const tomorrow = tomorrowDateKeyBangkok();
```

## Commit message

```txt
fix(seafood): use Bangkok date key in sales and dashboard
```

## เหตุผล

- บันทึกบิลใช้ UTC dateKey ทำให้ Dashboard วันนี้ไม่เจอยอดช่วงเวลาไทย
- helper รวม logic เวลาไทยไว้ที่เดียว ลด copy/paste date formula
