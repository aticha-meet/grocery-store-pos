# 📁 โครงสร้างโปรเจกต์ — บ้านร้าน POS

ระบบ Point-of-Sale (POS) สำหรับร้านค้าปลีกขนาดเล็ก ทำงานบนเครื่องแบบ **Offline-first** ข้อมูลเก็บในเครื่อง รองรับทั้งเว็บเบราว์เซอร์และแอปเดสก์ท็อป (Tauri)

---

## 🗂️ โครงสร้างไดเรกทอรีทั้งหมด

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
│   ├── app.ts              # Express app: middleware + ประกอบ modules
│   └── pkg/                # API แยกตาม feature
│       ├── users/          # controller, service, module + password/demo
│       ├── health/         # controller, service, module
│       ├── products/       # controller, service, module
│       ├── stock/          # controller, service, module
│       ├── payments/       # controller, service, module
│       ├── sales/          # controller, service, module
│       ├── reports/        # controller, service, module
│       ├── backup/         # controller, service, module
│       ├── database/       # Prisma singleton
│       ├── config/         # Environment
│       ├── shared/         # Validation
│       └── http/           # HTTP middleware + error handler
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
│   ├── setup.mjs           # Initial project setup
│   ├── ensure-db.mjs       # ตรวจสอบ/สร้าง database ก่อน migrate
│   ├── prepare-desktop.mjs # เตรียม binary สำหรับ Tauri build
│   ├── demo.mjs            # รัน demo mode
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
├── .env                    # Environment variables (ไม่ commit)
└── .env.example            # ตัวอย่าง environment variables
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
│  server/app.ts — middleware + module composition │
│  server/pkg/users — controller/service      │
│  server/pkg/users/password.service.ts — Auth (scrypt)             │
│  server/pkg/backup/backup.service.ts — Daily auto backup           │
└─────────────────────┬───────────────────────────┘
                      │ Prisma ORM
