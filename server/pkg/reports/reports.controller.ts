import type { Request, Response } from 'express';
import { report, dateKey } from './reports.service.js';
export const get = async (req: Request, res: Response) => res.json(await report(String(req.query.period ?? "day"), String(req.query.date ?? dateKey(new Date()))));
export const exportCsv = async (req: Request, res: Response) => {
    const period = String(req.query.period ?? "day");
    const date = String(req.query.date ?? dateKey(new Date()));
    const data = await report(period, date);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sales-${period}-${date}.csv"`);
    res.send("\uFEFFช่วงเวลา,ยอดขายสุทธิ (บาท),จำนวนบิล,กำไรขั้นต้น (บาท),บิลคืน\r\n" +
        `${date},${data.total / 100},${data.bills},${data.profit / 100},${data.returns}\r\n\r\nช่วง,ยอดขาย (บาท)\r\n` +
        data.chart.map((p) => `${p.label},${p.amount}`).join("\r\n") +
        `\r\n\r\nผู้ชำระ,ยอด (บาท)\r\nลูกค้า,${data.customerTotal / 100}\r\nรัฐช่วยจ่าย,${data.governmentTotal / 100}\r\n`);
};
