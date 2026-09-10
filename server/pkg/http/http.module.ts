import express from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
export function registerHttp(app: express.Express, env = process.env) {
  const publicUrl = env.PD_HOSTNAME ? new URL(env.PD_HOSTNAME) : undefined;
  const allowedHosts = new Set([
    "127.0.0.1",
    "localhost",
    ...(publicUrl ? [publicUrl.hostname] : []),
  ]);
  const origins = new Set([
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    `http://127.0.0.1:${env.PORT ?? 3008}`,
    `http://localhost:${env.PORT ?? 3008}`,
    ...(publicUrl ? [publicUrl.origin] : []),
    ...(env.CORS_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const url = new URL(value);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        )
          throw new Error(
            "CORS_ORIGINS must contain HTTP(S) origins without paths",
          );
        return url.origin;
      }),
  ]);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    next();
  });
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!allowedHosts.has(req.hostname))
      return res.status(403).json({ error: "ไม่อนุญาตให้เข้าถึงผ่านโดเมนนี้" });
    const origin = req.get("origin");
    res.vary("Origin");
    if (origin && !origins.has(origin))
      return res
        .status(403)
        .json({ error: "ไม่อนุญาตให้เข้าถึงจากเว็บไซต์นี้" });
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      if (req.method === "OPTIONS") {
        const methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
        const headers = (req.get("Access-Control-Request-Headers") ?? "")
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean);
        if (
          !methods.includes(req.get("Access-Control-Request-Method") ?? "") ||
          headers.some((header) => header !== "content-type")
        )
          return res
            .status(403)
            .json({ error: "ไม่อนุญาต method หรือ header นี้" });
        res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.sendStatus(204);
      }
    }
    next();
  });
}
export function registerErrors(app: express.Express) {
  app.use("/api", (_req, res) => res.status(404).json({ error: "ไม่พบ API" }));
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof z.ZodError)
        return res.status(400).json({
          error:
            "ข้อมูลไม่ถูกต้อง: " +
            err.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(", "),
        });
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002")
          return res
            .status(409)
            .json({ error: "บาร์โค้ดหรือชื่อผู้ใช้ซ้ำ กรุณาตรวจสอบ" });
        if (err.code === "P2025")
          return res.status(404).json({ error: "ไม่พบข้อมูล" });
        if (["P2034", "P1008"].includes(err.code))
          return res
            .status(409)
            .json({ error: "ฐานข้อมูลกำลังทำงาน กรุณาลองอีกครั้ง" });
      }
      const e = err as Error & {
        status?: number;
      };
      if (!e.status) console.error(err);
      res.status(e.status ?? 500).json({
        error: e.status
          ? e.message
          : "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่",
      });
    },
  );
}