┌─────────────────────▼───────────────────────────┐
│              SQLite Database                     │
│  prisma/store.db (ข้อมูลร้านจริง)               │
│  prisma/demo.db  (ข้อมูล demo)                  │
└─────────────────────────────────────────────────┘
```

**Desktop Mode (Tauri):** Express server ถูก bundle เป็น binary ไว้ใน `src-tauri/resources/` และถูกเรียกใช้จาก Rust เมื่อเปิดแอป

### รูปแบบ API package

แต่ละ feature ใหม่ควรมีโฟลเดอร์ของตัวเอง เช่น `server/pkg/users/`:

- `*.controller.ts` รับ HTTP request/response และแปลงผลลัพธ์เป็น JSON
- `*.service.ts` เก็บ validation, business logic, Prisma และ security ที่เกี่ยวข้อง
- `*.module.ts` สร้าง service/controller และ register routes กับ Express

`server/app.ts` จึงทำหน้าที่ประกอบ middleware และ modules เป็นหลัก ไม่ควรเพิ่ม business logic ของ feature ใหม่ลงในไฟล์เดียวอีก

---

## 🗄️ Database Schema (Prisma / SQLite)

### `User` — ผู้ใช้งานระบบ
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `name` | String | ชื่อแสดงผล |
| `username` | String (unique) | ชื่อผู้ใช้ login |
| `passwordHash` | String | รหัสผ่านที่ผ่าน scrypt hashing |
| `role` | String | `"owner"` หรือ `"cashier"` |

### `Product` — สินค้า
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `name` | String | ชื่อสินค้า |
| `barcode` | String (unique) | บาร์โค้ด |
| `category` | String | หมวดหมู่สินค้า |
| `costPrice` | Int | ราคาทุน (หน่วย: สตางค์) |
| `sellPrice` | Int | ราคาขาย (หน่วย: สตางค์) |
| `unit` | String | หน่วยนับ (ชิ้น, ขวด, ฯลฯ) |
| `stockQty` | Int | จำนวนสต็อกคงเหลือ |
| `reorderThreshold` | Int | จุดสั่งซื้อ (แจ้งเตือนเมื่อต่ำกว่า) |
| `icon` | String | Emoji icon (default: 📦) |
| `active` | Boolean | Soft delete flag |

### `StockMovement` — ความเคลื่อนไหวสต็อก
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `productId` | String | FK → Product |
| `type` | String | `"in"`, `"out"`, `"adjust"`, `"return"` |
| `quantity` | Int | จำนวน (ติดลบได้กรณี adjust) |
| `note` | String | หมายเหตุ |
| `actor` | String | ชื่อผู้ดำเนินการ |
| `createdAt` | DateTime | วันเวลาที่บันทึก |

### `Sale` — บิลการขาย
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `requestId` | String (unique) | UUID สำหรับ idempotent request |
| `totalAmount` | Int | ยอดรวมสุทธิ (หน่วย: สตางค์) |
| `discount` | Int | ส่วนลด |
| `paymentReceived` | Int | เงินที่รับมา |
| `change` | Int | เงินทอน |
| `cashier` | String | ชื่อพนักงาน |
| `createdAt` | DateTime | วันเวลาขาย |
| `returnedAt` | DateTime? | วันที่คืนสินค้า (null = ยังไม่คืน) |
| `returnReason` | String? | เหตุผลการคืน |
| `returnedBy` | String? | ชื่อผู้อนุมัติคืน |

### `SaleItem` — รายการสินค้าในบิล
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `saleId` | String | FK → Sale |
| `productId` | String | FK → Product |
| `name` | String | ชื่อสินค้า ณ เวลาขาย (snapshot) |
| `barcode` | String | บาร์โค้ด ณ เวลาขาย |
| `quantity` | Int | จำนวนที่ขาย |
| `unitPrice` | Int | ราคาต่อหน่วย ณ เวลาขาย |
| `costPrice` | Int | ราคาทุน ณ เวลาขาย |
| `subtotal` | Int | ยอดรวมรายการนี้ |

> **หมายเหตุ:** ราคาทุกตัวเก็บเป็น **สตางค์** (integer) เพื่อหลีกเลี่ยง floating-point ปัญหา เช่น ราคา 25.50 บาท = `2550`

---

## 🌐 API Endpoints

Base URL: `http://127.0.0.1:3001/api` (dev: proxy จาก Vite port 5173)

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/session` | — | ดึงข้อมูล session ปัจจุบัน |
| POST | `/setup` | — | ตั้งค่าร้านครั้งแรก (สร้าง owner) |
| POST | `/login` | — | เข้าสู่ระบบ (cookie-based session) |
| POST | `/logout` | ✅ | ออกจากระบบ |
| GET | `/health` | — | Health check |

### Users (Owner only)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | owner | ดูรายชื่อผู้ใช้ทั้งหมด |
| POST | `/users` | owner | เพิ่มพนักงาน (cashier) |

### Products
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | ✅ | ดูสินค้าทั้งหมด (active เท่านั้น) |
| POST | `/products` | owner | เพิ่มสินค้าใหม่ |
| PUT | `/products/:id` | owner | แก้ไขข้อมูลสินค้า (ไม่รวม stock) |
| DELETE | `/products/:id` | owner | ซ่อนสินค้า (soft delete) |
| GET | `/alerts/low-stock` | ✅ | สินค้าที่ stock ต่ำกว่า threshold |

### Stock Movements
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/stock-movements` | owner | ดู log ความเคลื่อนไหวสต็อก (200 รายการล่าสุด) |
| POST | `/stock-movements` | owner | รับสินค้าเข้า / ปรับสต็อก |

