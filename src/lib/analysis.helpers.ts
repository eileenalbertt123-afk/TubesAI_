import type { AnalysisResult, Classification, RiskLevel } from "./analysis.types";

export const classificationLabel: Record<Classification, string> = {
  SUPPORTED_BY_EVIDENCE: "Didukung Bukti",
  NEEDS_VERIFICATION: "Perlu Verifikasi",
  MISLEADING: "Menyesatkan",
  DANGEROUS: "Berbahaya",
};

export const classificationStyle: Record<Classification, string> = {
  SUPPORTED_BY_EVIDENCE: "bg-success/10 text-success border-success/30",
  NEEDS_VERIFICATION: "bg-warning/10 text-warning border-warning/40",
  MISLEADING: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  DANGEROUS: "bg-danger/10 text-danger border-danger/30",
};

export const riskLabel: Record<RiskLevel, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
};

export const riskStyle: Record<RiskLevel, string> = {
  LOW: "bg-success/10 text-success border-success/30",
  MEDIUM: "bg-warning/10 text-warning border-warning/40",
  HIGH: "bg-danger/10 text-danger border-danger/30",
};

export function credibilityTier(score: number): { label: string; color: string } {
  if (score <= 25) return { label: "Sangat Rendah", color: "text-danger" };
  if (score <= 50) return { label: "Rendah", color: "text-orange-600" };
  if (score <= 75) return { label: "Sedang", color: "text-warning" };
  return { label: "Tinggi", color: "text-success" };
}

export function credibilityBarColor(score: number): string {
  if (score <= 25) return "bg-danger";
  if (score <= 50) return "bg-orange-500";
  if (score <= 75) return "bg-warning";
  return "bg-success";
}

export function formatDateID(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export type { AnalysisResult };
