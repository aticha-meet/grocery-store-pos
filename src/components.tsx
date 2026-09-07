import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { X, PackageOpen, Printer, Check } from "lucide-react";
import { createPortal } from 'react-dom';
import { baht, dateTime, type Sale } from "./types";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [error, setError] = useState('');
  useEffect(() => {
    const notice = (event: Event) => { const detail = (event as CustomEvent<{ message: string; error: boolean }>).detail; if (detail.error) setError(detail.message); };
    window.addEventListener('pos-notice', notice); return () => window.removeEventListener('pos-notice', notice);
  }, []);
  useEffect(() => {
    ref.current?.showModal();
    (ref.current?.querySelector<HTMLInputElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLInputElement>('input:not([disabled])'))?.focus();
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="ปิดหน้าต่าง"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
      {error && <p role="alert" className="inline-error">{error}</p>}
    </dialog>
  );
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <PackageOpen size={42} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Receipt({ sale }: { sale: Sale }) {
  return <><ReceiptBody sale={sale}/>{createPortal(<div className="print-only" aria-hidden="true"><ReceiptBody sale={sale}/></div>, document.body)}</>;
}
function ReceiptBody({ sale }: { sale: Sale }) {
  return (
    <div className="receipt">
      <h2>บ้านร้าน</h2>
      <p>ใบเสร็จรับเงิน / ใบสรุปการขาย</p>
      <p>
        #{sale.id.slice(-8).toUpperCase()}
        <br />
        {dateTime(sale.createdAt)}
        <br />
        ผู้ขาย: {sale.cashier}
      </p>
      <hr />
      {sale.items.map((i) => (
        <div className="receipt-item" key={i.id}>
          <span>
            {i.name}
            <small>
              {i.quantity} × {baht(i.unitPrice)}
            </small>
          </span>
          <b>{baht(i.subtotal)}</b>
        </div>
      ))}
      <hr />
      {sale.discount > 0 && (
        <div className="spread">
          <span>ส่วนลด</span>
          <span>-{baht(sale.discount)}</span>
        </div>
      )}
      <div className="spread">
        <b>ยอดสุทธิ</b>
        <b>{baht(sale.totalAmount)}</b>
      </div>
      <div className="spread">
        <span>รับเงิน</span>
        <span>{baht(sale.paymentReceived)}</span>
      </div>
      <div className="spread">
        <span>เงินทอน</span>
        <span>{baht(sale.change)}</span>
      </div>
      {sale.returnedAt && <p>คืนทั้งบิลแล้ว: {sale.returnReason}</p>}
      <hr />
      <p>
        ขอบคุณที่อุดหนุน แล้วพบกันใหม่นะคะ
        <br />
        <small>เอกสารนี้ไม่ใช่ใบกำกับภาษี</small>
      </p>
    </div>
  );
}
export function SaleComplete({
  sale,
  onClose,
}: {
  sale: Sale;
  onClose: () => void;
}) {
  return (
    <Modal title="บันทึกการขายสำเร็จ" onClose={onClose}>
      <div className="success-message">
        <span className="success-icon">
          <Check size={32} />
        </span>
        <p>เงินทอน</p>
        <strong>{baht(sale.change)}</strong>
      </div>
      <Receipt sale={sale} />
      <div className="modal-actions">
        <button className="button secondary" onClick={() => window.print()}>
          <Printer size={20} />
          พิมพ์ใบเสร็จ
        </button>
        <button className="button primary" onClick={onClose}>
          เริ่มบิลใหม่
        </button>
      </div>
    </Modal>
  );
}