### Sales
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/sales` | ✅ | ดูประวัติการขาย (100 รายการล่าสุด) |
| POST | `/sales` | ✅ | บันทึกการขาย (idempotent ด้วย requestId) |
| POST | `/sales/:id/return` | owner | คืนสินค้าทั้งบิล |

### Reports
| Method | Endpoint | Auth | Query Params | Description |
|--------|----------|------|--------------|-------------|
| GET | `/reports` | owner | `period=day\|month\|year`, `date=YYYY-MM-DD` | รายงานยอดขาย + กราฟ + top/bottom products |
| GET | `/reports/export` | owner | `period`, `date` | Export CSV |

### Backup
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/backup` | owner | สร้าง backup ทันที |
| GET | `/backup/status` | owner | สถานะ auto backup ล่าสุด |

---

## 🖥️ Frontend Pages & Components

### Pages (src/App.tsx)
| Page ID | Component | Role | Description |
|---------|-----------|------|-------------|
| `pos` | `POS` | cashier, owner | หน้าขายหน้าร้าน |
| `inventory` | `Inventory` | owner | จัดการสินค้าและสต็อก |
| `alerts` | `Inventory` (alertsOnly) | cashier, owner | สินค้าใกล้หมด |
| `sales` | `SalesHistory` | cashier, owner | ประวัติการขาย |
| `reports` | `Reports` | owner | รายงานยอดขาย |
| `settings` | `SettingsPage` | owner | ตั้งค่าร้าน |

### Component Files
| File | Exports | Description |
|------|---------|-------------|
| `App.tsx` | `default App`, `Login` | Root app, sidebar nav, auth flow |
| `POS.tsx` | `POS` | ตะกร้าสินค้า, checkout, สแกนบาร์โค้ด |
| `Inventory.tsx` | `Inventory` | ตาราง/การ์ดสินค้า, เพิ่ม/แก้ไข/ลบ, รับสินค้าเข้า |
| `Management.tsx` | `Reports`, `SalesHistory`, `SettingsPage` | รายงาน, ประวัติบิล, ผู้ใช้, backup |
| `components.tsx` | `Modal` | Shared UI components |
| `types.ts` | Types + utilities | `User`, `Product`, `CartItem`, `Sale`, `Report` + helper functions |

### TypeScript Types (src/types.ts)
| Type | Description |
|------|-------------|
| `User` | `{ id, name, username, role: 'owner' \| 'cashier' }` |
| `Product` | ข้อมูลสินค้าพร้อม stock |
| `CartItem` | `{ product: Product, quantity: number }` |
| `Sale` | บิลพร้อม items |
| `Report` | ข้อมูลรายงาน (total, profit, chart, top/bottom) |

### Utility Functions (src/types.ts)
| Function | Description |
|----------|-------------|
| `money(cents)` | แปลงสตางค์ → string (th-TH format) |
| `baht(cents)` | แปลงสตางค์ → "฿x,xxx.xx" |
| `today()` | วันนี้ในรูปแบบ `YYYY-MM-DD` (Asia/Bangkok) |
| `dateTime(date)` | แปลง ISO string → รูปแบบไทย |
| `lowStock(product)` | ตรวจสอบว่า stock ต่ำกว่า threshold |
| `api<T>(url, options)` | Fetch wrapper พร้อม error handling + session expired |
| `post<T>(url, data)` | Shorthand POST request |

---

## 🔐 Security

- **Session**: Cookie-based (`httpOnly`, `sameSite: strict`), อายุ 12 ชั่วโมง
- **Password**: `scrypt` hashing (salt + 64-byte digest) ไม่มี dependency ภายนอก
- **Rate Limiting**: Login จำกัด 10 ครั้ง/นาที ต่อ IP
- **CORS**: เปิดให้เฉพาะ `127.0.0.1` / `localhost` เท่านั้น
- **CSP Headers**: ตั้งค่า Content-Security-Policy แบบ strict
- **Idempotent Sales**: ใช้ `requestId` (UUID) ป้องกันการบันทึกซ้ำ
- **Role Guard**: `owner` middleware ป้องกัน endpoint ที่ต้องการสิทธิ์สูง

---

## ⚙️ Environment Variables

สร้างไฟล์ `.env` จาก `.env.example`:

