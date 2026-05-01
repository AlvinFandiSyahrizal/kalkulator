# KalkuPaylator™ — EA Edition 🎮

> "Kalkulator biasa. Hasilnya dijual terpisah."

Project prank kalkulator dengan paywall gaya EA Games. Bayar dulu baru bisa lihat hasil penjumlahan!

---

## 🛠 Setup Step-by-Step

### 1. Install dependencies

```bash
cd kalkupaylator
npm install
```

### 2. Setup Database (PostgreSQL)

Pilih salah satu:

**Opsi A — Local PostgreSQL:**
```bash
# Install PostgreSQL kalau belum ada
# Buat database baru
psql -U postgres -c "CREATE DATABASE kalkupaylator;"
```

**Opsi B — Gratis online (Neon.tech — DIREKOMENDASIKAN):**
1. Daftar di https://neon.tech (gratis, tidak perlu kartu kredit)
2. Buat project baru
3. Copy connection string PostgreSQL-nya

### 3. Setup environment variables

```bash
cp env.local.example .env.local
```

Edit `.env.local` dan isi:
- `DATABASE_URL` → connection string PostgreSQL kamu
- `MIDTRANS_SERVER_KEY` → dari dashboard Midtrans (lihat langkah 4)
- `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` → dari dashboard Midtrans

### 4. Setup Midtrans

1. Daftar di https://dashboard.midtrans.com
2. Login → pilih mode **Sandbox** (untuk testing)
3. Pergi ke **Settings → Access Keys**
4. Copy **Server Key** dan **Client Key** ke `.env.local`
5. Set webhook URL (langkah 6 dulu setelah deploy)

### 5. Setup Prisma (generate & push schema)

```bash
npm run db:generate   # generate Prisma Client
npm run db:push       # push schema ke database
```

Kalau sukses, tabel `Session` dan `Transaction` akan terbuat di database.

### 6. Jalankan development server

```bash
npm run dev
```

Buka http://localhost:3000 — harusnya sudah jalan!

---

## 🧪 Testing Payment (Sandbox)

Untuk test payment di sandbox Midtrans:

**Kartu Kredit Test:**
- Nomor: `4811 1111 1111 1114`
- Expired: bulan/tahun apa saja di masa depan
- CVV: `123`
- OTP: `112233`

**Virtual Account:**
- Gunakan nomor virtual account yang digenerate, bayar lewat simulasi di dashboard Midtrans

**QRIS:**
- Di sandbox, setelah muncul QR bisa langsung klik "Simulate Payment" di dashboard Midtrans

---

## 🌐 Deploy ke Production

### Vercel (DIREKOMENDASIKAN — Gratis)

```bash
npm install -g vercel
vercel
```

Ikuti promptnya, set environment variables di Vercel dashboard.

### Setelah deploy:

1. Copy URL production kamu (misal: `https://kalkupaylator.vercel.app`)
2. Update `.env.local`:
   ```
   NEXT_PUBLIC_APP_URL=https://kalkupaylator.vercel.app
   NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true
   ```
3. Di dashboard Midtrans → **Settings → Configuration**:
   - Payment Notification URL: `https://kalkupaylator.vercel.app/api/payment/webhook`
   - Finish/Error/Pending Redirect URL: `https://kalkupaylator.vercel.app`
4. Ganti ke **Production Keys** di Midtrans (bukan Sandbox lagi)
5. Update environment variables di Vercel

---

## 📁 Struktur Project

```
kalkupaylator/
├── app/
│   ├── page.js              ← Halaman utama
│   ├── layout.js
│   ├── globals.css          ← EA dark theme
│   └── api/
│       ├── payment/
│       │   ├── create/route.js   ← Buat transaksi Midtrans
│       │   ├── verify/route.js   ← Polling status pembayaran
│       │   └── webhook/route.js  ← Notifikasi dari Midtrans
│       └── usage/
│           └── route.js          ← Cek & consume token
│
├── components/
│   ├── Calculator.js        ← UI kalkulator utama
│   └── PaywallModal.js      ← Popup paywall EA-style
│
├── lib/
│   ├── midtrans.js          ← Helper Midtrans API
│   └── db.js                ← Prisma client singleton
│
├── prisma/
│   └── schema.prisma        ← Schema database
│
└── .env.local               ← Config (JANGAN DI-COMMIT!)
```

---

## 💡 Flow Aplikasi

```
User buka kalkulator
    ↓
Masukkan angka + pilih operasi
    ↓
Klik "Hitung"
    ↓
Ada token? ──YES──→ Consume token → Tampilkan hasil
    ↓ NO
Tampilkan PaywallModal
    ↓
User pilih paket (Trial 10k / Lifetime 50k)
    ↓
Midtrans Snap popup
    ↓
User bayar (QRIS / Transfer / dll)
    ↓
Midtrans kirim webhook → server update token
    ↓
Frontend polling → deteksi sukses
    ↓
Otomatis tampilkan hasil kalkulasi tadi
```

---

## ⚠️ Penting

- File `.env.local` **JANGAN di-commit ke Git** (sudah ada di `.gitignore` default Next.js)
- `MIDTRANS_SERVER_KEY` harus tetap di server (tidak boleh di-expose ke client)
- Untuk production, pastikan ganti ke **Production Keys** Midtrans dan ubah `IS_PRODUCTION=true`
- Test webhook lokal bisa pakai `ngrok`: `ngrok http 3000` lalu set URL ngrok ke Midtrans dashboard

---

## 🎭 Disclaimer

Ini project parodi/prank. Tidak berafiliasi dengan EA Games.
Uang yang diterima digunakan untuk biaya server, bukan membeli yacht.