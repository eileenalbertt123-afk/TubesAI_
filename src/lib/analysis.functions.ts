import { createServerFn } from "@tanstack/react-start";
import type { AnalysisResult } from "./analysis.types";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm", "video/mov"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const SYSTEM_INSTRUCTION = `Anda adalah asisten verifikasi informasi kesehatan berbahasa Indonesia berbasis bukti ilmiah.
Tugas: menganalisis konten kesehatan (pesan WhatsApp, caption media sosial, artikel, klaim viral), memecahnya menjadi klaim per kalimat, dan memvalidasinya menggunakan konsensus medis dari sumber tepercaya (WHO, CDC, PubMed/NIH, Kemenkes RI, Mayo Clinic, Cleveland Clinic, Harvard Health, NHS).
Selalu jawab DALAM BAHASA INDONESIA dan keluarkan HANYA JSON valid sesuai skema, tanpa penjelasan tambahan, tanpa code fence.

Skema JSON yang WAJIB diikuti:
{
  "credibility_score": number (0-100, skor kredibilitas keseluruhan),
  "overall_risk_level": "LOW" | "MEDIUM" | "HIGH",
  "summary": string (3-5 kalimat ringkasan analisis dalam Bahasa Indonesia),
  "claims": [
    {
      "claim_text": string (klaim per kalimat, kutip langsung dari konten),
      "category": "Vaksin" | "Penyakit Kronis" | "Herbal" | "Nutrisi" | "Diet" | "Obat" | "Kesehatan Mental" | "Gaya Hidup" | "Mitos Umum" | "Lainnya",
      "classification": "SUPPORTED_BY_EVIDENCE" | "NEEDS_VERIFICATION" | "MISLEADING" | "DANGEROUS",
      "explanation": string (penjelasan rinci mengapa diklasifikasikan demikian),
      "risk_level": "LOW" | "MEDIUM" | "HIGH",
      "scientific_validation": string (validasi ilmiah singkat berdasarkan literatur medis),
      "potential_health_impact": string (potensi dampak terhadap kesehatan jika klaim diikuti),
      "confidence_score": number (0-100),
      "consensus_status": "Supported by Medical Consensus" | "Mixed Evidence" | "Insufficient Evidence" | "Contradicts Medical Consensus",
      "evidence_strength": "Very Strong" | "Strong" | "Moderate" | "Weak",
      "sources": [
        { "name": string, "url": string (URL lengkap yang valid), "description": string }
      ]
    }
  ],
  "related_articles": [
    { "title": string, "website": string, "summary": string, "url": string (URL lengkap yang valid) }
  ],
  "public_health_impact": string (3-5 kalimat dampak kesehatan masyarakat jika misinformasi ini menyebar),
  "recommendations": [ string (rekomendasi praktis dalam Bahasa Indonesia, 4-6 item) ]
}

Wajib:
- Setiap klaim memiliki MINIMAL 2 sources dari WHO/CDC/PubMed/NIH/Kemenkes/Mayo/Cleveland/Harvard/NHS dengan URL yang masuk akal.
- related_articles minimal 3 item.
- Jika konten tidak terkait kesehatan, kembalikan claims kosong dan summary menjelaskannya, credibility_score 50, risk LOW.`;

export const analyzeContent = createServerFn({ method: "POST" })
  .validator((data: { content: string }) => {
    if (!data || typeof data.content !== "string") {
      throw new Error("Konten tidak valid.");
    }
    const trimmed = data.content.trim();
    if (trimmed.length < 10) throw new Error("Konten terlalu singkat. Minimal 10 karakter.");
    if (trimmed.length > 32000) throw new Error("Konten terlalu panjang. Maksimal 32.000 karakter.");
    return { content: trimmed };
  })
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi di server.");
    }

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analisis konten kesehatan berikut dan kembalikan JSON sesuai skema:\n\n"""\n${data.content}\n"""`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error("Batas permintaan Gemini tercapai. Silakan coba lagi beberapa saat.");
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error("Kunci API Gemini tidak valid atau ditolak.");
      }
      console.error("Gemini error", res.status, txt);
      throw new Error(`Layanan AI gagal merespons (${res.status}). Coba lagi nanti.`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Respons AI kosong. Silakan coba lagi.");

    let parsed: Omit<AnalysisResult, "original_content" | "analyzed_at">;
    try {
      const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Parse error", e, text.slice(0, 500));
      throw new Error("Format respons AI tidak valid. Silakan coba lagi.");
    }

    return {
      ...parsed,
      original_content: data.content,
      analyzed_at: new Date().toISOString(),
      claims: parsed.claims ?? [],
      related_articles: parsed.related_articles ?? [],
      recommendations: parsed.recommendations ?? [],
      source_type: "TEXT",
    };
  });

