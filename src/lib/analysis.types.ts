export type Classification =
  | "SUPPORTED_BY_EVIDENCE"
  | "NEEDS_VERIFICATION"
  | "MISLEADING"
  | "DANGEROUS";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type ConsensusStatus =
  | "Supported by Medical Consensus"
  | "Mixed Evidence"
  | "Insufficient Evidence"
  | "Contradicts Medical Consensus";

export type EvidenceStrength = "Very Strong" | "Strong" | "Moderate" | "Weak";

export interface SourceRef {
  name: string;
  url: string;
  description: string;
}

export interface RelatedArticle {
  title: string;
  website: string;
  summary: string;
  url: string;
}

export interface ClaimAnalysis {
  claim_text: string;
  category: string;
  classification: Classification;
  explanation: string;
  risk_level: RiskLevel;
  scientific_validation: string;
  potential_health_impact: string;
  confidence_score: number; // 0-100
  consensus_status: ConsensusStatus;
  evidence_strength: EvidenceStrength;
  sources: SourceRef[];
}

export type SourceType = "TEXT" | "VIDEO" | "IMAGE";

export interface VideoInfo {
  file_name: string;
  file_size_bytes: number;
  duration_seconds: number;
  mime_type: string;
  transcript: string;
}

export interface ImageInfo {
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  data_url: string; // base64 data URL for preview & PDF embed
  extracted_text: string;
  confidence: number; // 0-100
}

export interface AnalysisResult {
  original_content: string;
  credibility_score: number; // 0-100
  overall_risk_level: RiskLevel;
  summary: string;
  claims: ClaimAnalysis[];
  related_articles: RelatedArticle[];
  public_health_impact: string;
  recommendations: string[];
  analyzed_at: string;
  source_type: SourceType;
  video_info?: VideoInfo;
  image_info?: ImageInfo;
}
