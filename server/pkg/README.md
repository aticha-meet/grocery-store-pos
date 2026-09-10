# API packages

`server/app.ts` ประกอบ middleware และ modules ส่วน `server/index.ts` เปิด HTTP server, เสิร์ฟ frontend และจัดการ lifecycle

API ทั้งหมดอยู่ใน `server/pkg/` แยกตาม feature: `users`, `health`, `products`, `stock`, `payments`, `sales`, `reports`, `backup`

แต่ละ feature มีสามส่วน:

- `*.controller.ts` อ่าน request เรียก service และส่ง response รวมถึง cookie, HTTP status และ CSV
- `*.service.ts` ตรวจข้อมูล ทำ business logic และเรียกฐานข้อมูล โดยไม่รับ Express request/response
- `*.module.ts` ประกอบ controller/service และกำหนด routes พร้อม middleware ตรวจสิทธิ์

ตัวอย่าง:

```text
products/
  products.controller.ts
  products.service.ts
  products.module.ts
```

ส่วนกลางที่ไม่มี endpoint ไม่ต้องสร้าง controller: `database/database.service.ts` ใช้ Prisma instance ร่วมกัน, `config/environment.ts` เก็บค่าการรัน, `shared/validation.ts` เก็บ validation ร่วม และ `http/http.module.ts` จัดการ HTTP middleware กับ errors

ลำดับใน app สำคัญ: HTTP middleware → health → users (แนบ session และเปิด login/setup) → requireAuth → API อื่น → error handler ส่วน routes ที่ต้องเป็นเจ้าของร้านรับ owner guard จาก users module

เมื่อเพิ่ม API ให้สร้างสามไฟล์ใน feature package แล้วนำ module ไปประกอบใน app หลัง requireAuth ถ้าต้องเข้าสู่ระบบก่อน ใช้ service ข้าม package ได้โดยไม่เรียก controller ข้ามกัน และอย่าสร้าง PrismaClient ซ้ำ

ตรวจการแก้ไขด้วย `npm run desktop:prepare` และ `npm test` โดย build จะล้าง dist-server ก่อน compile เพื่อไม่ให้ไฟล์ API ที่ลบแล้วยังติดไปกับแอป