```env
DATABASE_URL="file:./prisma/store.db"
PORT=3001
```

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./store.db` | Path ไปยัง SQLite database |
| `PORT` | `3001` | Port ของ Express server |
| `BACKUP_DIR` | `backups/` | Directory สำหรับเก็บ backup files |
| `POS_DEMO` | — | ตั้งเป็น `"1"` เพื่อใช้ demo database |
| `POS_PARENT_PID` | — | PID ของ parent process (ใช้ใน Tauri mode) |

---

## 📜 npm Scripts

```bash
npm run dev             # รัน development: server + vite พร้อมกัน
npm run build           # Build production: TypeCheck + Vite + tsc server
npm run start           # รัน production server (ต้อง build ก่อน)
npm run setup           # Initial setup
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Apply database migrations
npm run test            # รัน integration tests
npm run demo            # รัน demo mode
npm run desktop:dev     # Tauri development mode
npm run desktop:prepare # Build + prepare สำหรับ Tauri
npm run desktop:build   # Build Tauri desktop app (.exe/.dmg)
```

---

## 📦 Dependencies หลัก

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| `react` + `react-dom` | ^19.1.0 | UI framework |
| `express` | ^5.1.0 | HTTP server |
| `@prisma/client` | 6.19.0 | Database ORM |
| `zod` | ^3.25.0 | Request validation |
| `recharts` | ^3.1.0 | Charts สำหรับรายงาน |
| `lucide-react` | ^0.468.0 | Icon library |
| `@fontsource/noto-sans-thai` | ^5.2.5 | Thai font |

### Development
| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^6.3.0 | Frontend bundler |
| `typescript` | ^5.9.0 | Type checking |
| `tsx` | ^4.20.0 | Run TypeScript (server dev) |
| `prisma` | 6.19.0 | Database schema & migrations |
| `@tauri-apps/cli` | ^2.11.4 | Desktop app build tool |
| `supertest` | ^7.1.4 | HTTP integration testing |
| `concurrently` | ^9.2.0 | รัน dev server + vite พร้อมกัน |

---

## 💾 Backup System

- **Auto Backup**: ทำงานทุก 5 นาที (ตรวจสอบว่าวันนี้ backup แล้วหรือยัง)
- **Manual Backup**: เจ้าของร้านกด "สำรองข้อมูล" ใน Settings
- **Format**: `auto-YYYY-MM-DD-<timestamp>-<random>.db`
- **Method**: SQLite `VACUUM INTO` (snapshot ที่สะอาด)
- **Storage**: `backups/` directory (กำหนดได้ผ่าน `BACKUP_DIR`)

---

## 🖥️ Desktop App (Tauri)

ใช้ [Tauri v2](https://tauri.app/) สร้าง native desktop app:

1. Rust sidecar เรียก Node.js server binary
2. WebView แสดง React frontend
3. Server ทำงาน local บน `127.0.0.1` (ไม่ expose ออกนอก)

### Build Desktop
```bash
npm run desktop:prepare   # Build web + copy server binary
npm run desktop:build     # Build native installer
```

---

## 🧪 Testing

```bash
npm run test
```

- **`tests/api.test.ts`** — Integration tests ครอบคลุมทุก API: auth, products, stock, sales, reports, backup
- **`tests/desktop.test.ts`** — Tests สำหรับ Tauri native binary

---

## 🚀 Quick Start

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. ตั้งค่า environment
cp .env.example .env

# 3. Setup database
npm run db:migrate

# 4. (ทางเลือก) เพิ่มข้อมูลตัวอย่าง
npm run demo

# 5. รัน development server
npm run dev
# เปิดเบราว์เซอร์: http://127.0.0.1:5173
```

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

*เอกสารนี้สร้างจากการวิเคราะห์โค้ดอัตโนมัติ — อัปเดตล่าสุด: กันยายน 2026*

รายละเอียดการแยก API และวิธีเพิ่ม feature: [server/pkg/README.md](server/pkg/README.md)
