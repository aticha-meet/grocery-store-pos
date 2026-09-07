import { useCallback, useEffect, useState } from "react";
import {
  Store,
  ShoppingBasket,
  Package,
  TriangleAlert,
  ChartNoAxesCombined,
  ReceiptText,
  Settings,
  LogOut,
  ShieldCheck,
  CircleHelp,
  ArrowRight,
  WifiOff,
  X,
  PanelLeftClose,
} from "lucide-react";
import { api, post, lowStock, type Product, type User } from "./types";
import { POS } from "./POS";
import { Inventory } from "./Inventory";
import { Reports, SalesHistory, SettingsPage } from "./Management";
import { Modal } from "./components";
type Page = "pos" | "inventory" | "alerts" | "reports" | "sales" | "settings";
const pages = [
  { id: "pos", label: "ขายหน้าร้าน", icon: ShoppingBasket },
  { id: "inventory", label: "คลังสินค้า", icon: Package },
  { id: "alerts", label: "สินค้าใกล้หมด", icon: TriangleAlert },
  { id: "sales", label: "ประวัติการขาย", icon: ReceiptText },
  { id: "reports", label: "รายงานยอดขาย", icon: ChartNoAxesCombined },
] as const;
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [setup, setSetup] = useState(false);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>("pos");
  const [products, setProducts] = useState<Product[]>([]);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [help, setHelp] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [demo, setDemo] = useState(false);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const refresh = useCallback(async () => {
    try {
      setProducts(await api<Product[]>("/products"));
    } catch (e) {
      notify((e as Error).message, true);
    }
  }, [notify]);
  useEffect(() => {
    api<{ user: User | null; needsSetup: boolean; demo: boolean }>("/session")
      .then((s) => {
        setUser(s.user);
        setSetup(s.needsSetup);
        setDemo(s.demo);
        setReady(true);
      })
      .catch((e) => {
        notify(e.message, true);
        setReady(true);
      });
  }, [notify]);
  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);
  useEffect(() => {
    const expire = () => {
      setUser(null);
      setPage("pos");
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 9000 : 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const alerts = products.filter(lowStock);
  const logout = async () => {
    try {
      await post("/logout", {});
      setUser(null);
      setPage("pos");
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const toastView = (
    <>
      {demo && (
        <div className="demo-ribbon">
          โหมดทดลอง · ข้อมูลแยกจากร้านจริง · demo / demo-store-2026
        </div>
      )}
      {toast && (
        <div role="alert" className={`toast ${toast.error ? "error" : ""}`}>
          <span>{toast.message}</span>
          <button aria-label="ปิดข้อความ" onClick={() => setToast(null)}>
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
  if (!ready)
    return (
      <div className="loading">
        <Store size={48} />
        <p>กำลังเปิดร้าน…</p>
      </div>
    );
  if (!user)
    return (
      <>
        <Login
          setup={setup}
          onLogin={(u) => {
            setUser(u);
            setSetup(false);
          }}
          notify={notify}
        />
        {toastView}
      </>
    );
  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("pos");
          }}
        >
          <span className="brand-mark">
            <Store size={29} />
          </span>
          <span>
            <strong>
              บ้านร้าน<span className="brand-dot">.</span>
            </strong>
            <small>เพื่อนคู่คิด ร้านของคุณ</small>
          </span>
        </a>
        <div className="store-name">
          <span className="store-avatar">บ</span>
          <div>
            <b>ร้านของฉัน</b>
            <small>จุดขายหลัก · เครื่องที่ 01</small>
          </div>
          <span className="online-dot" />
        </div>
        <p className="nav-caption">จัดการร้าน</p>
        <nav>
          {pages
            .filter(
              (p) =>
                user.role === "owner" ||
                !["reports", "inventory"].includes(p.id),
            )
            .map((p) => (
              <button
                key={p.id}
                className={`nav-item ${page === p.id ? "active" : ""}`}
                onClick={() => setPage(p.id)}
              >
                <p.icon size={22} />
                <span>{p.label}</span>
                {p.id === "alerts" && alerts.length > 0 && (
                  <b className="nav-badge">{alerts.length}</b>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card">
            <ShieldCheck size={22} />
            <div>
              <b>พร้อมขาย แม้ออฟไลน์</b>
              <small>ข้อมูลบันทึกในเครื่องของคุณ</small>
            </div>
          </div>
          {user.role === "owner" && (
            <button
              className={`nav-item ${page === "settings" ? "active" : ""}`}
              onClick={() => setPage("settings")}
            >
              <Settings size={22} />
              <span>ตั้งค่าร้าน</span>
            </button>
          )}
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={22} />
            <span>วิธีใช้งาน</span>
          </button>
          <div className="user-card">
            <span className="avatar">{user.name.charAt(0)}</span>
            <div>
              <b>{user.name}</b>
              <small>
                {user.role === "owner" ? "เจ้าของร้าน" : "พนักงานขาย"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="ออกจากระบบ"
              onClick={logout}
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button"
              aria-label="ย่อหรือขยายเมนู"
              onClick={() => setCollapsed(!collapsed)}
            >
              <PanelLeftClose size={20} />
            </button>
            <span>ร้านของฉัน</span>
            <span className="divider">/</span>
            <b>{pages.find((p) => p.id === page)?.label ?? "ตั้งค่าร้าน"}</b>
          </div>
          <div className="topbar-right">
            <span className="local-pill">
              <span className="online-dot" />
              ทำงานในเครื่อง
            </span>
            <span className="date-label">
              {new Date().toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </header>
        <main>
          <section hidden={page !== "pos"}>
            <POS
              active={page === "pos"}
              storageKey={`cart-${user.id}`}
              products={products}
              refresh={refresh}
              notify={notify}
              onAlerts={() => setPage("alerts")}
            />
          </section>
          <div className="content-page" hidden={page === "pos"}>
            {(page === "inventory" || page === "alerts") && (
              <Inventory
                products={products}
                alertsOnly={page === "alerts"}
                owner={user.role === "owner"}
                refresh={refresh}
                notify={notify}
              />
            )}{" "}
            {page === "reports" && <Reports notify={notify} />}{" "}
            {page === "sales" && (
              <SalesHistory
                owner={user.role === "owner"}
                refresh={refresh}
                notify={notify}
              />
            )}{" "}
            {page === "settings" && <SettingsPage notify={notify} />}
          </div>
        </main>
      </div>
      {toastView}
      {help && (
        <Modal title="เริ่มใช้งานบ้านร้าน" onClose={() => setHelp(false)}>
          <div className="help-copy">
            <p>
              <b>1. เพิ่มสินค้า</b>
              <br />
              ไปที่คลังสินค้า กด “เพิ่มสินค้า” แล้วกรอกบาร์โค้ด ราคา และสต็อก
              หรือใช้สินค้าตัวอย่างที่เลือกตอนตั้งค่าร้าน
            </p>
            <p>
              <b>2. ขายหน้าร้าน</b>
              <br />
              คลิกสินค้า หรือสแกนบาร์โค้ดที่ลงท้ายด้วย Enter ปรับจำนวน แล้วกด
              “รับชำระเงิน” หรือ F4
            </p>
            <p>
              <b>3. รับเงินและพิมพ์</b>
              <br />
              กรอกเงินสดที่รับ ยืนยันขาย และพิมพ์ผ่านไดรเวอร์เครื่องพิมพ์ในระบบ
              (ตั้งกระดาษ 80 มม.)
            </p>
            <p>
              <b>4. คืนสินค้าและสำรองข้อมูล</b>
              <br />
              เจ้าของร้านคืนทั้งบิลได้ในประวัติการขาย
              และสำรองฐานข้อมูลได้ในตั้งค่าร้าน
            </p>
            <p className="muted">
              F2: ช่องค้นหา · F4: รับชำระ · Esc: ปิดหน้าต่าง
              <br />
              สแกนบาร์โค้ดขณะเลือกหน้าขายและไม่มีหน้าต่างซ้อน
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Login({
  setup,
  onLogin,
  notify,
}: {
  setup: boolean;
  onLogin: (u: User) => void;
  notify: (m: string, e?: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const data = {
        username: String(f.get("username")),
        password: String(f.get("password")),
        name: String(f.get("name")),
        demo: f.get("demo") === "on",
      };
      if (setup) await post("/setup", data);
      const response = await post<{ user: User }>("/login", data);
      onLogin(response.user);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-screen">
      <section className="login-story">
        <div className="brand light">
          <span className="brand-mark">
            <Store size={32} />
          </span>
          <span>
            <strong>บ้านร้าน.</strong>
            <small>เพื่อนคู่คิด ร้านของคุณ</small>
          </span>
        </div>
        <span className="eyebrow">เรื่องร้าน ให้เป็นเรื่องง่าย</span>
        <h1>
          ขายคล่อง
          <br />
          สต็อกครบ
          <br />
          <span>จบในที่เดียว.</span>
        </h1>
        <p>
          พื้นที่เล็ก ๆ ที่ช่วยดูแลทุกรายการขาย
          <br />
          ให้คุณมีเวลาดูแลลูกค้าได้มากขึ้น
        </p>
        <div className="story-shelf">
          🥛 <span>🍜</span> 🥫 <span>🧃</span>
        </div>
        <div className="story-footer">
          <WifiOff size={20} />
          ใช้งานออฟไลน์ได้ · ข้อมูลอยู่ในเครื่องคุณ
        </div>
      </section>
      <section className="login-form">
        <div className="login-form-inner">
          <span className="eyebrow green">ยินดีต้อนรับสู่บ้านร้าน</span>
          <h2>
            {setup ? "มาเปิดร้านกันเลย" : "พร้อมเริ่มวันใหม่แล้วหรือยัง?"}
          </h2>
          <p className="muted">
            {setup
              ? "สร้างบัญชีเจ้าของร้านเพื่อเริ่มใช้งานครั้งแรก"
              : "เข้าสู่ระบบเพื่อเริ่มขายและดูแลร้านของคุณ"}
          </p>
          <form onSubmit={submit}>
            {setup && (
              <label>
                ชื่อเจ้าของร้าน
                <input
                  name="name"
                  required
                  maxLength={80}
                  placeholder="ชื่อที่ใช้แสดงในใบเสร็จ"
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              ชื่อผู้ใช้
              <input
                name="username"
                required
                minLength={3}
                maxLength={40}
                pattern="[a-zA-Z0-9_-]+"
                placeholder="เช่น owner"
                autoComplete="username"
              />
            </label>
            <label>
              รหัสผ่าน
              <input
                name="password"
                type="password"
                required
                minLength={setup ? 8 : 1}
                maxLength={128}
                placeholder={
                  setup ? "อย่างน้อย 8 ตัวอักษร" : "กรอกรหัสผ่านของคุณ"
                }
                autoComplete={setup ? "new-password" : "current-password"}
              />
            </label>
            {setup && (
              <label className="checkbox-label">
                <input type="checkbox" name="demo" />
                <span>
                  เพิ่มสินค้าตัวอย่าง 18 รายการให้ทดลองขาย
                  <small>เป็นข้อมูลทดสอบ ควรใช้ฐานข้อมูลใหม่ก่อนขายจริง</small>
                </span>
              </label>
            )}
            <button className="button primary large full" disabled={busy}>
              {busy
                ? "กำลังดำเนินการ…"
                : setup
                  ? "สร้างร้านและเริ่มใช้งาน"
                  : "เข้าสู่ร้าน"}
              <ArrowRight size={24} />
            </button>
          </form>
          <div className="login-note">
            <ShieldCheck size={22} />
            <span>
              ข้อมูลถูกจัดเก็บไว้ในเครื่องนี้เท่านั้น
              <br />
              ไม่ต้องสมัครสมาชิกออนไลน์
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
