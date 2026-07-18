# 🚀 Render.com + Neon.tech — Bepul Deployment Yo'riqnomasi

## Ma'lumotlar hech qachon yo'qolmaydi, server doim ishlaydi.

---

## 1-QADAM: Neon.tech'da BEPUL database yaratish

1. **https://neon.tech** → "Sign Up" (GitHub bilan kirish mumkin)
2. "New Project" → nom bering (masalan: `tiktoke-erp`)
3. Region: **AWS eu-central-1** (Frankfurt) tanlang
4. "Create project" bosgandan keyin **Connection string** chiqadi:
   ```
   postgresql://username:password@host/dbname?sslmode=require
   ```
5. Bu stringni nusxalab oling — keyingi qadamda kerak bo'ladi.

> ✅ Neon bepul tariff: 0.5GB, hech qachon o'chmaydi, muddatsiz.

---

## 2-QADAM: GitHub'ga kod yuklash

Render.com kod Replit'da ishlayotgan loyihadan avtomatik olib turishi uchun GitHub kerak.

1. GitHub'da yangi repository yarating (masalan: `tiktoke-erp`)
2. Replit'da → **Shell** oching:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/SIZNING_USERNAME/tiktoke-erp.git
   git push -u origin main
   ```

---

## 3-QADAM: Render.com'da deploy

1. **https://render.com** → "Sign Up" (GitHub bilan kirish tavsiya etiladi)
2. Dashboard → **"New +"** → **"Blueprint"** tanlang
3. GitHub repo'ni ulang (`tiktoke-erp`)
4. Render `render.yaml` faylini avtomatik o'qiydi va 2 ta xizmat taklif qiladi:
   - `tiktoke-erp-api` (Express backend)
   - `tiktoke-erp-ui` (React frontend)
5. **"Apply"** bosing

---

## 4-QADAM: Environment variables qo'shish

`tiktoke-erp-api` xizmatiga:

| Kalit | Qiymat |
|-------|--------|
| `DATABASE_URL` | Neon.tech'dan nusxalagan postgresql://... string |
| `SESSION_SECRET` | Render avtomatik yaratadi (hech narsa qilmang) |

1. Render Dashboard → `tiktoke-erp-api` → **Environment** tab
2. `DATABASE_URL` → Neon'dan nusxalagan stringni joylashtiring
3. **Save Changes** → Render avtomatik qayta ishga tushiradi

---

## 5-QADAM: Database jadvallarini yaratish

Backend birinchi marta ishga tushganda jadvallar avtomatik yaratilmaydi.
Render Shell orqali bir marta schema push qilish kerak:

1. Render Dashboard → `tiktoke-erp-api` → **Shell** tab
2. Quyidagini ishga tushiring:
   ```bash
   pnpm --filter @workspace/db run push
   ```
3. Muvaffaqiyatli bo'lgach, admin foydalanuvchi avtomatik yaratiladi.

---

## ✅ Natija

| | Bepul tariff |
|--|--|
| **Database (Neon)** | 0.5GB, muddatsiz, hech qachon o'chmaydi |
| **Backend (Render)** | 750 soat/oy bepul (doim ishlaydi) |
| **Frontend (Render)** | Cheksiz bepul (static site) |
| **Uxlamaslik** | Server har 2 daqiqada o'ziga so'rov yuboradi |
| **Admin ko'rmaydi** | `/api/healthz` logdan yashirilgan |

---

## Eslatmalar

- Render bepul Web Service oyiga **750 soat** beradi — bu 1 ta xizmat uchun butun oy degani (31×24=744)
- Agar 2 ta bepul xizmat ishlatsangiz, har biri 750 soat hisoblaydi — lekin bepul tarifda siz 1 ta bepul xizmat olasiz. Ikkinchisi uchun frontend'ni **Vercel** yoki **Netlify** (bepul) ga deploy qilish mumkin.

---

## Muqobil: Frontend Netlify'ga (to'liq bepul)

Backend Render'da, Frontend Netlify'da:
1. https://netlify.com → "Import from Git"
2. Build command: `npm install -g pnpm && pnpm install && BASE_PATH=/ pnpm --filter @workspace/tiktoke-erp run build`
3. Publish directory: `artifacts/tiktoke-erp/dist/public`
4. Environment variable: `VITE_API_BASE=https://tiktoke-erp-api.onrender.com`
