import { useEffect, useRef, useState, type FormEvent } from "react";
import "./checkout.css";
import {
  Banknote,
  Check,
  Handshake,
  Minus,
  Plus,
  RefreshCw,
  Save,
  ScanBarcode,
  Trash2,
} from "lucide-react";
import { api, baht, post, type CartItem, type Product, type Sale } from "./types";

type Pending = {
  requestId: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
  discount: number;
  paymentReceived: number;
  paymentMethod?: "cash" | "thai_help_thai";
  governmentRateBps?: number;
  assistanceConfirmed?: boolean;
};

type CheckoutProps = {
  cart: CartItem[];
  products: Product[];
  onAddProduct: (product: Product) => void;
  onChangeQuantity: (id: string, delta: number) => void;
  onRemoveProduct: (id: string) => void;
  storageKey: string;
  owner: boolean;
  onSuccess: (sale: Sale) => void;
  notify: (message: string, error?: boolean) => void;
};

export function Checkout({
  cart,
  products,
  onAddProduct,
  onChangeQuantity,
  onRemoveProduct,
  storageKey,
  owner,
  onSuccess,
  notify,
}: CheckoutProps) {
  const [pending] = useState<Pending | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(`${storageKey}-pending`) ?? "null");
    } catch {
      return null;
    }
  });
  const [method, setMethod] = useState<"cash" | "thai_help_thai">(
    pending?.paymentMethod ?? "cash",
  );
  const [rate, setRate] = useState(pending?.governmentRateBps ?? 5000);
  const [draftRate, setDraftRate] = useState("50");
  const [settingsReady, setSettingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discount, setDiscount] = useState(String((pending?.discount ?? 0) / 100));
  const [received, setReceived] = useState(
    pending ? String(pending.paymentReceived / 100) : "",
  );
  const [confirmed, setConfirmed] = useState(pending?.assistanceConfirmed ?? false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(Boolean(pending));
  const [error, setError] = useState("");
  const [barcode, setBarcode] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const sending = useRef(false);
  const payload = useRef<Pending | null>(pending);
  const requestId = useRef(pending?.requestId ?? crypto.randomUUID());

  const subtotal = cart.reduce(
    (sum, row) => sum + row.quantity * row.product.sellPrice,
    0,
  );
  const total = subtotal - Math.round(Number(discount) * 100);
  const government = method === "thai_help_thai" ? Math.round((total * rate) / 10000) : 0;
  const customer = total - government;
  const cash = Math.round(Number(received) * 100);
  const draftBps = Math.round(Number(draftRate) * 100);
  const validRate =
    draftRate !== "" &&
    Number.isFinite(draftBps) &&
    draftBps >= 0 &&
    draftBps <= 10000;
  const valid =
    cart.length > 0 &&
    Number.isFinite(total) &&
    total >= 0 &&
    Number(discount) >= 0 &&
    Number.isFinite(cash) &&
    cash >= customer &&
    received !== "" &&
    (method === "cash" || ((settingsReady || locked) && confirmed));

  function addProduct(product: Product | undefined) {
    if (!product) return;
    onAddProduct(product);
    setBarcode("");
    setSelectedProduct("");
    setError("");
    notify(`เพิ่ม ${product.name} เข้าบิลแล้ว`);
  }

  function addBarcode(event: FormEvent) {
    event.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const product = products.find((item) => item.barcode === code);
    if (!product) {
      setError(`ไม่พบบาร์โค้ด ${code}`);
      return;
    }
    addProduct(product);
  }

  async function loadSettings() {
    try {
      const settings = await api<{ governmentRateBps: number }>("/payment-settings");
      if (!locked) setRate(settings.governmentRateBps);
      setDraftRate(String(settings.governmentRateBps / 100));
      setSettingsReady(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function saveSettings() {
    if (!validRate || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<{ governmentRateBps: number }>("/payment-settings", {
        method: "PUT",
        body: JSON.stringify({ governmentRateBps: draftBps }),
      });
      setRate(result.governmentRateBps);
      setSettingsReady(true);
      setReceived("");
      setConfirmed(false);
      notify("บันทึกสัดส่วนช่วยจ่ายแล้ว บิลเก่าไม่เปลี่ยนแปลง");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || sending.current) return;
    sending.current = true;
    setBusy(true);
    setLocked(true);
    setError("");
    let submitted = false;
    payload.current ??= {
      requestId: requestId.current,
      items: cart.map((row) => ({
        productId: row.product.id,
        quantity: row.quantity,
        unitPrice: row.product.sellPrice,
      })),
      discount: Math.round(Number(discount) * 100),
      paymentReceived: cash,
      paymentMethod: method,
      governmentRateBps: method === "thai_help_thai" ? rate : 0,
      assistanceConfirmed: confirmed,
    };
    try {
      localStorage.setItem(`${storageKey}-pending`, JSON.stringify(payload.current));
      submitted = true;
      const sale = await post<Sale>("/sales", payload.current);
      localStorage.setItem(storageKey, "[]");
      localStorage.removeItem(`${storageKey}-pending`);
      onSuccess(sale);
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (
        !submitted ||
        (status && status >= 400 && status < 500 && status !== 401)
      ) {
        localStorage.removeItem(`${storageKey}-pending`);
        payload.current = null;
        setLocked(false);
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
      sending.current = false;
    }
  }

  return (
    <section className="checkout-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow green">CHECKOUT</div>
          <h1>
            คิดเงินและรับชำระ<span className="heading-dot">.</span>
          </h1>
          <p>ตรวจยอด เลือกวิธีชำระ แล้วปิดบิลได้เลย</p>
        </div>
      </div>
      <div className="checkout-columns">
        <div>
          <section className="checkout-card checkout-import">
            <h2>เพิ่มสินค้าเข้าบิล</h2>
            <form className="checkout-barcode" onSubmit={addBarcode}>
              <ScanBarcode size={21} />
              <input
                aria-label="บาร์โค้ดสินค้า"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="กรอกหรือสแกนบาร์โค้ด แล้วกด Enter"
                autoComplete="off"
                autoFocus
              />
              <button
                type="submit"
                aria-label="เพิ่มจากบาร์โค้ด"
                disabled={!barcode.trim() || locked || busy}
              >
                <Plus size={20} />
              </button>
            </form>
            <div className="checkout-product-select">
              <select
                aria-label="เลือกสินค้าเพิ่มเข้าบิล"
                value={selectedProduct}
                disabled={locked || busy}
                onChange={(event) => {
                  setSelectedProduct(event.target.value);
                  addProduct(products.find((item) => item.id === event.target.value));
                }}
              >
                <option value="">หรือเลือกสินค้าจากรายการ…</option>
                {products
                  .filter((item) => item.stockQty > 0)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {baht(item.sellPrice)} · เหลือ {item.stockQty} {item.unit}
                    </option>
                  ))}
              </select>
            </div>
            <p className="footnote">เพิ่มสินค้าได้ตลอดก่อนกดยืนยันรับเงิน</p>
          </section>

          <section className="checkout-card">
            <h2>วิธีรับชำระเงิน</h2>
            <div className="payment-methods">
              {(
                [
                  {
                    id: "cash",
                    label: "เงินสด",
                    detail: "ลูกค้าชำระเต็มจำนวน",
                    Icon: Banknote,
                  },
                  {
                    id: "thai_help_thai",
                    label: "ไทยช่วยไทย",
                    detail: "แบ่งส่วนรัฐและลูกค้า",
                    Icon: Handshake,
                  },
                ] as const
              ).map(({ id, label, detail, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={method === id}
                  disabled={locked || saving}
                  className={method === id ? "chosen" : ""}
                  onClick={() => {
                    setMethod(id);
                    setReceived("");
                    setConfirmed(false);
                    setError("");
                  }}
                >
                  <Icon size={27} />
                  <b>{label}</b>
                  <small>{detail}</small>
                </button>
              ))}
            </div>
          </section>

          {method === "thai_help_thai" && (
            <section className="checkout-card assistance-card">
              <div className="spread">
                <h2>สัดส่วนไทยช่วยไทย</h2>
                <button
                  className="icon-button"
                  aria-label="โหลดสัดส่วนล่าสุด"
                  disabled={locked || saving}
                  onClick={() => {
                    setSettingsReady(false);
                    setConfirmed(false);
                    setReceived("");
                    void loadSettings();
                  }}
                >
                  <RefreshCw size={20} />
                </button>
              </div>
              <p className="muted">
                สัดส่วนที่ใช้กับบิลนี้: รัฐ {rate / 100}% · ลูกค้า {(10000 - rate) / 100}%
              </p>
              {owner ? (
                <>
                  <div className="form-grid">
                    <label>
                      รัฐจ่าย (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={draftRate}
                        disabled={locked || saving}
                        onChange={(event) => setDraftRate(event.target.value)}
                      />
                    </label>
                    <label>
                      ลูกค้าจ่าย (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={validRate ? (10000 - draftBps) / 100 : ""}
                        disabled={locked || saving}
                        onChange={(event) =>
                          setDraftRate(
                            event.target.value === ""
                              ? ""
                              : String(
                                  (10000 - Math.round(Number(event.target.value) * 100)) /
                                    100,
                                ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={!validRate || saving || locked}
                    onClick={() => void saveSettings()}
                  >
                    <Save size={19} />
                    {saving ? "กำลังบันทึก…" : "บันทึกสัดส่วนไว้ใช้"}
                  </button>
                  <p className="footnote">รวมกัน 100% เสมอ · ต้องกดบันทึกเพื่อใช้สัดส่วนใหม่</p>
                </>
              ) : (
                <p className="muted">เจ้าของร้านเป็นผู้กำหนดสัดส่วนช่วยจ่าย</p>
              )}
              <p className="assistance-note">
                คำนวณจากยอดสุทธิหลังส่วนลด ไม่ใช่การตรวจสิทธิ์หรือรับเงินจากระบบรัฐอัตโนมัติ
              </p>
            </section>
          )}

          <section className="checkout-card">
            <h2>
              รายการในบิล <span className="count-circle">{cart.length}</span>
            </h2>
            {cart.length === 0 ? (
              <p className="checkout-empty-line">
                ยังไม่มีสินค้าในบิล สแกนบาร์โค้ดหรือเลือกสินค้าด้านบนเพื่อเริ่มรายการ
              </p>
            ) : (
              cart.map((row) => (
                <div className="checkout-line" key={row.product.id}>
                  <span className="cart-emoji">{row.product.icon}</span>
                  <div className="checkout-line-detail">
                    <b>{row.product.name}</b>
                    <small>
                      {row.quantity} × {baht(row.product.sellPrice)}
                    </small>
                  </div>
                  <div className="checkout-line-actions">
                    <button
                      type="button"
                      aria-label={`ลด ${row.product.name}`}
                      disabled={locked || busy}
                      onClick={() => onChangeQuantity(row.product.id, -1)}
                    >
                      <Minus size={17} />
                    </button>
                    <b aria-label={`จำนวน ${row.product.name}`}>{row.quantity}</b>
                    <button
                      type="button"
                      aria-label={`เพิ่ม ${row.product.name}`}
                      disabled={locked || busy}
                      onClick={() => onChangeQuantity(row.product.id, 1)}
                    >
                      <Plus size={17} />
                    </button>
                    <button
                      type="button"
                      className="remove-line"
                      aria-label={`ลบ ${row.product.name}`}
                      disabled={locked || busy}
                      onClick={() => onRemoveProduct(row.product.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <strong>{baht(row.quantity * row.product.sellPrice)}</strong>
                </div>
              ))
            )}
          </section>
        </div>

        <form className="checkout-card checkout-payment" onSubmit={submit}>
          <h2>สรุปยอดรับชำระ</h2>
          <div className="spread">
            <span>รวมค่าสินค้า</span>
            <b>{baht(subtotal)}</b>
          </div>
          <label>
            ส่วนลดทั้งบิล (บาท)
            <input
              type="number"
              min="0"
              max={subtotal / 100}
              step="0.01"
              value={discount}
              disabled={locked}
              onChange={(event) => {
                setDiscount(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <div className="spread checkout-net">
            <span>ยอดสุทธิ</span>
            <b>{baht(Math.max(0, total))}</b>
          </div>
          {method === "thai_help_thai" && (
            <div className="assistance-split">
              <div>
                <span>รัฐช่วยจ่าย {rate / 100}%</span>
                <b>{baht(Math.max(0, government))}</b>
              </div>
              <div>
                <span>ลูกค้าจ่าย {(10000 - rate) / 100}%</span>
                <b>{baht(Math.max(0, customer))}</b>
              </div>
            </div>
          )}
          <div className="payment-amount">
            <span>เรียกเก็บจากลูกค้า</span>
            <strong>{baht(Math.max(0, customer))}</strong>
          </div>
          <label>
            รับเงินจากลูกค้า (บาท)
            <input
              className="cash-input"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              value={received}
              disabled={locked}
              onChange={(event) => setReceived(event.target.value)}
            />
          </label>
          <div className="cash-presets">
            {[...new Set([Math.max(0, customer), 10000, 50000, 100000])]
              .filter((value) => value >= customer)
              .map((value, index) => (
                <button
                  type="button"
                  key={value}
                  disabled={locked}
                  onClick={() => setReceived(String(value / 100))}
                >
                  {index === 0 ? "พอดี" : value / 100}
                </button>
              ))}
          </div>
          {method === "thai_help_thai" && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={locked}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                ตรวจสอบการรับชำระผ่านโครงการแล้ว ยอดรัฐช่วยจ่ายตรงกับ {baht(Math.max(0, government))}
              </span>
            </label>
          )}
          <div className={`change-box ${cash < customer ? "insufficient" : ""}`}>
            <span>{received && cash < customer ? "ลูกค้ายังขาดอีก" : "เงินทอนลูกค้า"}</span>
            <strong>{baht(received ? Math.abs(cash - customer) : 0)}</strong>
          </div>
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          {locked && !busy && (
            <p className="assistance-note">
              บิลนี้รอตรวจผลการบันทึก กดยืนยันอีกครั้งด้วยรหัสเดิมเพื่อป้องกันบิลซ้ำ
            </p>
          )}
          <button className="button primary large full" disabled={!valid || busy || saving}>
            <Check size={24} />
            {busy ? "กำลังบันทึก…" : "ยืนยันรับเงินและปิดบิล"}
          </button>
        </form>
      </div>
    </section>
  );
}
