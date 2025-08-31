export interface VolumeMetrics {
  articlesPerDay: number;
  articlesPerHour: number;
  averageFrequency: number;
  publishingPattern: TimePattern;
  volumeTrend7d: number;
  volumeTrend30d: number;
  isVolumeAnomaly: boolean;
  expectedRange: [number, number];
}

export interface TimePattern {
  peakHours: number[];
  consistencyScore: number;
  averageGapMinutes: number;
  batchPublishing: boolean;
}

export interface QualityMetrics {
  avgTitleLength: number;
  avgContentLength: number;
  missingContentPercentage: number;
  duplicateContentPercentage: number;
  languageConsistency: number;
  readabilityScore: number;
  spellingErrorRate: number;
  hasAuthorPercentage: number;
  hasDatePercentage: number;
  hasDescriptionPercentage: number;
  validLinksPercentage: number;
}

export interface CredibilityMetrics {
  uniqueAuthors: number;
  authorDistribution: Record<string, number>;
  domainConsistency: number;
  suspiciousPatterns: SuspiciousPattern[];
  duplicateAcrossFeeds: number;
  unusualPublishingTimes: number;
  avgAuthenticityScore: number;
  clickbaitScore: number;
  biasScore: number;
}

export interface SuspiciousPattern {
  type: 'duplicate_content' | 'unusual_timing' | 'spam_keywords' | 'broken_links' | 'excessive_caps' | 'suspicious_links';
  count: number;
  severity: 'low' | 'medium' | 'high';
  examples: string[];
  description: string;
}

export interface TechnicalMetrics {
  uptime: number;
  avgResponseTime: number;
  errorRate: number;
  lastSuccessfulFetch: Date;
  parseSuccessRate: number;
  encodingIssues: number;
  xmlValidityScore: number;
  timeouts: number;
  httpErrors: Record<number, number>;
  dnsErrors: number;
}

export interface RelevanceMetrics {
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  categoryAccuracy: number;
  topicDiversity: number;
  trending: string[];
  avgPublicationDelay: number;
  breakingNewsDetection: number;
  staleContentPercentage: number;
}

export interface SpamDetection {
  excessiveCapitalization: number;
  suspiciousKeywords: string[];
  advertisementContent: number;
  brokenLinksPercentage: number;
  redirectChains: number;
  maliciousLinkDetection: number;
  batchPublishing: number;
  identicalTimestamps: number;
}

export interface LocalizationHealth {
  expectedLanguage: string;
  actualLanguageDistribution: Record<string, number>;
  translationQuality: number;
  culturalRelevance: number;
  currencyAndUnits: number;
}

export interface HealthAlert {
  id: string;
  feedId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface HealthSnapshot {
  timestamp: Date;
  overallHealthScore: number;
  volume: Partial<VolumeMetrics>;
  quality: Partial<QualityMetrics>;
  credibility: Partial<CredibilityMetrics>;
  technical: Partial<TechnicalMetrics>;
  relevance: Partial<RelevanceMetrics>;
}

export interface FeedHealthDashboard {
  feedId: string;
  feedName: string;
  feedUrl: string;
  country: string;
  category: string;
  language: string;
  
  overallHealthScore: number;
  healthStatus: 'excellent' | 'good' | 'warning' | 'critical' | 'down';
  
  volume: VolumeMetrics;
  quality: QualityMetrics;
  credibility: CredibilityMetrics;
  technical: TechnicalMetrics;
  relevance: RelevanceMetrics;
  spam: SpamDetection;
  localization: LocalizationHealth;
  
  alerts: HealthAlert[];
  recommendations: string[];
  
  last24h: HealthSnapshot;
  last7d: HealthSnapshot;
  last30d: HealthSnapshot;
  
  lastAnalyzed: Date;
  nextAnalysis: Date;
}

export interface HealthAnalysisConfig {
  feedId: string;
  analyzeVolume: boolean;
  analyzeQuality: boolean;
  analyzeCredibility: boolean;
  analyzeTechnical: boolean;
  analyzeRelevance: boolean;
  analyzeSpam: boolean;
  analyzeLocalization: boolean;
  
  volumeThresholds: {
    minArticlesPerDay: number;
    maxArticlesPerDay: number;
    anomalyThreshold: number;
  };
  
  qualityThresholds: {
    minTitleLength: number;
    minContentLength: number;
    maxDuplicatePercentage: number;
    minReadabilityScore: number;
  };
  
  technicalThresholds: {
    minUptime: number;
    maxErrorRate: number;
    maxResponseTime: number;
  };
}