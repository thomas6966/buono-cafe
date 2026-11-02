# BUONO Cafe — Telegram Mini App

Telegram Mini App (mijozlar uchun), Telegram bot, API va localhost'da ishlaydigan Admin dashboard.

```
project_root/
├── src/                      # Backend (Node.js + Express + grammY)
│   ├── config/default.js     # .env va sozlamalar
│   ├── core/bot.js           # Bot instansiyasi
│   ├── database/connection.js# Prisma (PostgreSQL / Neon)
│   ├── models/               # User.js, Product.js, Order.js (Prisma logikasi)
│   ├── controllers/          # botController, cartController (Mini App API), adminController
│   ├── routes/               # bot.routes, client.routes, admin.routes
│   ├── middlewares/          # auth.middleware (initData + admin JWT), error.middleware
│   └── index.js
├── prisma/                   # schema.prisma, seed.js, data/menu.snapshot.json
├── client/                   # Mini App (Vite + React + TS + Tailwind + Framer Motion + Zustand)
├── admin/                    # Admin Web Dashboard (React, faqat localhost)
├── uploads/                  # Mahsulot rasmlari
├── .env                      # Maxfiy kalitlar (git'ga qo'shilmaydi)
└── start-dev.bat             # API + botni va adminni bir bosishda ishga tushirish
```

## Ishga tushirish

```bash
npm run install:all     # bir marta: barcha paketlar
npm run db:push         # bir marta: jadvallarni Neon'da yaratish
npm run db:seed         # bir marta: menyu (201 mahsulot) + rasmlar
npm run client:build    # Mini App'ni yig'ish (server uni o'zi tarqatadi)
```

Keyin `start-dev.bat` ni ikki marta bosing (yoki `npm run dev` va `npm run admin:dev`).

| Nima | Manzil |
|---|---|
| Mini App (brauzerda sinash) | http://localhost:3001 |
| Admin dashboard | http://localhost:5174 (parol: `.env` ichida `ADMIN_PASSWORD`) |
| Mini App (hot-reload bilan ishlab chiqish) | `npm run client:dev` → http://localhost:5173 |

Brauzerda ochilganda Mini App "dev rejimi"da ishlaydi (soxta foydalanuvchi). Bu faqat localhost'da ishlaydi.

## Telegram ichida ochish (HTTPS kerak)

Telegram faqat HTTPS manzilni ochadi, `localhost` ishlamaydi. Sinash uchun tunnel:

```bash
npm run tunnel      # start-dev.bat buni o'zi ham ishga tushiradi
```

Skript ochiq HTTPS manzilni oladi, `.webapp-url` ga yozadi va botning menyu tugmasini yangilaydi.
Botni qayta ishga tushirish shart emas: `/start` dagi "Menyuni ochish" tugmasi yangi manzilni o'zi oladi.
Bepul `trycloudflare.com` manzili tunnel har qayta ochilganda o'zgaradi (skript buni o'zi yangilaydi).
Doimiy manzil uchun serverni hostingga joylang va `.env` da `WEBAPP_URL` ni yozing.
Tunnel orqali faqat Mini App va mijoz API'si ochiladi: admin API ochilmaydi (`ADMIN_LOCAL_ONLY=true`).

## Eslatmalar

- **Admin xabarlari:** botdan adminlarga xabar bormaydi. Yangi buyurtma admin dashboardda ovoz bilan chiqadi (5 soniyada yangilanadi). Mijozga holat o'zgarganda bot xabar yuboradi.
- **To'lov:** Click / Payme / Uzum hozircha simulyatsiya (`POST /api/client/orders/:id/pay`). Haqiqiy shlyuz ulanganda shu endpoint o'rniga webhook yoziladi.
- **Narxlar:** server har doim narxni qayta hisoblaydi, mijoz yuborgan narxga ishonilmaydi.
- **Namunaviy qiymatlar:** qo'shimchalar (oat/bodom sut, shot, sirop…), yetkazib berish narxi, bonus foizi, promo `BUONO10` kafe bergan ma'lumot emas, admin dashboardda o'zgartiring.
- **Neon:** `DATABASE_URL` ga `pgbouncer=true` qo'shmang, so'rovlar ~5 barobar sekinlashadi.
- **Menyuni qayta yuklash:** `node prisma/seed.js --reset-menu` (admin'da qilingan o'zgarishlar o'chadi).
