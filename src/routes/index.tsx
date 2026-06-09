import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  Sparkles,
  FileText,
  Loader2,
  Activity,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Stethoscope,
  Microscope,
  HeartPulse,
  Download,
  RotateCcw,
  Video as VideoIcon,
  Type as TypeIcon,
  Image as ImageIcon,
  UploadCloud,
  X,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  ScanText,
} from "lucide-react";
import { analyzeContent, transcribeVideo, extractImageText } from "@/lib/analysis.functions";
import type { AnalysisResult, VideoInfo, ImageInfo } from "@/lib/analysis.types";
import {
  classificationLabel,
  classificationStyle,
  credibilityBarColor,
  credibilityTier,
  formatDateID,
  riskLabel,
  riskStyle,
} from "@/lib/analysis.helpers";
import { generatePDFReport } from "@/lib/pdf-report";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NarasiSehat AI — Lindungi Diri dari Misinformasi Kesehatan" },
      {
        name: "description",
        content:
          "Analisis pesan WhatsApp, unggahan media sosial, dan artikel kesehatan menggunakan AI berbasis bukti ilmiah dari WHO, PubMed, dan Kemenkes RI.",
      },
      { property: "og:title", content: "NarasiSehat AI" },
      {
        property: "og:description",
        content:
          "Verifikasi klaim kesehatan dari WhatsApp, Instagram, TikTok, dan artikel viral dengan AI berbasis bukti ilmiah.",
      },
    ],
  }),
  component: Home,
});

const MAX_CHARS = 8000;

