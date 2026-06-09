import jsPDF from "jspdf";
import type { AnalysisResult } from "./analysis.types";
import { classificationLabel, credibilityTier, riskLabel } from "./analysis.helpers";

const MARGIN = 18;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function generatePDFReport(result: AnalysisResult) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const ensureSpace = (h: number) => {
    if (y + h > PAGE_H - MARGIN) {
      addFooter(doc);
      doc.addPage();
      y = MARGIN;
    }
  };

  const text = (
    str: string,
    opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {},
  ) => {
    const { size = 10, bold = false, color = [15, 23, 42], gap = 2 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(str || "-", CONTENT_W);
    const lineH = size * 0.45;
    ensureSpace(lines.length * lineH + gap);
    doc.text(lines, MARGIN, y);
    y += lines.length * lineH + gap;
  };

  const heading = (str: string, size = 14) => {
    ensureSpace(size * 0.6 + 4);
    y += 2;
    doc.setDrawColor(22, 156, 152);
    doc.setLineWidth(0.8);
    doc.line(MARGIN, y - 1, MARGIN + 12, y - 1);
    text(str, { size, bold: true, color: [15, 23, 42], gap: 3 });
  };

  const addFooter = (d: jsPDF) => {
    const total = (d as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
    const cur = (d as unknown as { getCurrentPageInfo: () => { pageNumber: number } }).getCurrentPageInfo().pageNumber;
    d.setFontSize(8);
    d.setTextColor(120, 120, 120);
    d.setFont("helvetica", "normal");
    d.text("NarasiSehat AI — Ringkasan Verifikasi Informasi Kesehatan", MARGIN, PAGE_H - 8);
    d.text(`Halaman ${cur} / ${total}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
  };

  // ---------- COVER ----------
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setFillColor(22, 156, 152);
  doc.rect(0, 0, PAGE_W, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.text("NarasiSehat AI", MARGIN, 80);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 230, 228);
  doc.text("Verifikasi Informasi Kesehatan Berbasis Bukti Ilmiah", MARGIN, 92);

  doc.setDrawColor(22, 156, 152);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 100, MARGIN + 40, 100);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize("Ringkasan Verifikasi Informasi Kesehatan", CONTENT_W);
  doc.text(titleLines, MARGIN, 122);

  const tier = credibilityTier(result.credibility_score);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(220, 230, 240);
  doc.text(`Skor Kredibilitas    : ${result.credibility_score}/100  (${tier.label})`, MARGIN, 152);
  doc.text(`Tingkat Risiko       : ${riskLabel[result.overall_risk_level]}`, MARGIN, 160);
  doc.text(`Jumlah Klaim         : ${result.claims.length} pernyataan diverifikasi`, MARGIN, 168);
  doc.text(`Tanggal Verifikasi   : ${new Date(result.analyzed_at).toLocaleString("id-ID")}`, MARGIN, 176);
  doc.text(`Jenis Sumber         : ${result.source_type === "VIDEO" ? "Video" : result.source_type === "IMAGE" ? "Gambar" : "Teks"}`, MARGIN, 184);

  doc.setFontSize(9);
  doc.setTextColor(160, 180, 200);
  doc.text(
    "Laporan ini disusun berdasarkan referensi ilmiah dari WHO, CDC, PubMed, NIH, Kemenkes RI,",
    MARGIN,
    PAGE_H - 30,
  );
  doc.text(
    "dan jurnal medis tepercaya. Bukan pengganti konsultasi dengan tenaga medis profesional.",
    MARGIN,
    PAGE_H - 25,
  );

  doc.addPage();
  y = MARGIN;
  doc.setTextColor(15, 23, 42);

  // ---------- SOURCE / VIDEO / IMAGE INFO PAGE ----------
  heading(
    result.source_type === "VIDEO"
      ? "Informasi Sumber: Video"
      : result.source_type === "IMAGE"
        ? "Informasi Sumber: Gambar"
        : "Informasi Sumber",
    16,
  );
  text(
    `Jenis Sumber: ${result.source_type === "VIDEO" ? "Video" : result.source_type === "IMAGE" ? "Gambar" : "Teks"}`,
    { size: 11, bold: true },
  );
  text(`Tanggal Analisis: ${new Date(result.analyzed_at).toLocaleString("id-ID")}`, { size: 11 });

  if (result.source_type === "VIDEO" && result.video_info) {
    const v = result.video_info;
    const sizeMb = (v.file_size_bytes / (1024 * 1024)).toFixed(2);
    const dur = v.duration_seconds > 0 ? formatDuration(v.duration_seconds) : "Tidak tersedia";
    text(`Nama File: ${v.file_name}`, { size: 11 });
    text(`Ukuran File: ${sizeMb} MB`, { size: 11 });
    text(`Format: ${v.mime_type}`, { size: 11 });
    text(`Durasi: ${dur}`, { size: 11 });

    doc.addPage();
    y = MARGIN;
    heading("Transkrip Video", 16);
    text(
      "Transkrip berikut diekstrak secara otomatis dari video menggunakan model multimodal Gemini, lalu digunakan sebagai dasar analisis pada halaman berikutnya.",
      { size: 10, color: [80, 90, 110] },
    );
    y += 2;
    doc.setFillColor(248, 250, 252);
    const trLines = doc.splitTextToSize(v.transcript || "-", CONTENT_W - 6);
    const trBoxH = trLines.length * 4.5 + 6;
    ensureSpace(Math.min(trBoxH, 240));
    doc.rect(MARGIN, y - 3, CONTENT_W, Math.min(trBoxH, 240), "F");
    doc.setTextColor(40, 50, 70);
    doc.setFontSize(10);
    let cursor = 0;
    const linesPerPage = 55;
    while (cursor < trLines.length) {
      const slice = trLines.slice(cursor, cursor + linesPerPage);
      if (cursor > 0) {
        doc.addPage();
        y = MARGIN;
        heading("Transkrip Video (lanjutan)", 14);
      }
      doc.setTextColor(40, 50, 70);
      doc.setFontSize(10);
      doc.text(slice, MARGIN, y + 2);
      y += slice.length * 4.5 + 4;
      cursor += linesPerPage;
    }
  }

  if (result.source_type === "IMAGE" && result.image_info) {
    const im = result.image_info;
    const sizeMb = (im.file_size_bytes / (1024 * 1024)).toFixed(2);
    text(`Nama File: ${im.file_name}`, { size: 11 });
    text(`Ukuran File: ${sizeMb} MB`, { size: 11 });
    text(`Format: ${im.mime_type}`, { size: 11 });
    text(`Keyakinan Ekstraksi Teks: ${im.confidence}%`, { size: 11 });

    // Embed image preview
    if (im.data_url && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(im.data_url)) {
      try {
        const format = /png/i.test(im.data_url) ? "PNG" : /webp/i.test(im.data_url) ? "WEBP" : "JPEG";
        const maxW = CONTENT_W;
        const maxH = 110;
        y += 4;
        ensureSpace(maxH + 6);
        doc.addImage(im.data_url, format, MARGIN, y, maxW, maxH, undefined, "FAST");
        y += maxH + 6;
      } catch (e) {
        console.warn("Gagal menyisipkan gambar ke PDF", e);
      }
    }

    doc.addPage();
    y = MARGIN;
    heading("Teks yang Terdeteksi dari Gambar", 16);
    text(
      `Teks berikut diekstrak otomatis dari gambar menggunakan model multimodal Gemini (keyakinan ${im.confidence}%), lalu digunakan sebagai dasar analisis.`,
      { size: 10, color: [80, 90, 110] },
    );
    y += 2;
    const exLines = doc.splitTextToSize(im.extracted_text || "-", CONTENT_W - 6);
    const linesPerPage = 55;
    let cursor = 0;
    while (cursor < exLines.length) {
      const slice = exLines.slice(cursor, cursor + linesPerPage);
      if (cursor > 0) {
        doc.addPage();
        y = MARGIN;
        heading("Teks Gambar (lanjutan)", 14);
      }
      doc.setTextColor(40, 50, 70);
      doc.setFontSize(10);
      doc.text(slice, MARGIN, y + 2);
      y += slice.length * 4.5 + 4;
      cursor += linesPerPage;
    }
  }

  doc.addPage();
  y = MARGIN;
  doc.setTextColor(15, 23, 42);

  // ---------- SUMMARY ----------
  heading("Ringkasan Eksekutif", 16);
  text(result.summary, { size: 11 });

  heading("Ikhtisar Penilaian");
  text(`• Skor Kredibilitas: ${result.credibility_score}/100 (${tier.label})`, { size: 11 });
  text(`• Tingkat Risiko Keseluruhan: ${riskLabel[result.overall_risk_level]}`, { size: 11 });
  text(`• Jumlah Klaim yang Diverifikasi: ${result.claims.length}`, { size: 11 });

  // ---------- KONTEN ----------
  heading("Konten yang Diverifikasi");
  doc.setFillColor(248, 250, 252);
  const contentLines = doc.splitTextToSize(result.original_content, CONTENT_W - 6);
  const boxH = contentLines.length * 4.5 + 6;
  ensureSpace(boxH);
  doc.rect(MARGIN, y - 3, CONTENT_W, boxH, "F");
  doc.setTextColor(60, 70, 90);
  doc.setFontSize(10);
  doc.text(contentLines, MARGIN + 3, y + 2);
  y += boxH + 2;

  // ---------- CLAIMS ----------
  heading("Hasil Verifikasi Tiap Klaim");
  result.claims.forEach((c, i) => {
    ensureSpace(40);
    text(`Klaim #${i + 1} — ${c.category}`, { size: 12, bold: true, color: [18, 120, 116] });
    text(`"${c.claim_text}"`, { size: 10, color: [60, 70, 90] });
    text(`Klasifikasi: ${classificationLabel[c.classification]}  |  Risiko: ${riskLabel[c.risk_level]}  |  Tingkat Keyakinan: ${c.confidence_score}%`, {
      size: 10,
      bold: true,
    });
    text(`Penjelasan Ilmiah: ${c.explanation}`, { size: 10 });
    text(`Validasi Bukti: ${c.scientific_validation}`, { size: 10 });
    text(`Konsensus Medis: ${c.consensus_status}  |  Kekuatan Bukti: ${c.evidence_strength}`, { size: 10 });
    text(`Potensi Dampak Kesehatan: ${c.potential_health_impact}`, { size: 10 });
    if (c.sources?.length) {
      text("Sumber Referensi:", { size: 10, bold: true });
      c.sources.forEach((s) => {
        text(`  • ${s.name} — ${s.description}`, { size: 9, color: [70, 80, 100] });
        text(`    ${s.url}`, { size: 9, color: [18, 120, 116] });
      });
    }
    y += 3;
  });

  // ---------- ARTIKEL TERKAIT ----------
  if (result.related_articles?.length) {
    heading("Bacaan Ilmiah Terkait");
    result.related_articles.forEach((a) => {
      text(`• ${a.title} (${a.website})`, { size: 10, bold: true });
      text(`  ${a.summary}`, { size: 9 });
      text(`  ${a.url}`, { size: 9, color: [18, 120, 116] });
    });
  }

  // ---------- DAMPAK ----------
  heading("Dampak terhadap Kesehatan Masyarakat");
  text(result.public_health_impact, { size: 10 });

  // ---------- REKOMENDASI ----------
  heading("Rekomendasi Tindak Lanjut");
  result.recommendations.forEach((r, i) => text(`${i + 1}. ${r}`, { size: 10 }));

  // footer on every page
  const pages = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (i > 1) addFooter(doc);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  doc.save(`NarasiSehat-AI-Report-${stamp}.pdf`);
}
