import { Checkout } from "./Checkout";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ShoppingBasket,
  Banknote,
  TriangleAlert,
  X,
  Check,
  LayoutGrid,
} from "lucide-react";
import {
  baht,
  money,
  lowStock,
  post,
  type CartItem,
  type Product,
  type Sale,
} from "./types";
import { Empty, Modal, SaleComplete } from "./components";
type Props = {
  owner: boolean;
  active: boolean;
  checkoutOnOpen?: boolean;
  checkoutRoute?: boolean;
  billingMode?: boolean;
  onCheckoutOpen?: () => void;
  onCheckoutClose?: () => void;
  storageKey: string;
  products: Product[];
  refresh: () => Promise<void>;
  notify: (m: string, e?: boolean) => void;
  onAlerts: () => void;
};
function beep(error = false) {
  try {
    const context = new AudioContext();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    osc.frequency.value = error ? 220 : 950;
    gain.gain.value = 0.06;
    osc.start();
    osc.stop(context.currentTime + (error ? 0.22 : 0.09));
    osc.onended = () => void context.close();
  } catch {
    /* Visual feedback remains available without audio. */
  }
}
export function POS({
  products,
  refresh,
  notify,
  onAlerts,
  active,
  storageKey,
  owner,
  checkoutOnOpen = false,
  checkoutRoute = false,
  billingMode = false,
  onCheckoutOpen,
  onCheckoutClose,
}: Props) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      return Array.isArray(saved)
        ? saved.filter(
            (i) =>
              i?.product?.id && Number.isInteger(i.quantity) && i.quantity > 0,
          )
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* Payment reports unavailable storage before submitting. */
    }
  }, [cart, storageKey]);
  const [search, setSearch] = useState("");
  const [billingBarcode, setBillingBarcode] = useState("");
  const billingInput = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("ทั้งหมด");
  const [pay, setPay] = useState(() => {
    try {
      return checkoutOnOpen || Boolean(localStorage.getItem(storageKey + "-pending"));
    } catch {
      return false;
    }
  });
  const [sale, setSale] = useState<Sale | null>(null);
  const [clear, setClear] = useState(false);
  const [scanState, setScanState] = useState<"success" | "error" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const lastScan = useRef({ code: "", time: 0 });
  const buffer = useRef({ text: "", started: 0, last: 0 });
  const openCheckout = () => {
    setPay(true);
    onCheckoutOpen?.();
  };
  const total = cart.reduce(
    (sum, i) => sum + i.quantity * i.product.sellPrice,
    0,
  );
  const units = cart.reduce((sum, i) => sum + i.quantity, 0);
  const categories = ["ทั้งหมด", ...new Set(products.map((p) => p.category))];
  const alerts = products.filter(lowStock);
  const visible = products.filter(
    (p) =>
      (category === "ทั้งหมด" || p.category === category) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode.includes(search)),
  );
  const scanFeedback = (error: boolean) => {
    setScanState(error ? "error" : "success");
    beep(error);
  };
  useEffect(() => {
    if (!scanState) return;
    const timeout = setTimeout(() => setScanState(null), 1000);
    return () => clearTimeout(timeout);
  }, [scanState]);
  function add(product: Product, scanned = false) {
    const inCart = cart.find((i) => i.product.id === product.id)?.quantity ?? 0;
    if (inCart >= product.stockQty) {
      notify(`สต็อก ${product.name} ไม่เพียงพอ`, true);
      if (scanned) scanFeedback(true);
      return;
    }
    setCart((previous) => {
      const existing = previous.find((i) => i.product.id === product.id);
      return existing
        ? previous.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          )
        : [...previous, { product, quantity: 1 }];
    });
    if (scanned) {
      scanFeedback(false);
      notify(`เพิ่ม ${product.name} แล้ว`);
    }
  }
  function scan(code: string, fast: boolean) {
    const debounce = Number(localStorage.getItem("scanner-debounce") ?? "300");
    if (
      fast &&
      lastScan.current.code === code &&
      Date.now() - lastScan.current.time < debounce
    )
      return;
    lastScan.current = { code, time: Date.now() };
    const product = products.find((p) => p.barcode === code);
    if (product) {
      add(product, true);
      setSearch("");
    } else {
      scanFeedback(true);
      notify(`ไม่พบบาร์โค้ด ${code} — ค้นหาจากชื่อหรือเพิ่มสินค้าในคลัง`, true);
    }
  }
  useEffect(() => {
    if (active && !pay && !sale && !clear) input.current?.focus();
  }, [active, pay, sale, clear]);
  useEffect(() => {
    if (active && checkoutOnOpen && !pay && !sale && !clear) setPay(true);
  }, [active, checkoutOnOpen, cart.length, pay, sale, clear]);
  useEffect(() => {
    if (active && !checkoutRoute && pay) setPay(false);
  }, [active, checkoutRoute, pay]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        !active ||
        pay ||
        sale ||
        clear ||
        document.querySelector("dialog[open]")
      )
        return;
      if (event.key === "F2") {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
        return;
      }
      if (event.key === "F4") {
        event.preventDefault();
        openCheckout();
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select, [contenteditable="true"]'))
        return;
      const now = Date.now();
      if (event.key === "Enter") {
        const b = buffer.current;
        if (
          b.text.length >= 3 &&
          now - b.last < 100 &&
          now - b.started < b.text.length * 80
        ) {
          event.preventDefault();
          scan(b.text, true);
        }
        buffer.current = { text: "", started: now, last: now };
      } else if (event.key.length === 1) {
        if (now - buffer.current.last > 100)
          buffer.current = { text: "", started: now, last: now };
        buffer.current.text += event.key;
        buffer.current.last = now;
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  function changeQuantity(id: string, delta: number) {
    const p = products.find((p) => p.id === id);
    const line = cart.find((i) => i.product.id === id);
    if (!line) return;
    if (delta > 0 && (!p || line.quantity >= p.stockQty)) {
      notify("สต็อกไม่เพียงพอ", true);
      return;
    }
    setCart((previous) =>
      previous
        .map((i) =>
          i.product.id === id ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }
  if (pay)
    return (
      <Checkout
        cart={cart}
        products={products}
        onAddProduct={add}
        onChangeQuantity={changeQuantity}
        onRemoveProduct={(id) => setCart((previous) => previous.filter((item) => item.product.id !== id))}
        storageKey={storageKey}
        owner={owner}
        onSuccess={async (result) => {
          setSale(result);
          setPay(false);
          setCart([]);
          onCheckoutClose?.();
          await refresh();
        }}
        notify={notify}
      />
    );
  return (
    <div className="pos-layout">
      <section className="catalog">
        <div className="page-heading">
          <div>
            <div className="eyebrow green">{billingMode ? "BILLING" : "POINT OF SALE"}</div>
            <h1>
              {billingMode ? "คิดเงิน" : "ขายหน้าร้าน"}<span className="heading-dot">.</span>
            </h1>
            <p>{billingMode ? "เลือกสินค้าและจัดบิลได้เต็มพื้นที่ พร้อมรับชำระเมื่อพร้อม" : "วันดี ๆ เริ่มต้นด้วยการขายที่ง่ายขึ้น"}</p>
          </div>
          <span className="soft-badge">
            <ShoppingBasket size={18} />
            เปิดร้านพร้อมขาย
          </span>
        </div>
        {alerts.length > 0 && (
          <button className="stock-banner" onClick={onAlerts}>
            <span>
              <TriangleAlert size={20} />
              <b>{alerts.length} สินค้าต้องเติมสต็อก</b>
              <span className="banner-detail">เช็กไว้ ขายได้ไม่สะดุด</span>
            </span>
            <ArrowRight size={20} />
          </button>
        )}
        <form
          className={`search-box ${scanState ?? ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            const b = buffer.current;
            scan(
              search.trim(),
              b.text.length > 2 && Date.now() - b.started < b.text.length * 80,
            );
            buffer.current.text = "";
          }}
        >
          <Search size={23} />
          <input
            ref={input}
            aria-label="ค้นหาสินค้าหรือสแกนบาร์โค้ด"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key.length === 1) {
                const now = Date.now();
                if (now - buffer.current.last > 100)
                  buffer.current = { text: "", started: now, last: now };
                buffer.current.text += e.key;
                buffer.current.last = now;
              }
            }}
            placeholder="ค้นหาสินค้า หรือสแกนบาร์โค้ด…"
          />
          {search && (
            <button
              type="button"
              aria-label="ล้างการค้นหา"
              onClick={() => {
                setSearch("");
                input.current?.focus();
              }}
            >
              <X size={20} />
            </button>
          )}
          <span className="keycap">F2</span>
          <button type="submit" aria-label="เพิ่มจากบาร์โค้ด">
            <ScanBarcode size={25} />
          </button>
        </form>
        <div className="category-list">
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              {c === "ทั้งหมด" && <LayoutGrid size={18} />} {c}
            </button>
          ))}
        </div>
        <div className="catalog-caption">
          <b>
            {category === "ทั้งหมด" ? "สินค้าทั้งหมด" : category}
            <span>{visible.length} รายการ</span>
          </b>
          <small>แตะสินค้าเพื่อเพิ่มลงในบิล</small>
        </div>
        <div className="product-grid">
          {visible.map((p) => {
            const count = cart.find((i) => i.product.id === p.id)?.quantity;
            return (
              <button
                className={`product-card ${p.stockQty === 0 ? "sold-out" : ""}`}
                key={p.id}
                disabled={p.stockQty === 0}
                onClick={() => add(p)}
              >
                <div
                  className={`product-art cat-${["เครื่องดื่ม", "อาหารแห้ง", "ของสด", "ขนมขบเคี้ยว", "เครื่องปรุง", "ของใช้"].indexOf(p.category)}`}
                >
                  <span className="product-emoji">{p.icon}</span>
                  {count && (
                    <span className="in-cart">
                      <Check size={13} />
                      {count} ในบิล
                    </span>
                  )}
                  {lowStock(p) && (
                    <span
                      className={`stock-label ${p.stockQty === 0 ? "out" : ""}`}
                    >
                      {p.stockQty === 0 ? "หมดชั่วคราว" : "ใกล้หมด"}
                    </span>
                  )}
                </div>
                <div className="product-info">
                  <span className="product-category">{p.category}</span>
                  <h3>{p.name}</h3>
                  <div className="product-stock">
                    คงเหลือ {p.stockQty} {p.unit}
                  </div>
                  <div className="product-bottom">
                    <strong>{baht(p.sellPrice)}</strong>
                    <span className="add-product">
                      <Plus size={21} />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {visible.length === 0 && (
          <Empty
            title={
              products.length ? "ไม่พบสินค้าที่ค้นหา" : "พร้อมรับสินค้าชิ้นแรก"
            }
            detail={
              products.length
                ? "ลองค้นหาด้วยชื่อหรือบาร์โค้ดอื่น"
                : "เพิ่มสินค้าในหน้าคลังสินค้าเพื่อเริ่มขาย"
            }
          />
        )}
        <footer className="catalog-footer">
          <span>
            <span className="online-dot" />
            บันทึกลงเครื่อง · ใช้งานได้โดยไม่ต้องต่ออินเทอร์เน็ต
          </span>
          <span>บ้านร้าน v0.2</span>
        </footer>
      </section>
      <aside className="cart-panel">
        <div className="cart-header">
          <div>
            <ReceiptIcon />
            <h2>บิลปัจจุบัน</h2>
            <span className="count-circle">{units}</span>
          </div>
          <button
            className="icon-button"
            aria-label="ล้างตะกร้า"
            disabled={!cart.length}
            onClick={() => setClear(true)}
          >
            <Trash2 size={20} />
          </button>
        </div>
        <form
          className="billing-barcode"
          onSubmit={(event) => {
            event.preventDefault();
            const code = billingBarcode.trim();
            if (!code) return;
            const b = buffer.current;
            scan(
              code,
              b.text.length > 2 && Date.now() - b.started < b.text.length * 80,
            );
            buffer.current.text = "";
            if (products.some((product) => product.barcode === code))
              setBillingBarcode("");
            billingInput.current?.focus();
            billingInput.current?.select();
          }}
        >
          <label htmlFor="billing-barcode">
            เพิ่มสินค้าเข้าบิลด้วยบาร์โค้ด
          </label>
          <div className={`billing-barcode-entry ${scanState ?? ""}`}>
            <input
              id="billing-barcode"
              ref={billingInput}
              value={billingBarcode}
              placeholder="กรอกหรือสแกนบาร์โค้ด"
              autoComplete="off"
              onChange={(event) => setBillingBarcode(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key.length === 1 &&
                  !event.ctrlKey &&
                  !event.altKey &&
                  !event.metaKey
                ) {
                  const now = Date.now();
                  if (now - buffer.current.last > 100)
                    buffer.current = { text: "", started: now, last: now };
                  buffer.current.text += event.key;
                  buffer.current.last = now;
                }
              }}
            />
            <button
              type="submit"
              aria-label="เพิ่มบาร์โค้ดเข้าบิล"
              disabled={!billingBarcode.trim()}
            >
              <Plus size={20} />
            </button>
          </div>
        </form>
        <div className="cart-subhead">
          <span>รายการสินค้า</span>
          <span>ราคา</span>
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <div>
                <ShoppingBasket size={38} />
              </div>
              <h3>บิลใหม่ พร้อมขาย</h3>
              <p>
                สแกนบาร์โค้ด หรือแตะสินค้า
                <br />
                เพื่อเพิ่มรายการในบิลนี้
              </p>
              <span>
                <ScanBarcode size={20} />
                รองรับเครื่องสแกน USB
              </span>
            </div>
          ) : (
            cart.map((i) => (
              <div className="cart-line" key={i.product.id}>
                <div className="cart-line-top">
                  <span className="cart-emoji">{i.product.icon}</span>
                  <div>
                    <b>{i.product.name}</b>
                    <small>
                      {baht(i.product.sellPrice)} / {i.product.unit}
                    </small>
                  </div>
                  <button
                    className="small-icon"
                    aria-label={`ลบ ${i.product.name}`}
                    onClick={() =>
                      setCart(cart.filter((c) => c.product.id !== i.product.id))
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="cart-line-bottom">
                  <div className="stepper">
                    <button
                      aria-label={`ลด ${i.product.name}`}
                      onClick={() => changeQuantity(i.product.id, -1)}
                    >
                      <Minus size={17} />
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      aria-label={`เพิ่ม ${i.product.name}`}
                      onClick={() => changeQuantity(i.product.id, 1)}
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                  <b>{baht(i.product.sellPrice * i.quantity)}</b>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="cart-totals">
          <div className="spread muted">
            <span>
              รวม {units} ชิ้น ({cart.length} รายการ)
            </span>
            <span>{baht(total)}</span>
          </div>
          <div className="cart-total">
            <div>
              ยอดชำระ<small>ส่วนลดระบุในขั้นตอนรับเงิน</small>
            </div>
            <strong>{baht(total)}</strong>
          </div>
          <button
            className="button primary pay-button"
            onClick={openCheckout}
          >
            <Banknote size={25} />
            <span>รับชำระเงิน</span>
            <span className="keycap">F4</span>
          </button>
          <div className="payment-note">
            <ShieldIcon />
            เงินสด / ไทยช่วยไทย · คำนวณเงินทอนอัตโนมัติ
          </div>
        </div>
      </aside>
      {clear && (
        <Modal title="ล้างรายการในบิลนี้?" onClose={() => setClear(false)}>
          <p>
            รายการ {cart.length} รายการจะถูกนำออก
            สต็อกสินค้ายังไม่ถูกเปลี่ยนแปลง
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setClear(false)}
            >
              กลับไปขายต่อ
            </button>
            <button
              className="button danger"
              onClick={() => {
                setCart([]);
                setClear(false);
              }}
            >
              ล้างบิล
            </button>
          </div>
        </Modal>
      )}
      {sale && <SaleComplete sale={sale} onClose={() => setSale(null)} />}
    </div>
  );
}
function ReceiptIcon() {
  return <ShoppingBasket size={23} />;
}
function ShieldIcon() {
  return <Check size={16} />;
}