/* -------------------- VIDEO TRANSCRIPTION -------------------- */

const TRANSCRIBE_INSTRUCTION = `Anda adalah asisten transkripsi audio/video berbahasa Indonesia.
Tugas: dengarkan seluruh konten video yang diberikan dan kembalikan TRANSKRIP TEKS lengkap dari ucapan yang ada di dalamnya.
Aturan:
- Keluarkan HANYA JSON valid: {"transcript": string, "language": string, "summary_note": string}.
- Field "transcript" berisi seluruh transkrip ucapan apa adanya dalam bahasa aslinya (utamakan Bahasa Indonesia bila ada).
- Jika ada dua bahasa, transkripsikan keduanya secara bergantian.
- Jika video tidak memiliki ucapan, isi transcript dengan deskripsi singkat visual yang relevan untuk verifikasi kesehatan.
- Tidak perlu timestamp. Tidak ada code fence. Tidak ada penjelasan tambahan.`;

export const transcribeVideo = createServerFn({ method: "POST" })
  .validator(async (data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Permintaan tidak valid.");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("File video tidak ditemukan.");
    if (file.size === 0) throw new Error("File video kosong.");
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error("Ukuran video melebihi batas 50 MB.");
    }
    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_VIDEO_MIME.includes(mime) && !/\.(mp4|mov|webm)$/i.test(file.name)) {
      throw new Error("Format video tidak didukung. Gunakan MP4, MOV, atau WEBM.");
    }
    const durationRaw = data.get("duration");
    const duration = typeof durationRaw === "string" ? Number(durationRaw) : 0;
    const buffer = await file.arrayBuffer();
    return {
      file_name: file.name,
      file_size: file.size,
      mime_type: mime || "video/mp4",
      duration_seconds: Number.isFinite(duration) && duration > 0 ? duration : 0,
      bytes: buffer,
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY belum dikonfigurasi di server.");

    // Convert ArrayBuffer to base64 (chunked to avoid call-stack limits).
    const bytes = new Uint8Array(data.bytes);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const base64 = btoa(binary);

    const body = {
      systemInstruction: { parts: [{ text: TRANSCRIBE_INSTRUCTION }] },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: data.mime_type, data: base64 } },
            { text: "Transkripsikan seluruh ucapan pada video ini dan kembalikan JSON sesuai instruksi." },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Batas permintaan Gemini tercapai. Coba lagi nanti.");
      if (res.status === 401 || res.status === 403) throw new Error("Kunci API Gemini ditolak.");
      if (res.status === 413) throw new Error("Video terlalu besar untuk diproses.");
      console.error("Gemini video error", res.status, txt);
      throw new Error(`Gagal memproses video (${res.status}).`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Transkripsi video kosong. Coba video lain.");

    let transcript = "";
    try {
      const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned) as { transcript?: string };
      transcript = (parsed.transcript ?? "").trim();
    } catch {
      transcript = text.trim();
    }

    if (transcript.length < 10) {
      throw new Error("Tidak ada ucapan yang dapat diekstrak dari video ini.");
    }
    if (transcript.length > 32000) transcript = transcript.slice(0, 32000);

    return {
      transcript,
      file_name: data.file_name,
      file_size_bytes: data.file_size,
      duration_seconds: data.duration_seconds,
      mime_type: data.mime_type,
    };
  });

