import { useEffect, useState } from "react";
import {
  Download,
  ReceiptText,
  Banknote,
  TrendingUp,
  RotateCcw,
  Printer,
  HardDriveDownload,
  UserPlus,
  ScanBarcode,
  ShieldCheck,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  api,
  post,
  baht,
  dateTime,
  today,
  type Report,
  type Sale,
  type User,
} from "./types";
import { Empty, Modal, Receipt } from "./components";
type Notify = (m: string, error?: boolean) => void;
export function Reports({ notify }: { notify: Notify }) {
  const [period, setPeriod] = useState("day");
  const [date, setDate] = useState(today());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<Report>(`/reports?period=${period}&date=${date}`)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((e) => {
        if (!cancelled) {
          notify(e.message, true);
          setReport(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, date, notify]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow green">STORE INSIGHTS</div>
          <h1>
            รายงานยอดขาย<span className="heading-dot">.</span>
          </h1>
          <p>เห็นภาพร้านชัดขึ้น ในทุก ๆ วัน</p>
        </div>
        <a
          className="button secondary"
          href={`/api/reports/export?period=${period}&date=${date}`}
          download
        >
          <Download size={20} />
          ส่งออก CSV
        </a>
      </div>
      <div className="report-filters">
        <div className="segmented">
          {[
            ["day", "รายวัน"],
            ["month", "รายเดือน"],
            ["year", "รายปี"],
          ].map(([value, label]) => (
            <button
              className={period === value ? "selected" : ""}
              key={value}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="date-input">
          เลือกวันที่ในช่วง
          <input
            aria-label="วันที่รายงาน"
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <span className="muted">เวลาประเทศไทย</span>
      </div>
      {loading ? (
        <div className="empty">กำลังสรุปยอดขาย…</div>
      ) : (
        report && (
          <>
            <div className="stat-grid">
              <div className="stat-card emphasis">
                <span className="stat-icon">
                  <Banknote />
                </span>
                <span>ยอดขายสุทธิ</span>
                <strong>{baht(report.total)}</strong>
                <small>หักส่วนลดและบิลที่คืนแล้ว</small>
              </div>
              <div className="stat-card">
                <span className="stat-icon green-bg">
                  <ReceiptText />
                </span>
                <span>จำนวนบิลขาย</span>
                <strong>
                  {report.bills}
                  <small>บิล</small>
                </strong>
                <small>เฉพาะบิลที่ยังไม่คืน</small>
              </div>
              <div className="stat-card">
                <span className="stat-icon amber-bg">
                  <TrendingUp />
                </span>
                <span>กำไรขั้นต้น</span>
                <strong>{baht(report.profit)}</strong>
                <small>ยอดขาย − ต้นทุน ณ วันที่ขาย</small>
              </div>
              <div className="stat-card">
                <span className="stat-icon red-bg">
                  <RotateCcw />
                </span>
                <span>บิลที่คืนสินค้า</span>
                <strong>
                  {report.returns}
                  <small>บิล</small>
                </strong>
                <small>อ้างอิงวันที่ขายเดิม</small>
              </div>
            </div>
            <section className="table-panel"><div className="panel-title"><div><h2>แยกยอดผู้ชำระ</h2><p>รวมเงินสดและส่วนที่ลูกค้าชำระในโครงการ · หักบิลคืนแล้ว</p></div></div><div className="ranking-row"><b>ลูกค้าชำระ</b><strong>{baht(report.customerTotal)}</strong></div><div className="ranking-row"><b>รัฐช่วยจ่าย (ไทยช่วยไทย)</b><strong>{baht(report.governmentTotal)}</strong></div></section>
            <section className="chart-panel">
              <div className="panel-title">
                <div>
                  <h2>แนวโน้มยอดขาย</h2>
                  <p>
                    ยอดขายสุทธิ (บาท) ·{" "}
                    {period === "day"
                      ? date
                      : period === "month"
                        ? date.slice(0, 7)
                        : date.slice(0, 4)}
                  </p>
                </div>
                <span className="chart-legend">
                  <span className="online-dot" />
                  ยอดขาย
                </span>
              </div>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={report.chart}
                    margin={{ left: 8, right: 24, top: 16, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient
                        id="sales-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#23765a"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="#23765a"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 5"
                      vertical={false}
                      stroke="#e8ece6"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={25}
                    />
                    <YAxis tickLine={false} axisLine={false} width={70} />
                    <Tooltip
                      formatter={(value) => [
                        `฿${Number(value).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
                        "ยอดขาย",
                      ]}
                    />
                    <Area
                      dataKey="amount"
                      type="monotone"
                      stroke="#23765a"
                      strokeWidth={3}
                      fill="url(#sales-fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {report.bills === 0 && (
                <p className="chart-empty-note">
                  ยังไม่มียอดขายในช่วงนี้ เริ่มบิลแรกจากหน้าขายได้เลย
                </p>
              )}
            </section>
            <div className="ranking-grid">
              {[
                [report.top, "สินค้าขายดี", "จำนวนชิ้นขายมากที่สุด"],
                [report.bottom, "สินค้าขายน้อย", "รวมสินค้าที่ยังขายไม่ได้"],
              ].map(([rows, title, subtitle], index) => (
                <section className="table-panel" key={index}>
                  <div className="panel-title">
                    <div>
                      <h2>{String(title)}</h2>
                      <p>{String(subtitle)}</p>
                    </div>
                    <span className="soft-badge">5 อันดับ</span>
                  </div>
                  {(rows as Report["top"]).map((row, i) => (
                    <div className="ranking-row" key={row.name}>
                      <span className="rank">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <b>{row.name}</b>
                      <span>{row.quantity} ชิ้น</span>
                    </div>
                  ))}
                  {!(rows as Report["top"]).length && (
                    <Empty title="ยังไม่มีข้อมูล" />
                  )}
                </section>
              ))}
            </div>
            <p className="footnote">
              รายงานนี้หักบิลคืนออกจากวันขายเดิม กำไรเป็นเพียงกำไรขั้นต้น
              ไม่รวมค่าใช้จ่ายร้านและภาษี
            </p>
          </>
        )
      )}
    </>
  );
}
export function SalesHistory({
  owner,
  refresh,
  notify,
}: {
  owner: boolean;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [returning, setReturning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  async function load() {
    try {
      setSales(await api<Sale[]>("/sales"));
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const shown = sales.filter(
    (s) =>
      s.id.toLowerCase().includes(query.toLowerCase()) ||
      s.cashier.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow green">TRANSACTIONS</div>
          <h1>
            ประวัติการขาย<span className="heading-dot">.</span>
          </h1>
          <p>ดูบิล พิมพ์ซ้ำ และรับคืนสินค้าที่นี่</p>
        </div>
        <span className="soft-badge">100 บิลล่าสุด</span>
      </div>
      <div className="table-panel">
        <div className="table-toolbar">
          <h2>รายการขาย</h2>
          <input
            aria-label="ค้นหาบิล"
            placeholder="ค้นหาเลขบิลหรือผู้ขาย"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>เลขบิล / วันเวลา</th>
                <th>ผู้ขาย</th>
                <th>รายการ</th>
                <th>ยอดสุทธิ</th>
                <th>สถานะ</th>
                <th>ใบเสร็จ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>#{s.id.slice(-8).toUpperCase()}</b>
                    <small className="block muted">
                      {dateTime(s.createdAt)}
                    </small>
                  </td>
                  <td>{s.cashier}</td>
                  <td>{s.items.reduce((n, i) => n + i.quantity, 0)} ชิ้น</td>
                  <td className="numeric">{baht(s.totalAmount)}</td>
                  <td>
                    <span
                      className={`status-tag ${s.returnedAt ? "red" : "green"}`}
                    >
                      {s.returnedAt ? "คืนแล้ว" : "สำเร็จ"}
                    </span>
                    <small className="block muted">{s.paymentMethod === 'thai_help_thai' ? `ไทยช่วยไทย · รัฐ ${s.governmentRateBps / 100}%` : 'เงินสด'}</small>
                  </td>
                  <td>
                    <button
                      className="button secondary small"
                      onClick={() => {
                        setSelected(s);
                        setReturning(false);
                      }}
                    >
                      <ReceiptText size={18} />
                      ดูบิล
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? (
          <div className="empty">กำลังโหลดบิล…</div>
        ) : (
          !shown.length && (
            <Empty
              title="ยังไม่มีบิลในรายการนี้"
              detail="บิลจะปรากฏหลังยืนยันการขาย"
            />
          )
        )}
      </div>
      {selected && (
        <Modal
          title={returning ? "คืนสินค้าทั้งบิล" : "รายละเอียดใบเสร็จ"}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          {returning ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                const f = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  await post(`/sales/${selected.id}/return`, {
                    reason: f.get("reason"),
                  });
                  notify(
                    `คืนสินค้าแล้ว — คืนเงินให้ลูกค้า ${baht(selected.customerAmount)}${selected.governmentAmount > 0 ? ' และดำเนินการยกเลิกยอดรัฐในระบบโครงการ' : ''}`,
                  );
                  setSelected(null);
                  await Promise.all([load(), refresh()]);
                } catch (e) {
                  notify((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                ระบบจะคืนสต็อกสินค้าทุกชิ้นในบิลนี้ และหักยอดจากรายงานวันขายเดิม
              </p>
              <div className="change-box">
                <span>เงินที่ต้องคืนให้ลูกค้า</span>
                <strong>{baht(selected.customerAmount)}</strong>
              </div>
              {selected.governmentAmount > 0 && <p className="inline-error">ยอดรัฐ {baht(selected.governmentAmount)} ต้องดำเนินการยกเลิก/คืนผ่านระบบโครงการแยกต่างหาก ไม่จ่ายยอดส่วนนี้เป็นเงินสดให้ลูกค้า</p>}
              <label>
                เหตุผลการคืน
                <input
                  name="reason"
                  required
                  maxLength={200}
                  autoFocus
                  placeholder="เช่น ลูกค้าซื้อผิดรายการ"
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setReturning(false)}
                >
                  กลับ
                </button>
                <button className="button danger" disabled={busy}>
                  ยืนยันคืนทั้งบิล
                </button>
              </div>
            </form>
          ) : (
            <>
              <Receipt sale={selected} />
              <div className="modal-actions">
                {owner && !selected.returnedAt && (
                  <button
                    className="button secondary danger-text"
                    onClick={() => setReturning(true)}
                  >
                    <RotateCcw size={20} />
                    คืนทั้งบิล
                  </button>
                )}
                <button
                  className="button primary"
                  onClick={() => window.print()}
                >
                  <Printer size={20} />
                  พิมพ์ใบเสร็จ
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
export function SettingsPage({ notify }: { notify: Notify }) {
  const [users, setUsers] = useState<User[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<string | null>(null);
  const [automatic, setAutomatic] = useState<{ lastAutomatic: string | null; error: string | null } | null>(null);
  useEffect(() => { api<{ lastAutomatic: string | null; error: string | null }>('/backup/status').then(setAutomatic).catch(e => notify(e.message, true)); }, [notify]);
  const [debounce, setDebounce] = useState(
    localStorage.getItem("scanner-debounce") ?? "300",
  );
  const load = () =>
    api<User[]>("/users")
      .then(setUsers)
      .catch((e) => notify(e.message, true));
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow green">PREFERENCES</div>
          <h1>
            ตั้งค่าร้าน<span className="heading-dot">.</span>
          </h1>
          <p>เตรียมร้านให้พร้อม สำหรับการขายทุกวัน</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="settings-card">
          <span className="settings-icon">
            <HardDriveDownload size={28} />
          </span>
          <h2>สำรองข้อมูลร้าน</h2>
          <p>
            สร้างสำเนาฐานข้อมูลที่สมบูรณ์ระหว่างเปิดร้านได้
            เก็บไฟล์สำรองบนอุปกรณ์อีกตัวเพื่อป้องกันเครื่องเสีย
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await post<{ path: string }>("/backup", {});
                setBackup(result.path);
                notify("สำรองข้อมูลสำเร็จ");
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={20} />
            {busy ? "กำลังสำรอง…" : "สำรองข้อมูลตอนนี้"}
          </button>
          {backup && <p className="backup-path">บันทึกแล้ว: {backup}</p>}
          <p className="backup-path">สำรองอัตโนมัติวันละครั้งขณะเปิดแอป (ตรวจทุก 5 นาที){automatic?.lastAutomatic && <><br/>ล่าสุด: {automatic.lastAutomatic}</>}</p>
          {automatic?.error && <p className="inline-error">สำรองอัตโนมัติไม่สำเร็จ: {automatic.error}</p>}
          <small className="muted">
            วิธีกู้คืนอยู่ใน README.md ของโปรเจกต์
          </small>
        </section>
        <section className="settings-card">
          <span className="settings-icon">
            <ScanBarcode size={28} />
          </span>
          <h2>เครื่องสแกนบาร์โค้ด</h2>
          <p>
            รองรับ USB HID ที่ส่ง Enter ท้ายรหัส
            ปรับเวลาป้องกันการสแกนซ้ำตามความเร็วเครื่องของคุณ
          </p>
          <label>
            ป้องกันสแกนซ้ำภายใน
            <select
              value={debounce}
              onChange={(e) => {
                setDebounce(e.target.value);
                localStorage.setItem("scanner-debounce", e.target.value);
                notify("บันทึกการตั้งค่าแล้ว");
              }}
            >
              <option value="0">ปิด</option>
              <option value="200">200 มิลลิวินาที</option>
              <option value="300">300 มิลลิวินาที (แนะนำ)</option>
              <option value="500">500 มิลลิวินาที</option>
              <option value="1000">1 วินาที</option>
            </select>
          </label>
          <small className="muted">
            ตั้งค่านี้บันทึกเฉพาะเบราว์เซอร์ / หน้าต่างแอปนี้
          </small>
        </section>
      </div>
      <section className="table-panel">
        <div className="table-toolbar">
          <div>
            <h2>ผู้ใช้งานร้าน</h2>
            <p className="muted">
              พนักงานขายรับเงินและดูบิลได้ เจ้าของร้านจัดการข้อมูลทั้งหมด
            </p>
          </div>
          <button className="button secondary" onClick={() => setAdding(true)}>
            <UserPlus size={20} />
            เพิ่มพนักงาน
          </button>
        </div>
        {users.map((u) => (
          <div className="user-row" key={u.id}>
            <span className="avatar">{u.name.charAt(0)}</span>
            <div>
              <b>{u.name}</b>
              <small>{u.username}</small>
            </div>
            <span className="status-tag green">
              <ShieldCheck size={16} />
              {u.role === "owner" ? "เจ้าของร้าน" : "พนักงานขาย"}
            </span>
          </div>
        ))}
      </section>
      {adding && (
        <Modal
          title="เพิ่มบัญชีพนักงานขาย"
          onClose={() => {
            if (!busy) setAdding(false);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await post("/users", Object.fromEntries(f));
                setAdding(false);
                await load();
                notify("เพิ่มพนักงานแล้ว");
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              ชื่อพนักงาน
              <input name="name" required maxLength={80} />
            </label>
            <label>
              ชื่อผู้ใช้
              <input
                name="username"
                required
                minLength={3}
                maxLength={40}
                pattern="[a-zA-Z0-9_-]+"
                autoComplete="off"
              />
            </label>
            <label>
              รหัสผ่าน
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <button className="button primary full" disabled={busy}>
              เพิ่มพนักงาน
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
