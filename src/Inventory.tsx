import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  PackagePlus,
  Pencil,
  Trash2,
  History,
  Package,
  TriangleAlert,
} from "lucide-react";
import { api, post, baht, lowStock, dateTime, type Product } from "./types";
import { Empty, Modal } from "./components";
type Props = {
  products: Product[];
  alertsOnly: boolean;
  owner: boolean;
  refresh: () => Promise<void>;
  notify: (m: string, e?: boolean) => void;
};
type Movement = {
  id: string;
  type: string;
  quantity: number;
  note: string;
  actor: string;
  createdAt: string;
  product: { name: string; unit: string };
};
export function Inventory({
  products,
  alertsOnly,
  owner,
  refresh,
  notify,
}: Props) {
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Product | "new" | null>(null);
  const [stock, setStock] = useState<Product | null>(null);
  const [remove, setRemove] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setQuery("");
  }, [alertsOnly]);
  const all = products.filter((p) => !alertsOnly || lowStock(p));
  const visible = all.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.barcode.includes(query),
  );
  async function history() {
    try {
      setMovements(await api<Movement[]>("/stock-movements"));
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow green">
            {alertsOnly ? "STOCK ALERTS" : "INVENTORY"}
          </div>
          <h1>
            {alertsOnly ? "สินค้าใกล้หมด" : "คลังสินค้า"}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {alertsOnly
              ? "เติมของให้พร้อม ไม่พลาดโอกาสขาย"
              : "ดูแลสินค้าทุกชิ้น ให้ร้านพร้อมขายเสมอ"}
          </p>
        </div>
        {owner && (
          <div className="heading-actions">
            <button className="button secondary" onClick={history}>
              <History size={20} />
              ประวัติสต็อก
            </button>
            <button className="button primary" onClick={() => setEditor("new")}>
              <Plus size={22} />
              เพิ่มสินค้า
            </button>
          </div>
        )}
      </div>
      <div className="stat-grid three">
        <div className="stat-card">
          <span className="stat-icon green-bg">
            <Package />
          </span>
          <span>สินค้าทั้งหมด</span>
          <strong>
            {products.length}
            <small>รายการ</small>
          </strong>
        </div>
        <div className="stat-card">
          <span className="stat-icon amber-bg">
            <TriangleAlert />
          </span>
          <span>ใกล้หมด</span>
          <strong>
            {products.filter((p) => lowStock(p) && p.stockQty > 0).length}
            <small>รายการ</small>
          </strong>
        </div>
        <div className="stat-card">
          <span className="stat-icon red-bg">
            <Package />
          </span>
          <span>หมดสต็อก</span>
          <strong>
            {products.filter((p) => p.stockQty === 0).length}
            <small>รายการ</small>
          </strong>
        </div>
      </div>
      <div className="table-panel">
        <div className="table-toolbar">
          <h2>
            {alertsOnly ? "รายการที่ต้องเติม" : "รายการสินค้า"}{" "}
            <span className="count-circle">{all.length}</span>
          </h2>
          <div className="search-box compact">
            <Search size={21} />
            <input
              aria-label="ค้นหาในคลัง"
              placeholder="ชื่อสินค้า หรือบาร์โค้ด"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>สินค้า</th>
                <th>หมวดหมู่</th>
                <th>ราคาขาย</th>
                <th>คงเหลือ</th>
                <th>สถานะ</th>
                {owner && <th>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="table-product">
                      <span>{p.icon}</span>
                      <div>
                        <b>{p.name}</b>
                        <small>{p.barcode}</small>
                      </div>
                    </div>
                  </td>
                  <td>{p.category}</td>
                  <td className="numeric">{baht(p.sellPrice)}</td>
                  <td>
                    <b>{p.stockQty}</b> {p.unit}
                    <small className="block muted">
                      จุดสั่งซื้อ {p.reorderThreshold}
                    </small>
                  </td>
                  <td>
                    <span
                      className={`status-tag ${p.stockQty === 0 ? "red" : lowStock(p) ? "amber" : "green"}`}
                    >
                      {p.stockQty === 0
                        ? "หมดสต็อก"
                        : lowStock(p)
                          ? "ใกล้หมด"
                          : "พร้อมขาย"}
                    </span>
                  </td>
                  {owner && (
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          title="รับเข้า / ปรับสต็อก"
                          aria-label={`รับเข้า ${p.name}`}
                          onClick={() => setStock(p)}
                        >
                          <PackagePlus size={22} />
                        </button>
                        <button
                          className="icon-button"
                          title="แก้ไข"
                          aria-label={`แก้ไข ${p.name}`}
                          onClick={() => setEditor(p)}
                        >
                          <Pencil size={20} />
                        </button>
                        <button
                          className="icon-button danger-text"
                          title="ลบ"
                          aria-label={`ลบ ${p.name}`}
                          onClick={() => setRemove(p)}
                        >
                          <Trash2 size={19} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <Empty
            title={
              alertsOnly
                ? "ไม่มีสินค้าที่ต้องเติม"
                : "ยังไม่มีสินค้าในรายการนี้"
            }
            detail="ลองเปลี่ยนคำค้นหา หรือเพิ่มสินค้าใหม่"
          />
        )}
      </div>
      {editor && (
        <ProductEditor
          product={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onSave={async () => {
            setEditor(null);
            await refresh();
            notify("บันทึกสินค้าแล้ว");
          }}
          notify={notify}
        />
      )}{" "}
      {stock && (
        <Modal
          title="รับเข้า / ปรับสต็อก"
          onClose={() => {
            if (!busy) setStock(null);
          }}
        >
          <p>
            <b>{stock.name}</b>
            <br />
            <span className="muted">
              คงเหลือ {stock.stockQty} {stock.unit}
            </span>
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await post("/stock-movements", {
                  productId: stock.id,
                  type: f.get("type"),
                  quantity: Number(f.get("quantity")),
                  note: f.get("note"),
                });
                setStock(null);
                await refresh();
                notify("บันทึกสต็อกแล้ว");
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              ประเภท
              <select name="type">
                <option value="in">รับสินค้าเข้า</option>
                <option value="adjust">
                  ปรับเพิ่ม/ลดสต็อก (ใส่ค่าติดลบเพื่อลด)
                </option>
              </select>
            </label>
            <label>
              จำนวนที่เพิ่ม / ลด
              <input
                name="quantity"
                type="number"
                step="1"
                required
                autoFocus
                placeholder="เช่น 12 หรือ -2"
              />
            </label>
            <label>
              หมายเหตุ
              <input
                name="note"
                required
                maxLength={200}
                placeholder="เช่น รับของจากผู้ส่ง / สินค้าชำรุด"
              />
            </label>
            <button className="button primary full" disabled={busy}>
              บันทึกสต็อก
            </button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          title="นำสินค้าออกจากคลัง?"
          onClose={() => {
            if (!busy) setRemove(null);
          }}
        >
          <p>นำ “{remove.name}” ออกจากรายการขาย ประวัติการขายเดิมยังคงอยู่</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setRemove(null)}
            >
              กลับ
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/products/${remove.id}`, { method: "DELETE" });
                  setRemove(null);
                  await refresh();
                  notify("นำสินค้าออกแล้ว");
                } catch (e) {
                  notify((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              นำสินค้าออก
            </button>
          </div>
        </Modal>
      )}
      {movements && (
        <Modal
          title="ประวัติการเคลื่อนไหวสต็อก (ล่าสุด 200 รายการ)"
          wide
          onClose={() => setMovements(null)}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>เวลา / ผู้ทำรายการ</th>
                  <th>สินค้า</th>
                  <th>จำนวน</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {dateTime(m.createdAt)}
                      <small className="block muted">{m.actor}</small>
                    </td>
                    <td>{m.product.name}</td>
                    <td
                      className={m.quantity < 0 ? "danger-text" : "green-text"}
                    >
                      {m.quantity > 0 ? "+" : ""}
                      {m.quantity}
                    </td>
                    <td>{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!movements.length && <Empty title="ยังไม่มีการเคลื่อนไหว" />}
          </div>
        </Modal>
      )}
    </>
  );
}
function ProductEditor({
  product,
  onClose,
  onSave,
  notify,
}: {
  product: Product | null;
  onClose: () => void;
  onSave: () => void;
  notify: Props["notify"];
}) {
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const data = {
      name: f.get("name"),
      barcode: f.get("barcode"),
      category: f.get("category"),
      costPrice: Math.round(Number(f.get("costPrice")) * 100),
      sellPrice: Math.round(Number(f.get("sellPrice")) * 100),
      unit: f.get("unit"),
      stockQty: product?.stockQty ?? Number(f.get("stockQty")),
      reorderThreshold: Number(f.get("reorderThreshold")),
      icon: f.get("icon"),
    };
    setBusy(true);
    try {
      await api(product ? `/products/${product.id}` : "/products", {
        method: product ? "PUT" : "POST",
        body: JSON.stringify(data),
      });
      onSave();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={product ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <label>
          ชื่อสินค้า
          <input
            name="name"
            defaultValue={product?.name}
            required
            maxLength={120}
            autoFocus
          />
        </label>
        <label>
          บาร์โค้ด
          <input
            name="barcode"
            defaultValue={product?.barcode}
            required
            maxLength={64}
          />
        </label>
        <div className="form-grid">
          <label>
            หมวดหมู่
            <input
              name="category"
              list="categories"
              defaultValue={product?.category ?? "ของใช้"}
              required
            />
            <datalist id="categories">
              {[
                "เครื่องดื่ม",
                "อาหารแห้ง",
                "ของสด",
                "ขนมขบเคี้ยว",
                "เครื่องปรุง",
                "ของใช้",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </datalist>
          </label>
          <label>
            หน่วยนับ
            <input
              name="unit"
              defaultValue={product?.unit ?? "ชิ้น"}
              required
            />
          </label>
          <label>
            ราคาซื้อ (บาท)
            <input
              name="costPrice"
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              defaultValue={(product?.costPrice ?? 0) / 100}
              required
            />
          </label>
          <label>
            ราคาขาย (บาท)
            <input
              name="sellPrice"
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              defaultValue={(product?.sellPrice ?? 0) / 100}
              required
            />
          </label>
          {!product && (
            <label>
              สต็อกเริ่มต้น
              <input
                name="stockQty"
                type="number"
                min="0"
                step="1"
                defaultValue="0"
                required
              />
            </label>
          )}
          <label>
            จุดสั่งซื้อซ้ำ
            <input
              name="reorderThreshold"
              type="number"
              min="0"
              step="1"
              defaultValue={product?.reorderThreshold ?? 5}
              required
            />
          </label>
          <label>
            ไอคอนสินค้า
            <select name="icon" defaultValue={product?.icon ?? "📦"}>
              {[
                "📦",
                "💧",
                "🥤",
                "🥛",
                "☕",
                "🍜",
                "🌾",
                "🐟",
                "🥚",
                "🥔",
                "🍫",
                "🍘",
                "🍪",
                "🫙",
                "🍶",
                "🧂",
                "🧼",
                "🧻",
                "🫧",
              ].map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </label>
        </div>
        {product && (
          <p className="muted">
            ปรับจำนวนคงเหลือผ่าน “รับเข้า / ปรับสต็อก” เพื่อเก็บประวัติ
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกสินค้า"}
        </button>
      </form>
    </Modal>
  );
}
