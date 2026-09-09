export type User =
  {
    id: string;
    name: string;
    username: string;
    role: 'owner' | 'cashier'
  };


export type Product =
  {
    id: string;
    name: string;
    barcode: string;
    category: string;
    costPrice: number;
    sellPrice: number;
    unit: string;
    stockQty: number;
    reorderThreshold: number;
    icon: string
  };

export type CartItem = {
  product: Product;
  quantity: number
};


export type Sale = { paymentMethod: string; governmentRateBps: number; governmentAmount: number; customerAmount: number; id: string; totalAmount: number; discount: number; paymentReceived: number; change: number; cashier: string; createdAt: string; returnedAt: string | null; returnReason: string | null; items: { id: string; productId: string; name: string; quantity: number; unitPrice: number; subtotal: number }[] };
export type Report = { customerTotal: number; governmentTotal: number; total: number; bills: number; profit: number; returns: number; chart: { label: string; amount: number }[]; top: { name: string; quantity: number; revenue: number }[]; bottom: { name: string; quantity: number; revenue: number }[] };
export const money = (cents: number) => (cents / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const baht = (cents: number) => `฿${money(cents)}`;
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const dateTime = (date: string) => new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
export const lowStock = (p: Product) => p.stockQty === 0 || p.stockQty < p.reorderThreshold;
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${url}`, { signal: AbortSignal.timeout(15000), ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401 && url !== '/login') window.dispatchEvent(new Event('session-expired')); throw Object.assign(new Error(data.error ?? 'ไม่สามารถเชื่อมต่อระบบได้'), { status: response.status }); }
  return data;
}
export const post = <T,>(url: string, data: unknown) => api<T>(url, { method: 'POST', body: JSON.stringify(data) });
