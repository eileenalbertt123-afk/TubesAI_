# NarasiSehat AI

> **AI Assistant untuk Mendeteksi dan Memverifikasi Klaim Kesehatan pada Konten Digital Indonesia**

## Deskripsi

NarasiSehat AI adalah platform berbasis kecerdasan buatan yang dirancang untuk membantu masyarakat, khususnya mahasiswa, dalam memverifikasi informasi kesehatan yang beredar di media sosial. Pengguna dapat memasukkan teks, caption, artikel, video, maupun gambar yang ingin diperiksa, lalu sistem akan menganalisis setiap klaim kesehatan secara otomatis, memberikan skor kredibilitas, dan mereferensikan sumber ilmiah terpercaya seperti WHO, PubMed, dan Kementerian Kesehatan RI.

Berbeda dengan platform fact-checking konvensional (seperti Turnbackhoax atau CekFakta) yang mengandalkan verifikasi manual, NarasiSehat AI bekerja secara **otomatis dan real-time**, menganalisis klaim **per kalimat**, dan dioptimalkan untuk konten **Bahasa Indonesia** termasuk bahasa gaul dan campuran yang umum di media sosial.

## Fitur Utama

| Fitur | Deskripsi |
|---|---|
| **Analisis Teks** | Paste teks dari WhatsApp, caption Instagram/TikTok, atau artikel kesehatan |
| **Analisis Video** | Upload video, sistem akan mentranskrip audio lalu menganalisis klaim |
| **Analisis Gambar** | Upload gambar/screenshot, sistem mengekstrak teks lalu memverifikasi klaim |
| **Analisis Per Klaim** | Setiap klaim diidentifikasi dan diverifikasi secara terpisah |
| **Skor Kredibilitas** | Skor 0–100 yang menunjukkan tingkat kepercayaan informasi |
| **Klasifikasi Risiko** | Kategori Rendah / Sedang / Tinggi berdasarkan skor |
| **Referensi Ilmiah** | Validasi berbasis WHO, PubMed, dan Kemenkes RI |
| **Artikel Terkait** | Rekomendasi bacaan pendukung untuk topik yang dianalisis |
| **Ekspor Laporan PDF** | Hasil analisis dapat diunduh sebagai laporan PDF profesional |

### Kategori Klasifikasi Klaim

- `SUPPORTED_BY_EVIDENCE`, Didukung bukti ilmiah
- `NEEDS_VERIFICATION`, Perlu verifikasi lebih lanjut
- `MISLEADING`, Menyesatkan
- `DANGEROUS`, Berbahaya dan tidak berdasar

### AI Tools Pengembangan

- **Gemini API** — Mesin analisis utama: deteksi klaim, penilaian kredibilitas, klasifikasi risiko, generasi referensi
- **Lovable AI** — Perancangan antarmuka dan deployment
- **Claude** — Validasi rancangan sistem dan evaluasi
- **ChatGPT** — Brainstorming dan penyusunan konsep

## Struktur Proyek

```
sehat-cek-ai/
├── src/
│   ├── components/
│   │   └── ui/                  # Komponen shadcn/ui (button, card, dialog, dll.)
│   ├── hooks/
│   │   └── use-mobile.tsx       # Hook deteksi perangkat mobile
│   ├── lib/
│   │   ├── analysis.types.ts    # Type definitions (AnalysisResult, ClaimAnalysis, dll.)
│   │   ├── analysis.functions.ts # Fungsi analisis: analyzeContent, transcribeVideo, extractImageText
│   │   ├── analysis.helpers.ts  # Helper: label risiko, warna, format tanggal
│   │   ├── config.server.ts     # Konfigurasi server (API keys)
│   │   ├── pdf-report.ts        # Generator laporan PDF
│   │   └── utils.ts             # Utilitas umum (cn, dll.)
│   ├── routes/
│   │   ├── __root.tsx           # Root layout
│   │   └── index.tsx            # Halaman utama (UI analisis)
│   ├── router.tsx               # Konfigurasi router
│   ├── server.ts                # Entry point server
│   ├── start.ts                 # Entry point aplikasi
│   └── styles.css               # Global styles
├── .env                         # Variabel lingkungan (lihat bagian Setup)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Cara Menjalankan

### Prasyarat

- [Bun](https://bun.sh) versi terbaru
- Gemini API key (diperoleh dari [Google AI Studio](https://aistudio.google.com))

### 1. Clone & Install

```bash
git clone <repo-url>
cd sehat-cek-ai
bun install
```

### 2. Konfigurasi Environment

Buat file `.env` di root proyek (atau edit yang sudah ada):

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Jalankan Development Server

```bash
bun dev
```

Aplikasi akan berjalan di `http://localhost:3000`.

### 4. Build untuk Produksi

```bash
bun run build
bun run preview
```

## Alur Kerja Sistem

```
Pengguna input konten (teks / video / gambar)
        ↓
Preprocessing teks (pembersihan & normalisasi)
        ↓
Deteksi klaim kesehatan oleh AI/NLP (Gemini API)
        ↓
Ada klaim? ──Tidak──→ Tampilkan "Tidak ada klaim"
    ↓ Ya
Verifikasi klaim vs. sumber terpercaya
        ↓
Analisis kredibilitas & kebenaran
        ↓
Hitung skor kredibilitas (0–100)
        ↓
Generate penjelasan & referensi pendukung
        ↓
Tampilkan hasil analisis kepada pengguna
```

### Klasifikasi Risiko Berdasarkan Skor

| Skor | Tingkat Risiko |
|---|---|
| 70 – 100 | 🟢 Rendah |
| 40 – 69  | 🟡 Sedang |
| 0 – 39   | 🔴 Tinggi |

---

## Rencana Validasi & Evaluasi

Sistem diuji menggunakan 12 sampel konten kesehatan:

| Kategori | Jumlah Sampel | Sumber |
|---|---|---|
| Konten kesehatan valid | 4 sampel | WHO, Kemenkes RI, jurnal ilmiah terindeks |
| Konten hoaks terverifikasi | 4 sampel | Database hoaks terdokumentasi |
| Konten ambigu / tidak jelas | 4 sampel | Konten media sosial nyata |

---

## Tim Pengembang

**Kelompok Kaloberlimapakeini**

| No. | Nama | NIM |
|---|---|---|
| 1 | Nouvella Rahma Fitrah L. | 24060124120029 |
| 2 | Ovilia Suci Ramadhani | 24060124120040 |
| 3 | Silvani Salsabilla | 24060124130066 |
| 4 | Biyani Andarisky Maratia | 24060124130070 |
| 5 | Eileen Albert Tandrio | 24060124140180 |

**Dosen Pengampu:** Dr. Helmie Arif Wibawa, S.Si., M.Cs.

---

## Referensi

- World Health Organization. (2024). *Infodemic*. https://www.who.int/health-topics/infodemic
- do Nascimento, I. J. B., et al. (2022). Infodemics and Health Misinformation: A Systematic Review of Reviews. *Bulletin of the World Health Organization*, 100(9).
- Kementerian Kesehatan RI. (2021). *Media Sosial: Cara Bendung Peredaran Hoaks Informasi Kesehatan*. https://ayosehat.kemkes.go.id