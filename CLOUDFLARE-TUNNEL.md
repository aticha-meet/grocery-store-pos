# Backend ผ่าน Cloudflare Tunnel

กำหนด `.env` สำหรับเครื่องที่รัน backend:

```dotenv
PORT=3001
hostname=localhost
PD_HOSTNAME="https://grocery-pos.edflow.online"
```

ใน Cloudflare Tunnel ตั้ง hostname เป็น `grocery-pos.edflow.online` และ Service URL เป็น `http://localhost:3001` ให้ตรงกับ backend ไม่ต้องเพิ่ม `/api` ใน Service URL หรือ PD_HOSTNAME ถ้าเลือกใช้ `127.0.0.1` ให้เปลี่ยนทั้ง hostname ใน .env และ Service URL ให้ตรงกัน

หลังแก้โค้ดให้หยุด process backend เดิม แล้วรัน:

```powershell
npm run build
npm start
```

ตรวจ `https://grocery-pos.edflow.online/api/health` ควรได้ HTTP 200 ถ้ายังได้ข้อความ “เปิดแอปผ่าน localhost เท่านั้น” แปลว่ายังมี backend โค้ดเก่ารับคำขออยู่

`PD_HOSTNAME` อนุญาตทั้ง Host ของ backend และ Origin ของเว็บบนโดเมนเดียวกัน ส่วน frontend คนละ origin ให้ใส่ URL ของ frontend ใน `CORS_ORIGINS` คั่นหลายค่าด้วย comma ห้ามใส่ path หรือ wildcard:

```dotenv
CORS_ORIGINS="https://your-frontend.example"
```

HTTP middleware ตอบ OPTIONS ก่อนตรวจ session และส่ง Access-Control-Allow-Origin เฉพาะค่าที่อนุญาต พร้อม Access-Control-Allow-Credentials การเพิ่ม CORS_ORIGINS ไม่ได้เพิ่ม Host ที่ backend ยอมรับ

Frontend ปัจจุบันใช้ `/api` แบบ relative ถ้าเสิร์ฟหน้าเว็บจาก backend โดเมนเดียวกันจะเรียก API ได้เลย ถ้าแยก frontend ต้องเปลี่ยน API base URL หรือใช้ proxy เพิ่มเติม สำหรับ fetch ข้าม origin ที่ใช้ login ต้องตั้ง `credentials: 'include'` ด้วย ระบบปัจจุบันใช้ cookie `SameSite=Strict` จึงยังไม่รองรับ login จากเว็บคนละ site เช่น localhost ไปโดเมน cloud แม้ health/CORS จะผ่านแล้ว

อ้างอิง: [Cloudflare origin parameters](https://developers.cloudflare.com/tunnel/advanced/origin-parameters/) และ [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
