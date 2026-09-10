import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import request from 'supertest';
const dir = mkdtempSync(resolve('test-results-assistance-'));
process.env.DATABASE_URL = 'file:' + join(dir, 'test.db').replaceAll('\\', '/');
const sql = new DatabaseSync(join(dir, 'test.db'));
sql.exec(readFileSync('prisma/migrations/20260907042930_init/migration.sql','utf8'));
sql.exec("INSERT INTO Sale (id,requestId,totalAmount,paymentReceived,change,cashier) VALUES ('legacy','legacy',100,200,100,'Old owner')");
for (const m of readdirSync('prisma/migrations', {withFileTypes:true}).filter(m=>m.isDirectory() && m.name !== '20260907042930_init').sort((a,b)=>a.name.localeCompare(b.name))) sql.exec(readFileSync(`prisma/migrations/${m.name}/migration.sql`,'utf8'));
sql.close();
const { app } = await import('../server/app.js');
const { report } = await import('../server/pkg/reports/reports.service.js');
const { db } = await import('../server/pkg/database/database.service.js');
const owner = request.agent(app); const cashier = request.agent(app);
let productId: string;
before(async () => {
  await owner.post('/api/setup').send({name:'Owner', username:'owner',password:'test-password'}).expect(201);
  await owner.post('/api/login').send({username:'owner',password:'test-password'}).expect(200);
  await owner.post('/api/users').send({name:'Cashier', username:'cashier',password:'test-password'}).expect(201);
  await cashier.post('/api/login').send({username:'cashier',password:'test-password'}).expect(200);
  productId = (await owner.post('/api/products').send({name:'สินค้า',barcode:'test',category:'test',costPrice:1000,sellPrice:10001,unit:'ชิ้น',stockQty:100,reorderThreshold:1}).expect(201)).body.id;
});
after(async()=>{await db.$disconnect();});
const body = (governmentRateBps=5000) => ({requestId:randomUUID(),items:[{productId,quantity:1,unitPrice:10001}],paymentMethod:'thai_help_thai',governmentRateBps,assistanceConfirmed:true,paymentReceived:10000});
test('migration backfills legacy cash bills and keeps their change',async()=>{const sale=await db.sale.findUniqueOrThrow({where:{id:'legacy'}});assert.equal(sale.customerAmount,100);assert.equal(sale.governmentAmount,0);assert.equal(sale.change,100);});
test('only owner can persist a valid percentage',async()=>{
  await cashier.put('/api/payment-settings').send({governmentRateBps:7000}).expect(403);
  for(const rate of [-1,10001,50.5]) await owner.put('/api/payment-settings').send({governmentRateBps:rate}).expect(400);
  await owner.put('/api/payment-settings').send({governmentRateBps:6000}).expect(200);
  assert.equal((await cashier.get('/api/payment-settings').expect(200)).body.governmentRateBps,6000);
});
test('assistance applies after discount; rounds to satang, and makes change from customer share only',async()=>{
  const sale=(await cashier.post('/api/sales').send({...body(6000),discount:1,paymentReceived:5000}).expect(201)).body;
  assert.equal(sale.totalAmount,10000);assert.equal(sale.governmentAmount,6000);assert.equal(sale.customerAmount,4000);assert.equal(sale.change,1000);
  const fractional=(await cashier.post('/api/sales').send(body(6000)).expect(201)).body;
  assert.equal(fractional.governmentAmount,6001);assert.equal(fractional.customerAmount,4000);assert.equal(fractional.governmentAmount+fractional.customerAmount,10001);
});
test('reject stale rates, missing confirmation and insufficient customer funds without reducing stock',async()=>{
  const stock=(await db.product.findUniqueOrThrow({where:{id:productId}})).stockQty;
  await cashier.post('/api/sales').send(body(5000)).expect(409);
  await cashier.post('/api/sales').send({...body(6000),assistanceConfirmed:false}).expect(400);
  await cashier.post('/api/sales').send({...body(6000),paymentReceived:3999}).expect(400);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:productId}})).stockQty,stock);
});
test('saved bill keeps old percentage, retry stays idempotent after settings change, refund excludes government share',async()=>{
  const payload=body(6000);const sale=(await owner.post('/api/sales').send(payload).expect(201)).body;
  await owner.put('/api/payment-settings').send({governmentRateBps:7500}).expect(200);
  const retry=(await owner.post('/api/sales').send(payload).expect(201)).body;assert.equal(retry.id,sale.id);assert.equal(retry.governmentRateBps,6000);
  const refunded=(await owner.post(`/api/sales/${sale.id}/return`).send({reason:'ทดสอบคืน'}).expect(200)).body;
  assert.equal(refunded.refund,4000);assert.equal(refunded.governmentReversal,6001);
  await owner.post(`/api/sales/${sale.id}/return`).send({reason:'ซ้ำ'}).expect(409);
});
test('supports 0 and 100 percent, cash stays full-price, report splits reconcile to revenue',async()=>{
  for(const rate of [0,10000]) {await owner.put('/api/payment-settings').send({governmentRateBps:rate}).expect(200);const sale=(await owner.post('/api/sales').send({...body(rate),paymentReceived:rate===10000?0:10001}).expect(201)).body;assert.equal(sale.customerAmount,rate===10000?0:10001);assert.equal(sale.change,0);}
  const cash=(await cashier.post('/api/sales').send({...body(10000),paymentMethod:'cash',paymentReceived:10001}).expect(201)).body;assert.equal(cash.governmentAmount,0);assert.equal(cash.customerAmount,10001);
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const r=await report('day',date);assert.equal(r.customerTotal+r.governmentTotal,r.total);
});
