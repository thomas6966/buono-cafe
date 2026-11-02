# BUONO Cafe: Telegram Mini App

Telegram Mini App (mijozlar), Telegram bot, API va Admin dashboard.

```
project_root/
├── src/                      # Backend (Node.js + Express + grammY), Render'da ishlaydi
│   ├── config/default.js     # .env va sozlamalar
│   ├── core/bot.js           # Bot instansiyasi
│   ├── database/connection.js# Prisma (PostgreSQL / Neon)
│   ├── models/               # User.js, Product.js, Order.js
│   ├── controllers/          # botController, cartController (Mini App API), adminController
│   ├── routes/               # bot.routes, client.routes, admin.routes
│   ├── middlewares/          # auth.middleware (initData + admin JWT), error.middleware
│   └── index.js
├── prisma/                   # schema.prisma, seed.js, data/menu.snapshot.json
├── client/                   # Mini App (Vite + React + TS + Tailwind), Vercel'da ishlaydi
│   └── public/menu/          # 201 ta menyu rasmi (optimallashtirilgan, ~10 MB)
├── admin/                    # Admin dashboard (React), Vercel'da yoki localhost'da
├── render.yaml               # Render sozlamasi
└── start-dev.bat             # Lokal ishga tushirish
```

## Deploy (Render + Vercel)

Tartib muhim: avval backend, keyin Mini App, keyin ikkalasini bir-biriga ulash.

### 1. Backend: Render

1. [render.com](https://render.com) > **New +** > **Blueprint** > `thomas6966/buono-cafe` repo'sini tanlang. `render.yaml` o'qiladi.
2. So'ralgan qiymatlarni kiriting:

| O'zgaruvchi | Qiymat |
|---|---|
| `DATABASE_URL` | Neon (pooler) manzili. `pgbouncer=true` **qo'shmang** |
| `DIRECT_URL` | Xuddi shu manzil, lekin `-pooler` so'zisiz |
| `BOT_TOKEN` | BotFather tokeni |
| `ADMIN_PASSWORD` | Kamida 12 belgili yangi kuchli parol |
| `WEBAPP_URL`, `CORS_ORIGINS` | Hozircha bo'sh qoldiring (3-qadamda to'ldirasiz) |

3. Deploy tugagach manzilni oling: `https://buono-cafe.onrender.com`. `/api/health` ochilsa, tayyor.

### 2. Mini App: Vercel

1. [vercel.com](https://vercel.com) > **Add New > Project** > shu repo.
2. **Root Directory: `client`**. Framework: Vite (o'zi aniqlanadi).
3. **Environment Variables:** `VITE_API_URL` = Render manzili (oxirida `/` siz).
4. Deploy. Manzil: `https://buono-cafe.vercel.app`.

### 3. Ulash

Render > Environment:
- `WEBAPP_URL` = Vercel Mini App manzili
- `CORS_ORIGINS` = Vercel Mini App manzili (admin ham Vercel'da bo'lsa, vergul bilan uni ham)

Render o'zi qayta ishga tushadi. Bot webhook'ni o'zi o'rnatadi va `/start` dagi "Menyuni ochish" tugmasi + chat menyusini yangilaydi.

### 4. Admin dashboard

Admin Mini App bilan bitta Vercel loyihasida, **`/admin/`** manzilida turadi: `https://buono-cafe.vercel.app/admin/`.
Alohida loyiha va qo'shimcha CORS sozlamasi kerak emas. Telefonda ham ochiladi.

Admin kodini o'zgartirsangiz:
```bash
npm run admin:publish   # admin'ni client/public/admin ga yig'adi
```
so'ng Mini App loyihasini Vercel'da qayta deploy qiling.

Admin internetda ochiq bo'lgani uchun kuchli `ADMIN_PASSWORD` shart (login urinishlari cheklangan, sahifa qidiruv tizimlaridan yashirilgan).
Kompyuterda jonli serverga ulangan holda ochish: `start-admin.bat` (http://localhost:5174).

### Render bepul tarifi haqida

- 15 daqiqa so'rov bo'lmasa server uxlaydi. Telegram webhook va Mini App uni uyg'otadi, lekin birinchi javob ~30-60 soniya kechikadi.
- Uxlamasligi uchun [uptimerobot.com](https://uptimerobot.com) da `https://<render-manzil>/api/health` ni har 5 daqiqada tekshirishga qo'ying (bepul), yoki Render'da **Starter** tarifini oling.
- Server diskidagi fayllar saqlanmaydi, shuning uchun admin'dan yuklangan rasmlar bazada saqlanadi, menyu rasmlari esa Mini App ichida (Vercel CDN).

### Lokal sinov va ishlab chiqarish botini aralashtirmang

Deploydan keyin production bot webhook bilan ishlaydi. Lokal `npm run dev` shu bot tokeni bilan ishga tushsa, webhook'ni o'chirib yuborardi.
Shuning uchun server webhook aniqlasa lokal polling'ni ishga tushirmaydi. Lokal sinash uchun BotFather'da alohida test bot oching va uning tokenini lokal `.env` ga yozing.

## Lokal ishga tushirish

```bash
npm run install:all     # bir marta
npm run db:push         # bir marta: jadvallar
npm run db:seed         # bir marta: menyu + rasmlar (client/public/menu)
npm run client:build
```

`start-dev.bat`: API + bot, tunnel va admin. Mini App: http://localhost:3001, admin: http://localhost:5174.
Brauzerda Mini App "dev rejimi"da ishlaydi (soxta foydalanuvchi, faqat localhost'da).
Telegram ichida sinash uchun `npm run tunnel` (cloudflared kerak).

## Eslatmalar

- **Admin xabarlari:** botdan adminlarga xabar bormaydi. Yangi buyurtma admin dashboardda ovoz bilan chiqadi (5 soniyada yangilanadi). Mijozga holat o'zgarganda bot xabar yuboradi.
- **To'lov:** Click / Payme / Uzum hozircha simulyatsiya (`POST /api/client/orders/:id/pay`).
- **Narxlar** serverda qayta hisoblanadi.
- **Namunaviy qiymatlar:** qo'shimchalar, yetkazib berish narxi, bonus foizi va promo `BUONO10` kafe bergan ma'lumot emas, admin dashboardda o'zgartiring.
- **Menyuni qayta yuklash:** `node prisma/seed.js --reset-menu` (admin'dagi o'zgarishlar o'chadi).
