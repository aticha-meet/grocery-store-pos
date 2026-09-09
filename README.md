<div align="center">

# 🏪 บ้านร้าน POS

**ระบบขายหน้าร้านภาษาไทย สำหรับร้านชำและร้านค้าปลีกขนาดเล็ก**

[![Platform](https://img.shields.io/badge/Platform-Windows-0078d4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tauri](https://img.shields.io/badge/Tauri-2-ffc131?style=for-the-badge&logo=tauri&logoColor=black)](https://tauri.app)
[![SQLite](https://img.shields.io/badge/SQLite-Prisma-003b57?style=for-the-badge&logo=sqlite&logoColor=white)](https://prisma.io)

<br/>

> ทำงาน **Offline-first** — ข้อมูลเก็บในเครื่อง ไม่ต้องใช้อินเทอร์เน็ตหลังติดตั้ง
> รองรับทั้ง **เว็บเบราว์เซอร์** และ **แอปเดสก์ท็อป (Windows)**

</div>

---

## 📥 ดาวน์โหลดและติดตั้ง

> **รุ่นล่าสุด: v0.2.0** — ทดสอบแล้วบน Windows 10/11 (x64)

| ไฟล์                               | ขนาด   | คำอธิบาย                                                                     |
| ---------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `Baan Ran POS_0.2.0_x64-setup.exe` | ~38 MB | ตัวติดตั้ง Windows 64-bit (NSIS) ที่ `src-tauri/target/release/bundle/nsis/` |

### ✅ สิ่งที่รวมมาในตัวติดตั้ง

- Node.js runtime (bundled — ไม่ต้องติดตั้งแยก)
- Express API server + Prisma native engine
- React frontend (pre-built) + ฟอนต์ภาษาไทย (Noto Sans Thai)
- Database migrations

### ⚠️ ข้อควรทราบก่อนติดตั้ง

- ต้องมี **WebView2 Runtime** — จะดาวน์โหลดอัตโนมัติหากยังไม่มีในเครื่อง
- ตัวติดตั้ง **ยังไม่มี code signing** — Windows อาจแสดงคำเตือน SmartScreen ให้กด "More info → Run anyway"
- หลังติดตั้ง ข้อมูลร้านจะเก็บที่ `%LOCALAPPDATA%\com.baanran.pos\`

### 🗂️ ตำแหน่งข้อมูลหลังติดตั้ง

```
%LOCALAPPDATA%\com.baanran.pos\
├── store.db          ← ฐานข้อมูลร้าน
├── backups/          ← ไฟล์สำรองข้อมูลอัตโนมัติ
└── server.log        ← log ของ backend
```

---

## ✨ สิ่งที่ทำได้

### 🛒 ขายหน้าร้าน

- เลือกสินค้าจากหน้าจอ หรือสแกน/กรอกบาร์โค้ด
- ค้นหาจากชื่อ/บาร์โค้ด กรองหมวดหมู่ เพิ่ม/ลดจำนวน ลบรายการ ล้างบิล
- หน้าคิดเงินแยก รองรับเงินสดและไทยช่วยไทย ตั้งเปอร์เซ็นต์รัฐ/ลูกค้าได้ รวม 100% และเก็บอัตราตามแต่ละบิล
- ส่วนลดทั้งบิล คำนวณเงินทอนจากส่วนลูกค้า ป้องกันเงินรับไม่พอ ดูวิธีใช้และข้อเสนอใน [SUGGESTIONS.md](SUGGESTIONS.md)
- ตะกร้าคงอยู่เมื่อสลับหน้าหรือเปิดแอปใหม่ใน browser profile เดิม

### 📦 จัดการสินค้าและสต็อก

- เพิ่ม/แก้ไข/ซ่อนสินค้า (soft delete) รับสินค้าเข้า ปรับสต็อกพร้อมระบุเหตุผลและผู้ทำรายการ
- แจ้งเตือนเมื่อสต็อกเป็น 0 หรือต่ำกว่าจุดสั่งซื้อ + หน้ารวมสินค้าใกล้หมด
- บันทึกสต็อก, บิล และ StockMovement ใน transaction เดียว

### 📊 รายงานและประวัติ

- รายงานวัน/เดือน/ปี ตามเวลา Asia/Bangkok กราฟแนวโน้ม สินค้าขายดี/ขายน้อย
- ส่งออก CSV ดู 100 บิลล่าสุด พิมพ์ใบเสร็จซ้ำ คืนทั้งบิลโดยเจ้าของร้านพร้อมคืนสต็อก

### 🔐 ความปลอดภัยและบัญชี

- บัญชีเจ้าของร้าน (owner) และพนักงาน (cashier) รหัสผ่านผ่าน scrypt, HttpOnly session cookie
- จำกัดความถี่การลองรหัสผ่าน (10 ครั้ง/นาที/IP)
- สำรองฐานข้อมูลอัตโนมัติวันละครั้ง + สำรองด้วยตนเองทุกเมื่อ

---

## ⌨️ คีย์ลัด

| คีย์      | การทำงาน                               |
| --------- | -------------------------------------- |
| **F2**    | โฟกัสช่องค้นหาสินค้า                   |
| **F4**    | เปิดหน้าต่างรับชำระเงิน                |
| **Enter** | เพิ่มสินค้าตามบาร์โค้ดที่ตรงกัน        |
| **Esc**   | ปิดหน้าต่าง (ยกเว้นบิลที่ยังไม่ทราบผล) |

> เครื่องสแกนบาร์โค้ด: ตั้งเป็น USB HID keyboard พร้อม Enter suffix

---

## 🚀 เริ่มต้นใช้งาน (จาก Source)

> ต้องมี **Node.js 24+** และ **npm**

### ทดลองใช้งาน (Demo Mode)

```powershell
npm ci
npm run setup
npm run build
npm run demo
```

เปิด [http://127.0.0.1:3002](http://127.0.0.1:3002) และเข้าสู่ระบบด้วย `demo` / `demo-store-2026`

> ร้านทดลองมีสินค้า 18 รายการ ใช้ฐานข้อมูลแยก (`prisma/demo.db`) ห้ามใช้สำหรับงานจริง

### เริ่มร้านของคุณ

```powershell
npm run setup
npm run build
npm start
```

เปิด [http://127.0.0.1:3001](http://127.0.0.1:3001) และสร้างบัญชีเจ้าของร้านในหน้าตั้งค่าครั้งแรก

### พัฒนาต่อ (Dev Mode)

```powershell
npm run dev
# เปิด http://127.0.0.1:5173
```

> ⚠️ อย่าเปิด `npm start` และ `npm run dev` พร้อมกัน เพราะใช้พอร์ต API เดียวกัน

---

## 🖥️ Desktop App (Tauri)

> ต้องมี **Rust stable** (`x86_64-pc-windows-msvc`), **Visual Studio C++ Build Tools** และ **WebView2**

```powershell
# Development
npm run setup
npm run desktop:dev

# สร้างตัวติดตั้ง
npm run desktop:build
# ผลลัพธ์: src-tauri/target/release/bundle/nsis/
```

ตัว Desktop เปิด/ปิด backend อัตโนมัติพร้อมหน้าต่าง และตรวจ parent process เพื่อป้องกัน backend ค้างเมื่อปิดผิดปกติ

---

## 💾 สำรองและกู้คืนข้อมูล

**สำรองข้อมูล:** ไปที่ **ตั้งค่าร้าน → สำรองข้อมูลตอนนี้**
ระบบสำรองอัตโนมัติวันละครั้ง และตรวจทุก 5 นาทีเมื่อแอปเปิดอยู่

**กู้คืนข้อมูล:**

1. ปิด Desktop หรือหยุด backend ทุก instance
2. เก็บสำเนา `store.db` เดิมและไฟล์ `-wal` / `-shm` ไว้ในโฟลเดอร์แยก
3. นำ `store.db` เดิมพร้อม `-wal` / `-shm` ออกจากตำแหน่งใช้งาน
4. คัดลอกไฟล์สำรองที่ต้องการเป็น `store.db` ในตำแหน่งฐานข้อมูล
5. เปิดแอปใหม่ ตรวจสินค้าคงเหลือและบิลล่าสุดก่อนเริ่มขาย

> ⚠️ อย่าคัดลอก `store.db` ขณะ backend ยังเปิดอยู่ — ใช้ปุ่มสำรองเพื่อ snapshot ที่สมบูรณ์

---

## 🧪 การทดสอบ

```powershell
npm test
npm run build
npm run desktop:prepare
npm test
```

ชุดทดสอบ API ใช้ SQLite ชั่วคราวใน `test-results-*` ทดสอบ: atomic checkout, retries, validation, สิทธิ์, คืนสินค้า, snapshot ราคาทุน, เขตเวลา และ backup integrity

> **ผลการตรวจ 7 กันยายน 2026:** TypeScript/production build ✅ | Tests 11/11 ✅ | Rust/Tauri release ✅ | NSIS installer ✅ | Native executable เริ่ม bundled backend ได้จริง ✅

---

## 📁 โครงสร้างโปรเจกต์

```
Store-app/
├── src/                    # Frontend (React + TypeScript)
│   ├── main.tsx            # Entry point ของ React
│   ├── App.tsx             # Root component, routing, auth state
│   ├── POS.tsx             # หน้าขายหน้าร้าน (Point of Sale)
│   ├── Inventory.tsx       # หน้าจัดการคลังสินค้า + แจ้งเตือนสินค้าใกล้หมด
│   ├── Management.tsx      # Reports, SalesHistory, SettingsPage
│   ├── components.tsx      # Shared UI components (Modal ฯลฯ)
│   ├── types.ts            # TypeScript types + utility functions
│   └── styles.css          # Global CSS styles
│
├── server/                 # Backend (Express + TypeScript)
│   ├── index.ts            # Entry point: HTTP server, static files, lifecycle
│   ├── app.ts              # Express app: ทุก API routes
│   ├── db.ts                # Prisma Client instance
│   ├── security.ts         # Password hashing (scrypt)
│   ├── backup.ts           # Backup อัตโนมัติรายวัน + manual backup
│   └── demo.ts              # ข้อมูลสินค้าตัวอย่างสำหรับ demo
│
├── prisma/                 # Database schema & migrations
│   ├── schema.prisma       # Prisma schema (SQLite)
│   └── migrations/         # Migration files
│
├── src-tauri/              # Tauri Desktop App (Rust)
│   ├── tauri.conf.json     # Tauri configuration
│   ├── Cargo.toml          # Rust dependencies
│   ├── src/                # Rust source
│   ├── capabilities/       # Tauri permission capabilities
│   ├── icons/              # App icons
│   └── resources/          # Bundled resources (server binary)
│
├── scripts/                # Build & setup scripts (Node.js)
│   ├── setup.mjs            # Initial project setup
│   ├── ensure-db.mjs        # ตรวจสอบ/สร้าง database ก่อน migrate
│   ├── prepare-desktop.mjs # เตรียม binary สำหรับ Tauri build
│   ├── demo.mjs              # รัน demo mode
│   └── smoke-native.ps1    # PowerShell smoke test สำหรับ native build
│
├── tests/                  # Automated Tests
│   ├── api.test.ts         # Integration tests สำหรับทุก API endpoints
│   └── desktop.test.ts     # Tests สำหรับ Tauri desktop app
│
├── backups/                # ไฟล์ backup database (auto-generated)
├── dist/                   # Frontend build output (auto-generated)
├── dist-server/            # Server build output (auto-generated)
├── public/                 # Static assets
│
├── index.html              # HTML entry point (Vite)
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript config (frontend)
├── tsconfig.server.json    # TypeScript config (server)
├── package.json            # npm scripts & dependencies
├── .env                     # Environment variables (ไม่ commit)
└── .env.example             # ตัวอย่าง environment variables
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Client (Browser)               │
│  React 19 + TypeScript                          │
│  ┌──────────┬───────────┬──────────────────┐   │
│  │  POS.tsx │Inventory  │  Management.tsx   │   │
│  │ (ขายหน้า │ .tsx      │ (Reports/Sales/  │   │
│  │  ร้าน)   │(คลังสินค้า)│  Settings)       │   │
│  └──────────┴───────────┴──────────────────┘   │
│              App.tsx (Root + Auth)              │
└─────────────────────┬───────────────────────────┘
                      │ HTTP /api/*
┌─────────────────────▼───────────────────────────┐
│              Express Server (Node.js)            │
│  server/app.ts — REST API routes                │
│  server/security.ts — Auth (scrypt)             │
│  server/backup.ts — Daily auto backup           │
└─────────────────────┬───────────────────────────┘
                      │ Prisma ORM
┌─────────────────────▼───────────────────────────┐
│              SQLite Database                     │
│  prisma/store.db (ข้อมูลร้านจริง)               │
│  prisma/demo.db  (ข้อมูล demo)                  │
└─────────────────────────────────────────────────┘
```

**Desktop Mode (Tauri):** Express server ถูก bundle เป็น binary ไว้ใน `src-tauri/resources/` และถูกเรียกใช้จาก Rust เมื่อเปิดแอป

---

## 🗄️ Database Schema

### `User` — ผู้ใช้งาน

| Field          | Type            | Description                    |
| -------------- | --------------- | ------------------------------ |
| `id`           | String (cuid)   | Primary key                    |
| `name`         | String          | ชื่อแสดงผล                     |
| `username`     | String (unique) | ชื่อผู้ใช้ login               |
| `passwordHash` | String          | รหัสผ่านที่ผ่าน scrypt hashing |
| `role`         | String          | `"owner"` หรือ `"cashier"`     |

### `Product` — สินค้า

| Field              | Type            | Description                         |
| ------------------ | --------------- | ----------------------------------- |
| `id`               | String (cuid)   | Primary key                         |
| `name`             | String          | ชื่อสินค้า                          |
| `barcode`          | String (unique) | บาร์โค้ด                            |
| `category`         | String          | หมวดหมู่สินค้า                      |
| `costPrice`        | Int             | ราคาทุน (หน่วย: สตางค์)             |
| `sellPrice`        | Int             | ราคาขาย (หน่วย: สตางค์)             |
| `unit`             | String          | หน่วยนับ (ชิ้น, ขวด, ฯลฯ)           |
| `stockQty`         | Int             | จำนวนสต็อกคงเหลือ                   |
| `reorderThreshold` | Int             | จุดสั่งซื้อ (แจ้งเตือนเมื่อต่ำกว่า) |
| `icon`             | String          | Emoji icon (default: 📦)            |
| `active`           | Boolean         | Soft delete flag                    |

### `Sale` — บิลการขาย

| Field             | Type            | Description                    |
| ----------------- | --------------- | ------------------------------ |
| `id`              | String (cuid)   | Primary key                    |
| `requestId`       | String (unique) | UUID สำหรับ idempotent request |
| `totalAmount`     | Int             | ยอดรวมสุทธิ (หน่วย: สตางค์)    |
| `discount`        | Int             | ส่วนลด                         |
| `paymentReceived` | Int             | เงินที่รับมา                   |
| `change`          | Int             | เงินทอน                        |
| `cashier`         | String          | ชื่อพนักงาน                    |
| `createdAt`       | DateTime        | วันเวลาขาย                     |
| `returnedAt`      | DateTime?       | วันที่คืนสินค้า                |
| `returnReason`    | String?         | เหตุผลการคืน                   |
| `returnedBy`      | String?         | ชื่อผู้อนุมัติคืน              |

### `SaleItem` — รายการสินค้าในบิล

| Field       | Type   | Description                     |
| ----------- | ------ | ------------------------------- |
| `saleId`    | String | FK → Sale                       |
| `productId` | String | FK → Product                    |
| `name`      | String | ชื่อสินค้า ณ เวลาขาย (snapshot) |
| `quantity`  | Int    | จำนวนที่ขาย                     |
| `unitPrice` | Int    | ราคาต่อหน่วย ณ เวลาขาย          |
| `costPrice` | Int    | ราคาทุน ณ เวลาขาย               |
| `subtotal`  | Int    | ยอดรวมรายการนี้                 |

> **หมายเหตุ:** ราคาทุกตัวเก็บเป็น **สตางค์** (integer) เพื่อหลีกเลี่ยงปัญหา floating-point เช่น ราคา 25.50 บาท = `2550`

---

## 🌐 API Endpoints

Base URL: `http://127.0.0.1:3001/api`

### Authentication

| Method | Endpoint   | Auth | Description                        |
| ------ | ---------- | ---- | ---------------------------------- |
| GET    | `/session` | —    | ดึงข้อมูล session ปัจจุบัน         |
| POST   | `/setup`   | —    | ตั้งค่าร้านครั้งแรก (สร้าง owner)  |
| POST   | `/login`   | —    | เข้าสู่ระบบ (cookie-based session) |
| POST   | `/logout`  | ✅   | ออกจากระบบ                         |
| GET    | `/health`  | —    | Health check                       |

### Products

| Method | Endpoint            | Auth  | Description                       |
| ------ | ------------------- | ----- | --------------------------------- |
| GET    | `/products`         | ✅    | ดูสินค้าทั้งหมด (active เท่านั้น) |
| POST   | `/products`         | owner | เพิ่มสินค้าใหม่                   |
| PUT    | `/products/:id`     | owner | แก้ไขข้อมูลสินค้า                 |
| DELETE | `/products/:id`     | owner | ซ่อนสินค้า (soft delete)          |
| GET    | `/alerts/low-stock` | ✅    | สินค้าที่ stock ต่ำกว่า threshold |

### Stock Movements

| Method | Endpoint           | Auth  | Description                                   |
| ------ | ------------------ | ----- | --------------------------------------------- |
| GET    | `/stock-movements` | owner | ดู log ความเคลื่อนไหวสต็อก (200 รายการล่าสุด) |
| POST   | `/stock-movements` | owner | รับสินค้าเข้า / ปรับสต็อก                     |

### Sales

| Method | Endpoint            | Auth  | Description                              |
| ------ | ------------------- | ----- | ---------------------------------------- |
| GET    | `/sales`            | ✅    | ดูประวัติการขาย (100 รายการล่าสุด)       |
| POST   | `/sales`            | ✅    | บันทึกการขาย (idempotent ด้วย requestId) |
| POST   | `/sales/:id/return` | owner | คืนสินค้าทั้งบิล                         |

### Reports & Backup

| Method | Endpoint          | Auth  | Description                               |
| ------ | ----------------- | ----- | ----------------------------------------- |
| GET    | `/reports`        | owner | รายงานยอดขาย + กราฟ + top/bottom products |
| GET    | `/reports/export` | owner | Export CSV                                |
| POST   | `/backup`         | owner | สร้าง backup ทันที                        |
| GET    | `/backup/status`  | owner | สถานะ auto backup ล่าสุด                  |

---

## ⚙️ Environment Variables

สร้างจาก `.env.example`:

| Variable         | Default           | Description                               |
| ---------------- | ----------------- | ----------------------------------------- |
| `DATABASE_URL`   | `file:./store.db` | Path ไปยัง SQLite database                |
| `PORT`           | `3001`            | Port ของ Express server                   |
| `BACKUP_DIR`     | `backups/`        | Directory สำหรับเก็บ backup files         |
| `POS_DEMO`       | —                 | ตั้งเป็น `"1"` เพื่อใช้ demo database     |
| `POS_PARENT_PID` | —                 | PID ของ parent process (ใช้ใน Tauri mode) |

---

## 📜 npm Scripts

```bash
npm run dev              # รัน development: server + vite พร้อมกัน
npm run build            # Build production: TypeCheck + Vite + tsc server
npm run start            # รัน production server (ต้อง build ก่อน)
npm run setup            # Initial setup
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Apply database migrations
npm test                 # รัน integration tests
npm run demo             # รัน demo mode
npm run desktop:dev      # Tauri development mode
npm run desktop:prepare  # Build + prepare สำหรับ Tauri
npm run desktop:build    # Build Tauri desktop app (.exe + installer)
```

---

## 📦 Dependencies หลัก

### Production

| Package                      | Version  | Purpose             |
| ---------------------------- | -------- | ------------------- |
| `react` + `react-dom`        | ^19.1.0  | UI framework        |
| `express`                    | ^5.1.0   | HTTP server         |
| `@prisma/client`             | 6.19.0   | Database ORM        |
| `zod`                        | ^3.25.0  | Request validation  |
| `recharts`                   | ^3.1.0   | Charts สำหรับรายงาน |
| `lucide-react`               | ^0.468.0 | Icon library        |
| `@fontsource/noto-sans-thai` | ^5.2.5   | Thai font           |

### Development

| Package           | Version | Purpose                      |
| ----------------- | ------- | ---------------------------- |
| `vite`            | ^6.3.0  | Frontend bundler             |
| `typescript`      | ^5.9.0  | Type checking                |
| `tsx`             | ^4.20.0 | Run TypeScript (server dev)  |
| `prisma`          | 6.19.0  | Database schema & migrations |
| `@tauri-apps/cli` | ^2.11.4 | Desktop app build tool       |
| `supertest`       | ^7.1.4  | HTTP integration testing     |

---

## 🔐 Security

| ด้าน                 | วิธีการ                                                          |
| -------------------- | ---------------------------------------------------------------- |
| **Session**          | Cookie-based (`httpOnly`, `sameSite: strict`), อายุ 12 ชั่วโมง   |
| **Password**         | `scrypt` hashing (salt + 64-byte digest) ไม่มี dependency ภายนอก |
| **Rate Limiting**    | Login จำกัด 10 ครั้ง/นาที ต่อ IP                                 |
| **CORS**             | เปิดให้เฉพาะ `127.0.0.1` / `localhost` เท่านั้น                  |
| **CSP Headers**      | Content-Security-Policy แบบ strict                               |
| **Idempotent Sales** | ใช้ `requestId` (UUID) ป้องกันการบันทึกซ้ำ                       |
| **Role Guard**       | `owner` middleware ป้องกัน endpoint ที่ต้องการสิทธิ์สูง          |

---

## 📐 Data Flow — การขายสินค้า

```
User คลิกสินค้า / สแกนบาร์โค้ด
        ↓
POS.tsx — เพิ่มลงตะกร้า CartItem[]
        ↓
กด "รับชำระเงิน" (F4)
        ↓
POST /api/sales { requestId, items, discount, paymentReceived }
        ↓
Server: ตรวจสอบราคา + สต็อก (ใน Transaction)
        ↓
สร้าง Sale + SaleItem + StockMovement (type: 'out')
        ↓
ลด stockQty ของแต่ละ Product
        ↓
Response → แสดง receipt + ล้างตะกร้า
```

---

รายละเอียดขอบเขต ข้อเสนอ และงานที่ต้องลองกับฮาร์ดแวร์อยู่ใน [SUGGESTIONS.md](SUGGESTIONS.md)

_อัปเดตล่าสุด: กันยายน 2026_