function Home() {
  const [mode, setMode] = useState<"TEXT" | "VIDEO" | "IMAGE">("TEXT");
  const [content, setContent] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [transcribing, setTranscribing] = useState(false);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState<string>("");
  const [extractionConfidence, setExtractionConfidence] = useState<number>(0);
  const [extractionNote, setExtractionNote] = useState<string>("");

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const analysisMutation = useMutation({
    mutationFn: (text: string) => analyzeContent({ data: { content: text } }),
    onError: (err: Error) => toast.error(err.message ?? "Terjadi kesalahan"),
  });

  const finalize = (
    data: AnalysisResult,
    extras?: { videoInfo?: VideoInfo; imageInfo?: ImageInfo },
  ) => {
    let enriched: AnalysisResult = data;
    if (extras?.videoInfo) {
      enriched = { ...data, source_type: "VIDEO", video_info: extras.videoInfo };
    } else if (extras?.imageInfo) {
      enriched = { ...data, source_type: "IMAGE", image_info: extras.imageInfo };
    } else {
      enriched = { ...data, source_type: "TEXT" };
    }
    setResult(enriched);
    toast.success("Verifikasi selesai");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const handleAnalyzeText = async () => {
    const t = content.trim();
    if (t.length < 10) {
      toast.error("Konten terlalu singkat. Minimal 10 karakter.");
      return;
    }
    try {
      const data = await analysisMutation.mutateAsync(t);
      finalize(data);
    } catch {
      /* handled in onError */
    }
  };

  const handleAnalyzeVideo = async () => {
    if (!videoFile) {
      toast.error("Silakan pilih file video terlebih dahulu.");
      return;
    }
    setTranscribing(true);
    setUploadProgress(0);
    try {
      const ticker = setInterval(() => {
        setUploadProgress((p) => (p < 85 ? p + Math.max(1, Math.round((90 - p) / 12)) : p));
      }, 300);

      const fd = new FormData();
      fd.append("file", videoFile);
      fd.append("duration", String(videoDuration || 0));

      let transcriptResult: Awaited<ReturnType<typeof transcribeVideo>>;
      try {
        transcriptResult = await transcribeVideo({ data: fd });
      } finally {
        clearInterval(ticker);
      }
      setUploadProgress(100);

      const data = await analysisMutation.mutateAsync(transcriptResult.transcript);
      finalize(data, {
        videoInfo: {
          file_name: transcriptResult.file_name,
          file_size_bytes: transcriptResult.file_size_bytes,
          duration_seconds: transcriptResult.duration_seconds,
          mime_type: transcriptResult.mime_type,
          transcript: transcriptResult.transcript,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memproses video.";
      toast.error(message);
    } finally {
      setTranscribing(false);
      setTimeout(() => setUploadProgress(0), 800);
    }
  };

  const handleExtractImage = async () => {
    if (!imageFile) {
      toast.error("Silakan pilih gambar terlebih dahulu.");
      return;
    }
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", imageFile);
      const out = await extractImageText({ data: fd });
      setExtractedText(out.extracted_text);
      setExtractionConfidence(out.confidence);
      setExtractionNote(out.visual_note ?? "");
      toast.success("Teks berhasil diekstrak dari gambar");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengekstrak teks gambar.";
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  };

  const handleAnalyzeImage = async () => {
    const t = extractedText.trim();
    if (!imageFile || !imageDataUrl) {
      toast.error("Silakan unggah gambar terlebih dahulu.");
      return;
    }
    if (t.length < 10) {
      toast.error("Teks hasil ekstraksi terlalu singkat untuk dianalisis.");
      return;
    }
    try {
      const data = await analysisMutation.mutateAsync(t);
      finalize(data, {
        imageInfo: {
          file_name: imageFile.name,
          file_size_bytes: imageFile.size,
          mime_type: imageFile.type || "image/jpeg",
          data_url: imageDataUrl,
          extracted_text: t,
          confidence: extractionConfidence,
        },
      });
    } catch {
      /* handled */
    }
  };

  const loading = analysisMutation.isPending || transcribing || extracting;

  const onAnalyze =
    mode === "TEXT"
      ? handleAnalyzeText
      : mode === "VIDEO"
        ? handleAnalyzeVideo
        : handleAnalyzeImage;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <Header />
      <main>
        <Hero />
        <section id="analyze" className="mx-auto max-w-5xl px-4 pb-16 -mt-6">
          <InputCard
            mode={mode}
            setMode={setMode}
            content={content}
            setContent={setContent}
            videoFile={videoFile}
            setVideoFile={setVideoFile}
            videoDuration={videoDuration}
            setVideoDuration={setVideoDuration}
            uploadProgress={uploadProgress}
            transcribing={transcribing}
            analyzing={analysisMutation.isPending}
            imageFile={imageFile}
            setImageFile={setImageFile}
            imageDataUrl={imageDataUrl}
            setImageDataUrl={setImageDataUrl}
            extracting={extracting}
            extractedText={extractedText}
            setExtractedText={setExtractedText}
            extractionConfidence={extractionConfidence}
            extractionNote={extractionNote}
            onExtractImage={handleExtractImage}
            onAnalyze={onAnalyze}
          />
        </section>

        {loading && <LoadingState transcribing={transcribing} extracting={extracting} />}

        {result && (
          <section ref={resultRef} className="mx-auto max-w-6xl px-4 pb-24 space-y-8">
            <Dashboard result={result} />
            {result.source_type === "VIDEO" && result.video_info && (
              <VideoSourceSection info={result.video_info} />
            )}
            {result.source_type === "IMAGE" && result.image_info && (
              <ImageSourceSection info={result.image_info} />
            )}
            <ClaimsSection result={result} />
            <ArticlesSection result={result} />
            <ImpactSection result={result} />
            <RecommendationsSection result={result} />
            <ActionsBar
              result={result}
              onReset={() => {
                setResult(null);
                setContent("");
                setVideoFile(null);
                setVideoDuration(0);
                setImageFile(null);
                setImageDataUrl(null);
                setExtractedText("");
                setExtractionConfidence(0);
                setExtractionNote("");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </section>
        )}

        {!result && !loading && <FeaturesSection />}
      </main>
      <Footer />
    </div>
  );
}

/* ---------- LAYOUT ---------- */

function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/75 border-b border-border/70">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl grid place-items-center text-primary-foreground shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
            <ShieldCheck className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-[15px] tracking-tight">NarasiSehat AI</div>
            <div className="text-[11px] text-muted-foreground font-medium">Verifikasi informasi kesehatan</div>
          </div>
        </div>
        <a
          href="#analyze"
          className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-foreground text-background hover:bg-foreground/90 transition"
        >
          Cek Sekarang
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0" style={{ background: "var(--gradient-soft)" }} />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-primary) 30%, transparent), transparent)" }}
      />
      <div className="relative mx-auto max-w-4xl px-5 pt-16 pb-16 sm:pt-20 sm:pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/80 backdrop-blur text-foreground/80 text-[11px] font-semibold tracking-wide uppercase mb-7 shadow-sm">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          Didukung analisis berbasis kecerdasan buatan
        </div>
        <h1 className="text-[36px] sm:text-[56px] md:text-[72px] leading-[1.04] font-extrabold tracking-tight text-foreground">
          Cek Fakta Kesehatan{" "}
          <span className="block sm:inline" style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            Sebelum Mempercayainya
          </span>
        </h1>
        <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
          Verifikasi klaim kesehatan dari WhatsApp, TikTok, Instagram, dan artikel online menggunakan AI
          serta referensi ilmiah terpercaya.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-1.5">
          {[
            "Referensi WHO & PubMed",
            "Analisis Berbasis AI",
            "Validasi Per Klaim",
            "Laporan PDF",
          ].map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full bg-card border border-border text-foreground/80"
            >
              <CheckCircle2 className="size-3 text-primary" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <span className="font-semibold text-foreground">NarasiSehat AI</span>
          <span className="hidden sm:inline">— bukan pengganti konsultasi medis profesional.</span>
        </div>
        <div className="font-medium">© {new Date().getFullYear()} NarasiSehat AI</div>
      </div>
    </footer>
  );
}

/* ---------- INPUT ---------- */

function InputCard({
  mode,
  setMode,
  content,
  setContent,
  videoFile,
  setVideoFile,
  videoDuration,
  setVideoDuration,
  uploadProgress,
  transcribing,
  analyzing,
  imageFile,
  setImageFile,
  imageDataUrl,
  setImageDataUrl,
  extracting,
  extractedText,
  setExtractedText,
  extractionConfidence,
  extractionNote,
  onExtractImage,
  onAnalyze,
}: {
  mode: "TEXT" | "VIDEO" | "IMAGE";
  setMode: (m: "TEXT" | "VIDEO" | "IMAGE") => void;
  content: string;
  setContent: (v: string) => void;
  videoFile: File | null;
  setVideoFile: (f: File | null) => void;
  videoDuration: number;
  setVideoDuration: (d: number) => void;
  uploadProgress: number;
  transcribing: boolean;
  analyzing: boolean;
  imageFile: File | null;
  setImageFile: (f: File | null) => void;
  imageDataUrl: string | null;
  setImageDataUrl: (u: string | null) => void;
  extracting: boolean;
  extractedText: string;
  setExtractedText: (v: string) => void;
  extractionConfidence: number;
  extractionNote: string;
  onExtractImage: () => void;
  onAnalyze: () => void;
}) {
  const loading = transcribing || analyzing || extracting;
  const disabled =
    loading ||
    (mode === "TEXT"
      ? content.trim().length < 10
      : mode === "VIDEO"
        ? !videoFile
        : !imageFile || extractedText.trim().length < 10);

  const subtitle =
    mode === "IMAGE"
      ? "Unggah gambar (screenshot WhatsApp, postingan, infografik) untuk diekstrak teksnya dan diverifikasi."
      : "Tempelkan teks, unggah video, atau unggah gambar yang ingin diverifikasi.";

  return (
    <div className="rounded-[24px] border border-border bg-card p-6 sm:p-8 shadow-[var(--shadow-elegant)]">
      <div className="flex items-start gap-3 mb-5">
        <div className="size-11 rounded-2xl bg-primary/10 grid place-items-center text-primary">
          <Microscope className="size-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl sm:text-[22px] font-bold tracking-tight">Periksa Informasi Kesehatan</h2>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Tab selector */}
      <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-muted/70 border border-border mb-5">
        <ModeTab active={mode === "TEXT"} onClick={() => setMode("TEXT")} icon={<TypeIcon className="size-4" />}>
          Teks
        </ModeTab>
        <ModeTab active={mode === "VIDEO"} onClick={() => setMode("VIDEO")} icon={<VideoIcon className="size-4" />}>
          Video
        </ModeTab>
        <ModeTab active={mode === "IMAGE"} onClick={() => setMode("IMAGE")} icon={<ImageIcon className="size-4" />}>
          Gambar
        </ModeTab>
      </div>

      {mode === "TEXT" && (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Contoh: 'Minum air rebusan daun sirsak setiap hari dapat menyembuhkan kanker dalam 2 minggu...'"
            rows={9}
            className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3.5 text-[15px] leading-relaxed outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition placeholder:text-muted-foreground/70 font-medium"
          />
          <div className="mt-3 text-xs text-muted-foreground font-medium tabular-nums">
            {content.length.toLocaleString("id-ID")} / {MAX_CHARS.toLocaleString("id-ID")} karakter
          </div>
        </>
      )}

      {mode === "VIDEO" && (
        <VideoDropzone
          file={videoFile}
          setFile={setVideoFile}
          duration={videoDuration}
          setDuration={setVideoDuration}
          uploadProgress={uploadProgress}
          transcribing={transcribing}
        />
      )}

      {mode === "IMAGE" && (
        <ImageInputArea
          file={imageFile}
          setFile={setImageFile}
          dataUrl={imageDataUrl}
          setDataUrl={setImageDataUrl}
          extracting={extracting}
          extractedText={extractedText}
          setExtractedText={setExtractedText}
          confidence={extractionConfidence}
          note={extractionNote}
          onExtract={onExtractImage}
        />
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground font-medium">
          {mode === "VIDEO"
            ? "Maks. 50 MB · MP4, MOV, WEBM"
            : mode === "IMAGE"
              ? "Maks. 10 MB · JPG, JPEG, PNG, WEBP"
              : "Hasil analisis akan tampil di bawah."}
        </div>
        <button
          disabled={disabled}
          onClick={onAnalyze}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-[15px] font-semibold text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:translate-y-[-1px] active:translate-y-0"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {transcribing
            ? "Mengekstrak Transkrip..."
            : extracting
              ? "Membaca Teks Gambar..."
              : analyzing
                ? "Sedang Menganalisis..."
                : mode === "VIDEO"
                  ? "Analisis Video Sekarang"
                  : mode === "IMAGE"
                    ? "Analisis Gambar Sekarang"
                    : "Analisis Sekarang"}
        </button>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition ${
        active
          ? "bg-card text-foreground shadow-sm border border-border"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function formatSeconds(s: number) {
  if (!s || !Number.isFinite(s)) return "—";
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function VideoDropzone({
  file,
  setFile,
  duration,
  setDuration,
  uploadProgress,
  transcribing,
}: {
  file: File | null;
  setFile: (f: File | null) => void;
  duration: number;
  setDuration: (d: number) => void;
  uploadProgress: number;
  transcribing: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const validate = (f: File): string | null => {
    const okType =
      /^(video\/mp4|video\/quicktime|video\/webm|video\/mov)$/i.test(f.type) ||
      /\.(mp4|mov|webm)$/i.test(f.name);
    if (!okType) return "Format tidak didukung. Gunakan MP4, MOV, atau WEBM.";
    if (f.size > MAX_VIDEO_BYTES) return "Ukuran video melebihi 50 MB.";
    if (f.size === 0) return "File video kosong.";
    return null;
  };

  const accept = (f: File) => {
    const err = validate(f);
    if (err) {
      toast.error(err);
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      setDuration(v.duration || 0);
    };
    v.src = url;
  };

  const clear = () => {
    setFile(null);
    setDuration(0);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (!file) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) accept(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 text-center ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-background hover:border-primary/50 hover:bg-primary/[0.02]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={VIDEO_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) accept(f);
          }}
        />
        <div className="mx-auto size-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4 group-hover:scale-105 transition-transform">
          <UploadCloud className="size-7" />
        </div>
        <div className="text-base font-bold tracking-tight">Tarik & lepas video di sini</div>
        <div className="text-sm text-muted-foreground font-medium mt-1">
          atau <span className="text-primary font-semibold">klik untuk memilih file</span>
        </div>
        <div className="mt-4 inline-flex flex-wrap justify-center gap-1.5">
          {["MP4", "MOV", "WEBM"].map((t) => (
            <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/70">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground font-medium">Maksimal 50 MB</div>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, uploadProgress));

  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-start gap-4">
        <div className="size-14 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <PlayCircle className="size-7" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold tracking-tight truncate" title={file.name}>{file.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium">
                <span>{formatBytes(file.size)}</span>
                <span>·</span>
                <span>Durasi {formatSeconds(duration)}</span>
                <span>·</span>
                <span className="uppercase">{file.type.split("/")[1] || "video"}</span>
              </div>
            </div>
            {!transcribing && (
              <button
                onClick={clear}
                className="size-8 rounded-lg border border-border bg-card hover:bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition"
                aria-label="Hapus video"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {(transcribing || pct > 0) && (
            <div className="mt-4">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground tabular-nums">
                <span>{transcribing ? "Mengunggah & mentranskripsi…" : "Selesai"}</span>
                <span>{pct}%</span>
              </div>
            </div>
          )}

          {previewUrl && !transcribing && (
            <video
              src={previewUrl}
              controls
              className="mt-4 w-full max-h-56 rounded-xl border border-border bg-black"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingState({
  transcribing,
  extracting,
}: {
  transcribing: boolean;
  extracting: boolean;
}) {
  const title = transcribing
    ? "Mengekstrak transkrip video…"
    : extracting
      ? "Membaca teks dari gambar…"
      : "Sedang memverifikasi informasi…";
  const subtitle = transcribing
    ? "Model multimodal Gemini sedang mendengarkan video dan menyusun transkripnya."
    : extracting
      ? "Model multimodal Gemini sedang mengenali teks dan klaim kesehatan pada gambar."
      : "Mengidentifikasi klaim, mencocokkan dengan literatur medis, dan menyusun laporan berbasis bukti.";
  return (
    <div className="mx-auto max-w-3xl px-5 pb-24">
      <div className="rounded-[24px] border border-border bg-card p-10 text-center shadow-[var(--shadow-soft)]">
        <div className="relative mx-auto size-14 grid place-items-center">
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
          <Loader2 className="size-7 text-primary animate-spin relative" />
        </div>
        <h3 className="mt-5 text-lg font-bold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground font-medium max-w-md mx-auto leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

/* ---------- IMAGE INPUT ---------- */

const MAX_IMAGE_BYTES_UI = 10 * 1024 * 1024;
const IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

function ImageInputArea({
  file,
  setFile,
  dataUrl,
  setDataUrl,
  extracting,
  extractedText,
  setExtractedText,
  confidence,
  note,
  onExtract,
}: {
  file: File | null;
  setFile: (f: File | null) => void;
  dataUrl: string | null;
  setDataUrl: (u: string | null) => void;
  extracting: boolean;
  extractedText: string;
  setExtractedText: (v: string) => void;
  confidence: number;
  note: string;
  onExtract: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const validate = (f: File): string | null => {
    const okType =
      /^image\/(jpeg|jpg|png|webp)$/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
    if (!okType) return "Format gambar tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP.";
    if (f.size > MAX_IMAGE_BYTES_UI) return "Ukuran gambar melebihi 10 MB.";
    if (f.size === 0) return "File gambar kosong.";
    return null;
  };

  const accept = (f: File) => {
    const err = validate(f);
    if (err) {
      toast.error(err);
      return;
    }
    setFile(f);
    setExtractedText("");
    const reader = new FileReader();
    reader.onload = () => setDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  const clear = () => {
    setFile(null);
    setDataUrl(null);
    setExtractedText("");
    if (inputRef.current) inputRef.current.value = "";
  };

  if (!file) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) accept(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 text-center ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-background hover:border-primary/50 hover:bg-primary/[0.02]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) accept(f);
          }}
        />
        <div className="mx-auto size-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4 group-hover:scale-105 transition-transform">
          <ImageIcon className="size-7" />
        </div>
        <div className="text-base font-bold tracking-tight">Tarik & lepas gambar di sini</div>
        <div className="text-sm text-muted-foreground font-medium mt-1">
          atau <span className="text-primary font-semibold">klik untuk memilih file</span>
        </div>
        <div className="mt-4 inline-flex flex-wrap justify-center gap-1.5">
          {["JPG", "JPEG", "PNG", "WEBP"].map((t) => (
            <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/70">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground font-medium">Maksimal 10 MB</div>
      </div>
    );
  }

  const confLabel =
    confidence >= 80 ? "Tinggi" : confidence >= 50 ? "Sedang" : confidence > 0 ? "Rendah" : "—";
  const confTone =
    confidence >= 80
      ? "text-success border-success/40 bg-success/10"
      : confidence >= 50
        ? "text-warning border-warning/40 bg-warning/10"
        : confidence > 0
          ? "text-danger border-danger/40 bg-danger/10"
          : "text-muted-foreground border-border bg-muted";

  return (
    <div className="space-y-4">
      {/* Preview card */}
      <div className="rounded-2xl border border-border bg-background p-5">
        <div className="flex items-start gap-4">
          <div className="size-14 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <ImageIcon className="size-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold tracking-tight truncate" title={file.name}>
                  {file.name}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium">
                  <span>{formatBytes(file.size)}</span>
                  <span>·</span>
                  <span className="uppercase">{(file.type.split("/")[1] || "image")}</span>
                </div>
              </div>
              {!extracting && (
                <button
                  onClick={clear}
                  className="size-8 rounded-lg border border-border bg-card hover:bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition"
                  aria-label="Hapus gambar"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            {dataUrl && (
              <img
                src={dataUrl}
                alt="Pratinjau gambar"
                className="mt-4 w-full max-h-72 object-contain rounded-xl border border-border bg-muted/30"
              />
            )}
          </div>
        </div>
      </div>

      {/* Extract button OR extracted text panel */}
      {!extractedText ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
          <div className="text-sm text-muted-foreground font-medium">
            Ekstrak teks pada gambar terlebih dahulu sebelum memverifikasi klaim kesehatannya.
          </div>
          <button
            type="button"
            disabled={extracting}
            onClick={onExtract}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-muted transition disabled:opacity-60"
          >
            {extracting ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
            {extracting ? "Membaca gambar…" : "Ekstrak Teks dari Gambar"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <ScanText className="size-4 text-primary" />
              <h3 className="text-sm font-bold tracking-tight">Teks yang Terdeteksi dari Gambar</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${confTone}`}>
                Keyakinan {confidence}% · {confLabel}
              </span>
              <button
                type="button"
                onClick={onExtract}
                disabled={extracting}
                className="text-xs font-semibold text-primary hover:underline disabled:opacity-60"
              >
                Ekstrak Ulang
              </button>
            </div>
          </div>
          {note && (
            <div className="text-[11px] text-muted-foreground font-medium mb-2">{note}</div>
          )}
          <textarea
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value.slice(0, 32000))}
            rows={8}
            className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-[14px] leading-relaxed outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition font-medium"
          />
          <div className="mt-2 text-[11px] text-muted-foreground font-medium">
            Tinjau dan koreksi teks bila perlu, lalu klik <strong>Analisis Gambar Sekarang</strong>.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- IMAGE SOURCE (result panel) ---------- */

function ImageSourceSection({ info }: { info: ImageInfo }) {
  const [open, setOpen] = useState(false);
  const sizeMb = (info.file_size_bytes / (1024 * 1024)).toFixed(2);
  const confLabel =
    info.confidence >= 80 ? "Tinggi" : info.confidence >= 50 ? "Sedang" : "Rendah";
  const confTone =
    info.confidence >= 80
      ? "text-success border-success/40 bg-success/10"
      : info.confidence >= 50
        ? "text-warning border-warning/40 bg-warning/10"
        : "text-danger border-danger/40 bg-danger/10";
  return (
    <section className="rounded-[24px] border border-border bg-card p-6 sm:p-7 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <ImageIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] sm:text-[20px] font-bold tracking-tight truncate">
                {info.file_name}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">
                <ImageIcon className="size-3" /> Analisis Gambar
              </span>
              <span className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${confTone}`}>
                Keyakinan {info.confidence}% · {confLabel}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium">
              <span>Ukuran: {sizeMb} MB</span>
              <span>·</span>
              <span className="uppercase">{info.mime_type.split("/")[1] || "image"}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-border bg-background hover:bg-muted transition"
        >
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {open ? "Sembunyikan Detail" : "Lihat Gambar & Teks"}
        </button>
      </div>
      {open && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-3">
            <img
              src={info.data_url}
              alt={info.file_name}
              className="w-full max-h-[420px] object-contain rounded-xl bg-muted/30"
            />
          </div>
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Teks yang Terdeteksi dari Gambar
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium">
              {info.extracted_text}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- VIDEO SOURCE / TRANSCRIPT ---------- */

function VideoSourceSection({ info }: { info: VideoInfo }) {
  const [open, setOpen] = useState(false);
  const sizeMb = (info.file_size_bytes / (1024 * 1024)).toFixed(2);
  return (
    <section className="rounded-[24px] border border-border bg-card p-6 sm:p-7 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <VideoIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] sm:text-[20px] font-bold tracking-tight truncate">{info.file_name}</h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">
                <VideoIcon className="size-3" /> Analisis Video
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium">
              <span>Ukuran: {sizeMb} MB</span>
              <span>·</span>
              <span>Durasi: {formatSeconds(info.duration_seconds)}</span>
              <span>·</span>
              <span className="uppercase">{info.mime_type.split("/")[1] || "video"}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-border bg-background hover:bg-muted transition"
        >
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {open ? "Sembunyikan Transkrip" : "Lihat Transkrip Video"}
        </button>
      </div>
      {open && (
        <div className="mt-5 rounded-2xl border border-border bg-background p-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Transkrip Video
          </div>
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium">
            {info.transcript}
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------- DASHBOARD ---------- */

function Dashboard({ result }: { result: AnalysisResult }) {
  const tier = useMemo(() => credibilityTier(result.credibility_score), [result.credibility_score]);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Skor Kredibilitas
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-5xl font-bold ${tier.color}`}>{result.credibility_score}</span>
              <span className="text-muted-foreground text-lg">/ 100</span>
            </div>
            <div className={`mt-1 text-sm font-medium ${tier.color}`}>{tier.label}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground/80 font-semibold mb-1">
              {result.source_type === "VIDEO" ? (
                <><VideoIcon className="size-3" /> Sumber: Video</>
              ) : result.source_type === "IMAGE" ? (
                <><ImageIcon className="size-3" /> Sumber: Gambar</>
              ) : (
                <><TypeIcon className="size-3" /> Sumber: Teks</>
              )}
            </div>
            <div>Dianalisis</div>
            <div className="font-medium text-foreground">{formatDateID(result.analyzed_at)}</div>
          </div>

        </div>
        <TrustMeter score={result.credibility_score} />
        <p className="mt-4 text-sm leading-relaxed text-foreground/90">{result.summary}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
        <MetricCard
          icon={<AlertTriangle className="size-5" />}
          label="Tingkat Risiko"
          value={riskLabel[result.overall_risk_level]}
          tone={result.overall_risk_level}
        />
        <MetricCard
          icon={<Activity className="size-5" />}
          label="Jumlah Klaim"
          value={String(result.claims.length)}
          tone="LOW"
        />
      </div>
    </div>
  );
}

function TrustMeter({ score }: { score: number }) {
  return (
    <div className="mt-6">
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${credibilityBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground font-medium">
        <span>0 Sangat Rendah</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100 Tinggi</span>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "LOW" | "MEDIUM" | "HIGH";
}) {
  return (
    <div className={`rounded-2xl border p-5 ${riskStyle[tone]} bg-card`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
    </div>
  );
}

/* ---------- CLAIMS ---------- */

function ClaimsSection({ result }: { result: AnalysisResult }) {
  if (!result.claims.length) {
    return (
      <SectionShell title="Verifikasi Setiap Klaim" icon={<Stethoscope className="size-5" />}>
        <p className="text-sm text-muted-foreground font-medium">
          Tidak ada klaim kesehatan spesifik yang terdeteksi pada konten ini.
        </p>
      </SectionShell>
    );
  }
  return (
    <SectionShell
      title={`Verifikasi Setiap Klaim (${result.claims.length})`}
      icon={<Stethoscope className="size-5" />}
    >
      <div className="space-y-4">
        {result.claims.map((c, i) => (
          <ClaimCard key={i} claim={c} index={i} />
        ))}
      </div>
    </SectionShell>
  );
}

function ClaimCard({ claim, index }: { claim: AnalysisResult["claims"][number]; index: number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">Klaim #{index + 1}</span>
          <span className="px-2 py-0.5 rounded bg-muted">{claim.category}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={classificationStyle[claim.classification]}>
            {classificationLabel[claim.classification]}
          </Badge>
          <Badge className={riskStyle[claim.risk_level]}>Risiko {riskLabel[claim.risk_level]}</Badge>
          <Badge className="bg-info/10 text-info border-info/30">Keyakinan {claim.confidence_score}%</Badge>
        </div>
      </div>

      <blockquote className="border-l-4 border-primary/40 pl-3 italic text-foreground/90 text-sm mb-4">
        “{claim.claim_text}”
      </blockquote>

      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <Field label="Penjelasan" value={claim.explanation} />
        <Field label="Validasi Ilmiah" value={claim.scientific_validation} />
        <Field label="Konsensus Medis" value={claim.consensus_status} />
        <Field label="Kekuatan Bukti" value={claim.evidence_strength} />
        <Field label="Potensi Dampak Kesehatan" value={claim.potential_health_impact} full />
      </div>

      {claim.sources?.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Sumber Referensi
          </div>
          <ul className="space-y-2">
            {claim.sources.map((s, i) => (
              <li key={i} className="rounded-lg border border-border bg-card p-3">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  {s.name} <ExternalLink className="size-3.5" />
                </a>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <p className="mt-1 text-foreground/90 leading-relaxed">{value || "-"}</p>
    </div>
  );
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${className}`}>
      {children}
    </span>
  );
}

/* ---------- ARTICLES / IMPACT / RECS ---------- */

function ArticlesSection({ result }: { result: AnalysisResult }) {
  if (!result.related_articles?.length) return null;
  return (
    <SectionShell title="Bacaan Ilmiah Terkait" icon={<BookOpen className="size-5" />}>
      <div className="grid md:grid-cols-2 gap-4">
        {result.related_articles.map((a, i) => (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer noopener"
            className="block rounded-xl border border-border bg-background p-4 hover:border-primary/50 hover:shadow-sm transition group"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              {a.website}
            </div>
            <div className="mt-1 font-semibold text-foreground group-hover:text-primary transition flex items-start gap-1.5">
              {a.title} <ExternalLink className="size-3.5 mt-1 shrink-0 opacity-60" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{a.summary}</p>
          </a>
        ))}
      </div>
    </SectionShell>
  );
}

function ImpactSection({ result }: { result: AnalysisResult }) {
  return (
    <SectionShell title="Dampak terhadap Kesehatan Masyarakat" icon={<HeartPulse className="size-5" />}>
      <p className="text-sm leading-relaxed text-foreground/90">{result.public_health_impact}</p>
    </SectionShell>
  );
}

function RecommendationsSection({ result }: { result: AnalysisResult }) {
  if (!result.recommendations?.length) return null;
  return (
    <SectionShell title="Rekomendasi Tindak Lanjut" icon={<CheckCircle2 className="size-5" />}>
      <ul className="grid sm:grid-cols-2 gap-3">
        {result.recommendations.map((r, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-xl border border-border bg-background p-4 text-sm"
          >
            <div className="size-6 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold text-xs">
              {i + 1}
            </div>
            <span className="leading-relaxed">{r}</span>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function ActionsBar({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  return (
    <div className="rounded-[24px] border border-border bg-card p-6 sm:p-7 flex flex-wrap items-center justify-between gap-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <FileText className="size-5" />
        </div>
        <div>
          <h3 className="font-bold tracking-tight text-[17px]">Ringkasan Verifikasi (PDF)</h3>
          <p className="text-sm text-muted-foreground font-medium mt-0.5 max-w-md">
            Unduh laporan multi-halaman dengan dashboard, hasil verifikasi klaim, dan referensi lengkap.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border bg-background hover:bg-muted transition"
        >
          <RotateCcw className="size-4" /> Periksa Lagi
        </button>
        <button
          onClick={() => {
            try {
              generatePDFReport(result);
              toast.success("Laporan PDF berhasil diunduh");
            } catch (e) {
              console.error(e);
              toast.error("Gagal membuat PDF.");
            }
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground hover:opacity-90 hover:-translate-y-px transition"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          <Download className="size-4" /> Unduh Laporan
        </button>
      </div>
    </div>
  );
}

function SectionShell({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-border bg-card p-6 sm:p-8 shadow-[var(--shadow-soft)]">
      <h2 className="flex items-center gap-2.5 text-[20px] sm:text-[22px] font-bold tracking-tight mb-5">
        <span className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ---------- FEATURES (only shown before analysis) ---------- */

function FeaturesSection() {
  const items = [
    {
      icon: <Microscope className="size-5" />,
      title: "Verifikasi Setiap Klaim",
      desc: "Setiap pernyataan diuraikan dan dinilai terpisah dengan kategori dan klasifikasi.",
    },
    {
      icon: <ShieldCheck className="size-5" />,
      title: "Berbasis Bukti Ilmiah",
      desc: "Referensi dari WHO, CDC, PubMed/NIH, Kemenkes RI, Mayo Clinic, dan jurnal medis.",
    },
    {
      icon: <Activity className="size-5" />,
      title: "Skor Kredibilitas",
      desc: "Trust meter visual 0–100 lengkap dengan tingkat risiko dan tingkat keyakinan.",
    },
    {
      icon: <FileText className="size-5" />,
      title: "Laporan PDF Profesional",
      desc: "Unduh laporan multi-halaman dengan dashboard, klaim, dan daftar referensi.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <div className="text-center mb-12 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider mb-4">
          Mengapa NarasiSehat AI
        </div>
        <h2 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight">
          Dibangun untuk literasi kesehatan masyarakat
        </h2>
        <p className="mt-3 text-muted-foreground font-medium leading-relaxed">
          Dapat digunakan oleh masyarakat umum, pelajar, tenaga pendidik, jurnalis, hingga lembaga kesehatan.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((f) => (
          <div
            key={f.title}
            className="group rounded-[20px] border border-border bg-card p-6 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5 transition-all"
          >
            <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4 group-hover:scale-105 transition-transform">
              {f.icon}
            </div>
            <h3 className="font-bold tracking-tight text-[15px]">{f.title}</h3>
            <p className="text-[13.5px] text-muted-foreground mt-1.5 leading-relaxed font-medium">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