/* -------------------- IMAGE TEXT EXTRACTION -------------------- */

const IMAGE_EXTRACT_INSTRUCTION = `Anda adalah asisten ekstraksi teks dari gambar (OCR) dan analis konten kesehatan berbahasa Indonesia.
Tugas: amati gambar yang diberikan (screenshot WhatsApp, postingan Instagram/TikTok, infografis, artikel, meme, dsb.) dan ekstrak seluruh teks yang terlihat secara lengkap dan akurat.
Aturan:
- Keluarkan HANYA JSON valid: {"extracted_text": string, "confidence": number, "is_health_related": boolean, "visual_note": string}.
- "extracted_text": seluruh teks yang terbaca pada gambar, dipertahankan urutannya. Jika tidak ada teks namun gambar memuat klaim kesehatan visual (mis. obat, herbal, infografik), tuliskan deskripsi ringkas berisi klaim kesehatan yang tersirat.
- "confidence": 0-100, seberapa yakin Anda terhadap akurasi ekstraksi (kualitas keterbacaan).
- "is_health_related": true jika konten berkaitan dengan kesehatan/medis.
- "visual_note": catatan singkat (maks 1 kalimat) tentang jenis gambar (mis. "Screenshot WhatsApp", "Infografik herbal", "Postingan Instagram").
- Jangan tambahkan code fence, penjelasan, atau teks di luar JSON.`;

export const extractImageText = createServerFn({ method: "POST" })
  .validator(async (data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Permintaan tidak valid.");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("File gambar tidak ditemukan.");
    if (file.size === 0) throw new Error("File gambar kosong.");
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("Ukuran gambar melebihi batas 10 MB.");
    }
    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_IMAGE_MIME.includes(mime) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      throw new Error("Format gambar tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP.");
    }
    const buffer = await file.arrayBuffer();
    return {
      file_name: file.name,
      file_size: file.size,
      mime_type: mime || "image/jpeg",
      bytes: buffer,
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY belum dikonfigurasi di server.");

    const bytes = new Uint8Array(data.bytes);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const base64 = btoa(binary);

    const body = {
      systemInstruction: { parts: [{ text: IMAGE_EXTRACT_INSTRUCTION }] },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: data.mime_type, data: base64 } },
            { text: "Ekstrak seluruh teks pada gambar ini dan kembalikan JSON sesuai instruksi." },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Batas permintaan Gemini tercapai. Coba lagi nanti.");
      if (res.status === 401 || res.status === 403) throw new Error("Kunci API Gemini ditolak.");
      if (res.status === 413) throw new Error("Gambar terlalu besar untuk diproses.");
      console.error("Gemini image error", res.status, txt);
      throw new Error(`Gagal memproses gambar (${res.status}).`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Ekstraksi teks gambar kosong. Coba gambar lain.");

    let extracted_text = "";
    let confidence = 0;
    let visual_note = "";
    try {
      const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned) as {
        extracted_text?: string;
        confidence?: number;
        visual_note?: string;
      };
      extracted_text = (parsed.extracted_text ?? "").trim();
      confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));
      visual_note = (parsed.visual_note ?? "").trim();
    } catch {
      extracted_text = text.trim();
      confidence = 50;
    }

    if (extracted_text.length < 10) {
      throw new Error("Tidak ada teks yang dapat diekstrak dari gambar ini.");
    }
    if (extracted_text.length > 32000) extracted_text = extracted_text.slice(0, 32000);

    return {
      extracted_text,
      confidence,
      visual_note,
      file_name: data.file_name,
      file_size_bytes: data.file_size,
      mime_type: data.mime_type,
    };
  });
