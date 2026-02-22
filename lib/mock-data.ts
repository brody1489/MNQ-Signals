// Mock data for Flow Terminal. No real API connections.
// Comprehensive mock: tickers, people, funds, news, events, earnings, dividends, filings, transcripts.

export type EventType = "options" | "dark_pool" | "ceo" | "congress";
export type EventDirection = "call" | "put" | "buy" | "sell";
export type PersonRole = "CEO" | "Congress" | "Whale";

// ——— Flow Event ———
export interface FlowEvent {
  id: string;
  timestamp: string;
  tickerSymbol: string;
  personId: string | null;
  type: EventType;
  direction: EventDirection;
  sizeUsd: number;
  details?: string;
}

// ——— Ticker / Company ———
export interface Ticker {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  changePercent: number;
  high52w: number;
  low52w: number;
  pe: number | null;
  dividendYield: number;
  earningsDate: string | null;
  beta?: number;
}

// ——— Person ———
export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  company: string | null;
  totalCapitalDeployed: number;
  estimatedPerformancePercent: number;
  bestYear: number;
  party?: string;
  state?: string;
  committee?: string;
}

// ——— Fund (13F-style) ———
export interface Fund {
  id: string;
  name: string;
  aum: number;
  type: string;
  tickerSymbol?: string; // When fund is also a public company (e.g. BlackRock → BLK)
}

export interface FundHolding {
  fundId: string;
  quarter: string; // "2025-Q2"
  tickerSymbol: string;
  shares: number;
  valueUsd: number;
  percentOfPortfolio: number;
  changeFromPriorQ: number; // percent
}

// ——— News ———
export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  tickers: string[];
  importance: number; // 1-5
  impact: "high" | "medium" | "low";
  summary: string;
  url?: string;
}

// ——— Earnings ———
export interface EarningsRecord {
  tickerSymbol: string;
  date: string;
  epsEstimate: number;
  epsActual: number;
  revenueEstimate: number;
  revenueActual: number;
  beatMiss: "beat" | "miss" | "meet";
}

// ——— Dividend ———
export interface DividendRecord {
  tickerSymbol: string;
  exDate: string;
  paymentDate: string;
  amount: number;
  type: "regular" | "special";
}

// ——— SEC Filing ———
export interface SecFiling {
  id: string;
  tickerSymbol: string;
  type: "10-K" | "10-Q" | "8-K" | "S-1";
  date: string;
  summary: string;
}

// ——— Transcript ———
export interface TranscriptSummary {
  tickerSymbol: string;
  date: string;
  summary: string;
}

// ——— Calendar Event ———
export interface CalendarEvent {
  id: string;
  tickerSymbol: string;
  type: "earnings" | "dividend" | "split";
  date: string;
  details?: string;
}

// —————————————————————————————————————————————————————————————————————————————
// MOCK DATA
// —————————————————————————————————————————————————————————————————————————————

const now = new Date();
const today = now.toISOString().slice(0, 10);
const yesterday = new Date(now.getTime() - 86400 * 1000).toISOString().slice(0, 10);
const weekAgo = new Date(now.getTime() - 7 * 86400 * 1000).toISOString().slice(0, 10);

// ——— Tickers ———
export const tickers: Ticker[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", marketCap: 3_200_000_000_000, price: 178.50, changePercent: 0.42, high52w: 199.62, low52w: 164.08, pe: 28.5, dividendYield: 0.52, earningsDate: "2025-01-30", beta: 1.2 },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", marketCap: 2_900_000_000_000, price: 415.20, changePercent: 1.12, high52w: 430.82, low52w: 309.45, pe: 35.2, dividendYield: 0.72, earningsDate: "2025-01-28", beta: 0.9 },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology", marketCap: 2_100_000_000_000, price: 152.30, changePercent: -0.35, high52w: 153.78, low52w: 102.21, pe: 24.1, dividendYield: 0.46, earningsDate: "2025-01-28", beta: 1.05 },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Cyclical", marketCap: 1_950_000_000_000, price: 185.40, changePercent: 0.89, high52w: 189.77, low52w: 118.35, pe: 72.3, dividendYield: 0, earningsDate: "2025-01-30", beta: 1.15 },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology", marketCap: 3_500_000_000_000, price: 138.90, changePercent: 2.34, high52w: 140.76, low52w: 39.23, pe: 68.2, dividendYield: 0.03, earningsDate: "2025-02-19", beta: 1.7 },
  { symbol: "META", name: "Meta Platforms", sector: "Technology", marketCap: 1_400_000_000_000, price: 518.20, changePercent: -0.22, high52w: 531.49, low52w: 206.17, pe: 25.4, dividendYield: 0.39, earningsDate: "2025-01-29", beta: 1.3 },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Cyclical", marketCap: 850_000_000_000, price: 268.50, changePercent: 3.12, high52w: 299.29, low52w: 138.80, pe: 72.1, dividendYield: 0, earningsDate: "2025-01-22", beta: 2.1 },
  { symbol: "AMD", name: "AMD Inc.", sector: "Technology", marketCap: 220_000_000_000, price: 138.20, changePercent: 1.45, high52w: 227.30, low52w: 96.53, pe: 45.2, dividendYield: 0, earningsDate: "2025-01-28", beta: 1.6 },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financial Services", marketCap: 520_000_000_000, price: 198.40, changePercent: 0.67, high52w: 211.98, low52w: 135.19, pe: 11.2, dividendYield: 2.21, earningsDate: "2025-01-17", beta: 1.1 },
  { symbol: "BRK.B", name: "Berkshire Hathaway", sector: "Financial Services", marketCap: 900_000_000_000, price: 398.20, changePercent: 0.15, high52w: 432.00, low52w: 320.50, pe: 9.8, dividendYield: 0, earningsDate: "2025-02-22", beta: 0.9 },
  { symbol: "V", name: "Visa Inc.", sector: "Financial Services", marketCap: 600_000_000_000, price: 285.30, changePercent: -0.18, high52w: 310.20, low52w: 250.10, pe: 32.1, dividendYield: 0.78, earningsDate: "2025-01-30", beta: 0.95 },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Defensive", marketCap: 480_000_000_000, price: 175.80, changePercent: 0.42, high52w: 182.50, low52w: 155.20, pe: 28.4, dividendYield: 1.32, earningsDate: "2025-02-18", beta: 0.6 },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", marketCap: 380_000_000_000, price: 158.20, changePercent: -0.12, high52w: 175.40, low52w: 142.30, pe: 15.2, dividendYield: 3.12, earningsDate: "2025-01-24", beta: 0.55 },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Defensive", marketCap: 380_000_000_000, price: 168.90, changePercent: 0.28, high52w: 172.00, low52w: 142.50, pe: 26.8, dividendYield: 2.48, earningsDate: "2025-01-23", beta: 0.45 },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", marketCap: 480_000_000_000, price: 112.40, changePercent: 0.89, high52w: 125.30, low52w: 95.20, pe: 12.1, dividendYield: 3.21, earningsDate: "2025-01-31", beta: 1.0 },
  { symbol: "BAC", name: "Bank of America", sector: "Financial Services", marketCap: 380_000_000_000, price: 41.60, changePercent: 0.48, high52w: 45.20, low52w: 32.10, pe: 13.2, dividendYield: 2.40, earningsDate: "2025-01-17", beta: 1.2 },
  { symbol: "CVX", name: "Chevron Corp.", sector: "Energy", marketCap: 290_000_000_000, price: 166.70, changePercent: 0.72, high52w: 175.00, low52w: 138.20, pe: 11.8, dividendYield: 3.84, earningsDate: "2025-01-31", beta: 1.1 },
  { symbol: "BLK", name: "BlackRock Inc.", sector: "Financial Services", marketCap: 118_000_000_000, price: 785.20, changePercent: 0.55, high52w: 825.00, low52w: 650.30, pe: 21.2, dividendYield: 2.58, earningsDate: "2025-01-17", beta: 1.15 },
];

// ——— People ———
export const people: Person[] = [
  { id: "p1", name: "Sarah Chen", role: "CEO", company: "TechFlow Inc.", totalCapitalDeployed: 12_400_000, estimatedPerformancePercent: 34, bestYear: 2023 },
  { id: "p2", name: "Michael Torres", role: "Congress", company: null, totalCapitalDeployed: 2_100_000, estimatedPerformancePercent: 18, bestYear: 2022, party: "R", state: "TX", committee: "Finance" },
  { id: "p3", name: "Emily Watson", role: "Whale", company: "Meridian Capital", totalCapitalDeployed: 89_000_000, estimatedPerformancePercent: 22, bestYear: 2024 },
  { id: "p4", name: "James Park", role: "CEO", company: "Apex Systems", totalCapitalDeployed: 8_700_000, estimatedPerformancePercent: -5, bestYear: 2021 },
  { id: "p5", name: "Lisa Okonkwo", role: "Congress", company: null, totalCapitalDeployed: 1_800_000, estimatedPerformancePercent: 41, bestYear: 2023, party: "D", state: "CA", committee: "Energy" },
  { id: "p6", name: "David Kim", role: "Whale", company: "Horizon Funds", totalCapitalDeployed: 156_000_000, estimatedPerformancePercent: 28, bestYear: 2024 },
  { id: "p7", name: "Nancy Pelosi", role: "Congress", company: null, totalCapitalDeployed: 45_000_000, estimatedPerformancePercent: 65, bestYear: 2023, party: "D", state: "CA", committee: "Appropriations" },
  { id: "p8", name: "Josh Gottheimer", role: "Congress", company: null, totalCapitalDeployed: 12_000_000, estimatedPerformancePercent: 38, bestYear: 2022, party: "D", state: "NJ", committee: "Financial Services" },
  { id: "p9", name: "Tim Cook", role: "CEO", company: "Apple Inc.", totalCapitalDeployed: 120_000_000, estimatedPerformancePercent: 18, bestYear: 2024 },
  { id: "p10", name: "Jensen Huang", role: "CEO", company: "NVIDIA Corp.", totalCapitalDeployed: 85_000_000, estimatedPerformancePercent: 210, bestYear: 2024 },
];

// ——— Funds ———
export const funds: Fund[] = [
  { id: "f1", name: "BlackRock Inc.", aum: 10_200_000_000_000, type: "Asset Manager", tickerSymbol: "BLK" },
  { id: "f2", name: "Vanguard Group", aum: 8_500_000_000_000, type: "Asset Manager" },
  { id: "f3", name: "Berkshire Hathaway", aum: 900_000_000_000, type: "Holding Company" },
  { id: "f4", name: "State Street Corp.", aum: 4_200_000_000_000, type: "Asset Manager" },
  { id: "f5", name: "Citadel LLC", aum: 62_000_000_000, type: "Hedge Fund" },
];

// ——— Fund Holdings (13F-style, two quarters) ———
export const fundHoldings: FundHolding[] = [
  // BlackRock Q1 2025
  { fundId: "f1", quarter: "2025-Q1", tickerSymbol: "AAPL", shares: 1_050_000_000, valueUsd: 187_000_000_000, percentOfPortfolio: 4.2, changeFromPriorQ: 2.1 },
  { fundId: "f1", quarter: "2025-Q1", tickerSymbol: "MSFT", shares: 720_000_000, valueUsd: 299_000_000_000, percentOfPortfolio: 6.8, changeFromPriorQ: 5.2 },
  { fundId: "f1", quarter: "2025-Q1", tickerSymbol: "NVDA", shares: 180_000_000, valueUsd: 25_000_000_000, percentOfPortfolio: 0.56, changeFromPriorQ: -12.3 },
  { fundId: "f1", quarter: "2025-Q1", tickerSymbol: "AMZN", shares: 450_000_000, valueUsd: 83_000_000_000, percentOfPortfolio: 1.9, changeFromPriorQ: 8.4 },
  { fundId: "f1", quarter: "2025-Q1", tickerSymbol: "JPM", shares: 85_000_000, valueUsd: 17_000_000_000, percentOfPortfolio: 0.38, changeFromPriorQ: 3.1 },
  // BlackRock Q2 2025
  { fundId: "f1", quarter: "2025-Q2", tickerSymbol: "AAPL", shares: 1_080_000_000, valueUsd: 193_000_000_000, percentOfPortfolio: 4.4, changeFromPriorQ: 3.2 },
  { fundId: "f1", quarter: "2025-Q2", tickerSymbol: "MSFT", shares: 750_000_000, valueUsd: 312_000_000_000, percentOfPortfolio: 7.1, changeFromPriorQ: 4.3 },
  { fundId: "f1", quarter: "2025-Q2", tickerSymbol: "NVDA", shares: 220_000_000, valueUsd: 30_600_000_000, percentOfPortfolio: 0.70, changeFromPriorQ: 22.4 },
  { fundId: "f1", quarter: "2025-Q2", tickerSymbol: "AMZN", shares: 470_000_000, valueUsd: 87_000_000_000, percentOfPortfolio: 2.0, changeFromPriorQ: 4.8 },
  { fundId: "f1", quarter: "2025-Q2", tickerSymbol: "JPM", shares: 88_000_000, valueUsd: 17_500_000_000, percentOfPortfolio: 0.40, changeFromPriorQ: 2.9 },
  // Berkshire Q1 2025
  { fundId: "f3", quarter: "2025-Q1", tickerSymbol: "AAPL", shares: 905_000_000, valueUsd: 161_000_000_000, percentOfPortfolio: 42.1, changeFromPriorQ: -1.2 },
  { fundId: "f3", quarter: "2025-Q1", tickerSymbol: "BAC", shares: 1_010_000_000, valueUsd: 42_000_000_000, percentOfPortfolio: 11.0, changeFromPriorQ: 0 },
  { fundId: "f3", quarter: "2025-Q1", tickerSymbol: "CVX", shares: 126_000_000, valueUsd: 21_000_000_000, percentOfPortfolio: 5.5, changeFromPriorQ: 2.1 },
  // Berkshire Q2 2025
  { fundId: "f3", quarter: "2025-Q2", tickerSymbol: "AAPL", shares: 908_000_000, valueUsd: 162_000_000_000, percentOfPortfolio: 42.5, changeFromPriorQ: 0.6 },
  { fundId: "f3", quarter: "2025-Q2", tickerSymbol: "BAC", shares: 1_010_000_000, valueUsd: 43_000_000_000, percentOfPortfolio: 11.2, changeFromPriorQ: 2.4 },
  { fundId: "f3", quarter: "2025-Q2", tickerSymbol: "CVX", shares: 128_000_000, valueUsd: 22_000_000_000, percentOfPortfolio: 5.7, changeFromPriorQ: 4.8 },
];

// ——— Flow Events ———
export const flowEvents: FlowEvent[] = [
  { id: "e1", timestamp: `${today}T14:32:00Z`, tickerSymbol: "NVDA", personId: null, type: "options", direction: "call", sizeUsd: 5_200_000, details: "Mar 21 $900C" },
  { id: "e2", timestamp: `${today}T14:18:00Z`, tickerSymbol: "AAPL", personId: "p1", type: "ceo", direction: "buy", sizeUsd: 1_240_000 },
  { id: "e3", timestamp: `${today}T13:55:00Z`, tickerSymbol: "TSLA", personId: null, type: "dark_pool", direction: "buy", sizeUsd: 12_400_000 },
  { id: "e4", timestamp: `${today}T13:42:00Z`, tickerSymbol: "MSFT", personId: "p2", type: "congress", direction: "buy", sizeUsd: 45_000 },
  { id: "e5", timestamp: `${today}T13:20:00Z`, tickerSymbol: "NVDA", personId: null, type: "options", direction: "put", sizeUsd: 2_800_000, details: "Apr 18 $850P" },
  { id: "e6", timestamp: `${today}T12:58:00Z`, tickerSymbol: "META", personId: "p3", type: "ceo", direction: "sell", sizeUsd: 3_200_000 },
  { id: "e7", timestamp: `${today}T12:30:00Z`, tickerSymbol: "GOOGL", personId: null, type: "dark_pool", direction: "sell", sizeUsd: 8_100_000 },
  { id: "e8", timestamp: `${today}T11:15:00Z`, tickerSymbol: "AMD", personId: null, type: "options", direction: "call", sizeUsd: 4_100_000, details: "Feb 21 $140C" },
  { id: "e9", timestamp: `${today}T10:45:00Z`, tickerSymbol: "JPM", personId: "p5", type: "congress", direction: "buy", sizeUsd: 28_000 },
  { id: "e10", timestamp: `${today}T10:22:00Z`, tickerSymbol: "AMZN", personId: null, type: "dark_pool", direction: "buy", sizeUsd: 6_700_000 },
  { id: "e11", timestamp: `${yesterday}T16:00:00Z`, tickerSymbol: "NVDA", personId: "p6", type: "ceo", direction: "buy", sizeUsd: 15_600_000 },
  { id: "e12", timestamp: `${yesterday}T15:30:00Z`, tickerSymbol: "TSLA", personId: null, type: "options", direction: "call", sizeUsd: 3_100_000, details: "Jan 24 $260C" },
  { id: "e13", timestamp: `${yesterday}T14:00:00Z`, tickerSymbol: "AAPL", personId: null, type: "dark_pool", direction: "buy", sizeUsd: 9_200_000 },
  { id: "e14", timestamp: `${yesterday}T13:20:00Z`, tickerSymbol: "META", personId: "p4", type: "ceo", direction: "sell", sizeUsd: 2_100_000 },
  { id: "e15", timestamp: `${yesterday}T12:00:00Z`, tickerSymbol: "MSFT", personId: "p2", type: "congress", direction: "sell", sizeUsd: 32_000 },
  { id: "e16", timestamp: `${yesterday}T11:00:00Z`, tickerSymbol: "NVDA", personId: null, type: "options", direction: "call", sizeUsd: 7_800_000, details: "Mar 21 $880C" },
  { id: "e17", timestamp: `${yesterday}T10:30:00Z`, tickerSymbol: "GOOGL", personId: null, type: "dark_pool", direction: "buy", sizeUsd: 4_500_000 },
  { id: "e18", timestamp: `${yesterday}T09:45:00Z`, tickerSymbol: "AMD", personId: "p3", type: "ceo", direction: "buy", sizeUsd: 1_800_000 },
  { id: "e19", timestamp: `${today}T15:10:00Z`, tickerSymbol: "AAPL", personId: "p7", type: "congress", direction: "buy", sizeUsd: 1_200_000 },
  { id: "e20", timestamp: `${today}T14:55:00Z`, tickerSymbol: "NVDA", personId: "p10", type: "ceo", direction: "buy", sizeUsd: 4_200_000 },
  { id: "e21", timestamp: `${today}T14:40:00Z`, tickerSymbol: "MSFT", personId: null, type: "options", direction: "call", sizeUsd: 3_500_000, details: "Feb 14 $420C" },
  { id: "e22", timestamp: `${weekAgo}T16:00:00Z`, tickerSymbol: "GOOGL", personId: "p8", type: "congress", direction: "buy", sizeUsd: 85_000 },
  { id: "e23", timestamp: `${weekAgo}T15:00:00Z`, tickerSymbol: "JPM", personId: null, type: "dark_pool", direction: "sell", sizeUsd: 22_000_000 },
  { id: "e24", timestamp: `${weekAgo}T14:00:00Z`, tickerSymbol: "TSLA", personId: "p9", type: "ceo", direction: "sell", sizeUsd: 8_500_000 },
];

// ——— News ———
export const newsArticles: NewsArticle[] = [
  { id: "n1", headline: "NVIDIA beats Q3 earnings, raises guidance on AI chip demand", source: "Reuters", timestamp: `${today}T14:00:00Z`, tickers: ["NVDA"], importance: 5, impact: "high", summary: "NVIDIA reported record revenue driven by data center and AI chip sales. Management raised full-year guidance citing sustained demand." },
  { id: "n2", headline: "Apple announces new M4 chip for Mac lineup", source: "Bloomberg", timestamp: `${today}T13:30:00Z`, tickers: ["AAPL"], importance: 4, impact: "medium", summary: "Apple unveiled the M4 processor with improved performance and efficiency. Shipments to begin next quarter." },
  { id: "n3", headline: "Microsoft Azure growth accelerates in cloud segment", source: "CNBC", timestamp: `${today}T12:45:00Z`, tickers: ["MSFT"], importance: 4, impact: "medium", summary: "Azure revenue grew 28% YoY. Microsoft continues to gain share in enterprise cloud." },
  { id: "n4", headline: "Tesla recalls 2M vehicles over autopilot safety concerns", source: "AP", timestamp: `${today}T11:20:00Z`, tickers: ["TSLA"], importance: 5, impact: "high", summary: "NHTSA mandates over-the-air software update. No immediate impact on delivery guidance." },
  { id: "n5", headline: "Amazon Prime Day sets new sales record", source: "Reuters", timestamp: `${today}T10:15:00Z`, tickers: ["AMZN"], importance: 3, impact: "medium", summary: "Third-party sellers saw 20% growth. AWS remains primary profit driver." },
  { id: "n6", headline: "Meta announces dividend increase, $50B buyback", source: "WSJ", timestamp: `${today}T09:00:00Z`, tickers: ["META"], importance: 5, impact: "high", summary: "Board approves 15% dividend raise and extends share repurchase program through 2026." },
  { id: "n7", headline: "AMD launches new data center GPU to compete with NVIDIA", source: "TechCrunch", timestamp: `${yesterday}T16:30:00Z`, tickers: ["AMD", "NVDA"], importance: 4, impact: "medium", summary: "MI300X offers competitive performance at lower price point. Enterprise adoption ramping." },
  { id: "n8", headline: "JPMorgan posts record trading revenue in Q4", source: "Reuters", timestamp: `${yesterday}T15:00:00Z`, tickers: ["JPM"], importance: 4, impact: "medium", summary: "Fixed income and equities both beat estimates. Investment banking pipeline strong." },
  { id: "n9", headline: "Alphabet reports strong search ad growth", source: "Bloomberg", timestamp: `${yesterday}T14:00:00Z`, tickers: ["GOOGL"], importance: 4, impact: "medium", summary: "Google Search revenue up 12%. Cloud profitability improves." },
  { id: "n10", headline: "Congress proposes new tech antitrust bill", source: "Politico", timestamp: `${yesterday}T13:00:00Z`, tickers: ["AAPL", "GOOGL", "MSFT", "AMZN", "META"], importance: 5, impact: "high", summary: "Bipartisan legislation would restrict platform self-preferencing. Tech stocks dip in after-hours." },
  { id: "n11", headline: "Berkshire adds to Occidental Petroleum stake", source: "CNBC", timestamp: `${yesterday}T12:00:00Z`, tickers: ["BRK.B"], importance: 3, impact: "low", summary: "Buffett's conglomerate increases OXY position to 28%. No new major acquisitions disclosed." },
  { id: "n12", headline: "Visa and Mastercard reach swipe fee settlement", source: "Reuters", timestamp: `${yesterday}T11:00:00Z`, tickers: ["V"], importance: 4, impact: "medium", summary: "Multi-year litigation resolved. Merchants to receive reduced rates. Both stocks up in premarket." },
  { id: "n13", headline: "Walmart expands same-day delivery to 2,000 more stores", source: "Retail Dive", timestamp: `${yesterday}T10:00:00Z`, tickers: ["WMT"], importance: 3, impact: "low", summary: "Partnership with Instacart and DoorDash. E-commerce margins improving." },
  { id: "n14", headline: "Johnson & Johnson spins off Kenvue, completes separation", source: "WSJ", timestamp: `${weekAgo}T16:00:00Z`, tickers: ["JNJ"], importance: 3, impact: "medium", summary: "Consumer health business now independent. JNJ focuses on pharma and medtech." },
  { id: "n15", headline: "Exxon announces major Guyana discovery", source: "Reuters", timestamp: `${weekAgo}T15:00:00Z`, tickers: ["XOM"], importance: 4, impact: "medium", summary: "New find adds estimated 1.2B barrels. Production ramp continues through 2027." },
];

// ——— Earnings (past) ———
export const earningsRecords: EarningsRecord[] = [
  { tickerSymbol: "NVDA", date: "2024-11-20", epsEstimate: 4.52, epsActual: 5.16, revenueEstimate: 20_370_000_000, revenueActual: 22_100_000_000, beatMiss: "beat" },
  { tickerSymbol: "AAPL", date: "2024-10-31", epsEstimate: 1.39, epsActual: 1.46, revenueEstimate: 94_000_000_000, revenueActual: 94_900_000_000, beatMiss: "beat" },
  { tickerSymbol: "MSFT", date: "2024-10-24", epsEstimate: 2.65, epsActual: 2.94, revenueEstimate: 64_500_000_000, revenueActual: 65_500_000_000, beatMiss: "beat" },
  { tickerSymbol: "TSLA", date: "2024-10-23", epsEstimate: 0.58, epsActual: 0.53, revenueEstimate: 25_500_000_000, revenueActual: 25_100_000_000, beatMiss: "miss" },
  { tickerSymbol: "META", date: "2024-10-30", epsEstimate: 4.40, epsActual: 4.71, revenueEstimate: 38_200_000_000, revenueActual: 40_100_000_000, beatMiss: "beat" },
  { tickerSymbol: "AMZN", date: "2024-10-31", epsEstimate: 0.88, epsActual: 0.94, revenueEstimate: 158_000_000_000, revenueActual: 161_000_000_000, beatMiss: "beat" },
  { tickerSymbol: "GOOGL", date: "2024-10-29", epsEstimate: 1.45, epsActual: 1.64, revenueEstimate: 76_000_000_000, revenueActual: 76_900_000_000, beatMiss: "beat" },
  { tickerSymbol: "AMD", date: "2024-10-29", epsEstimate: 0.67, epsActual: 0.62, revenueEstimate: 5_700_000_000, revenueActual: 5_500_000_000, beatMiss: "miss" },
  { tickerSymbol: "JPM", date: "2024-10-11", epsEstimate: 4.24, epsActual: 4.33, revenueEstimate: 42_000_000_000, revenueActual: 42_400_000_000, beatMiss: "beat" },
];

// ——— Dividends (past + future) ———
export const dividendRecords: DividendRecord[] = [
  // AAPL
  { tickerSymbol: "AAPL", exDate: "2025-02-07", paymentDate: "2025-02-13", amount: 0.25, type: "regular" },
  { tickerSymbol: "AAPL", exDate: "2024-11-08", paymentDate: "2024-11-14", amount: 0.25, type: "regular" },
  { tickerSymbol: "AAPL", exDate: "2024-08-09", paymentDate: "2024-08-15", amount: 0.25, type: "regular" },
  { tickerSymbol: "AAPL", exDate: "2024-05-10", paymentDate: "2024-05-16", amount: 0.24, type: "regular" },
  { tickerSymbol: "AAPL", exDate: "2024-02-09", paymentDate: "2024-02-15", amount: 0.24, type: "regular" },
  // MSFT
  { tickerSymbol: "MSFT", exDate: "2025-02-13", paymentDate: "2025-03-14", amount: 0.83, type: "regular" },
  { tickerSymbol: "MSFT", exDate: "2024-11-14", paymentDate: "2024-12-12", amount: 0.83, type: "regular" },
  { tickerSymbol: "MSFT", exDate: "2024-08-15", paymentDate: "2024-09-12", amount: 0.83, type: "regular" },
  // NVDA
  { tickerSymbol: "NVDA", exDate: "2025-03-12", paymentDate: "2025-03-28", amount: 0.01, type: "regular" },
  { tickerSymbol: "NVDA", exDate: "2024-12-12", paymentDate: "2024-12-27", amount: 0.01, type: "regular" },
  { tickerSymbol: "NVDA", exDate: "2024-09-12", paymentDate: "2024-09-27", amount: 0.01, type: "regular" },
  // META
  { tickerSymbol: "META", exDate: "2025-02-27", paymentDate: "2025-03-26", amount: 0.525, type: "regular" },
  { tickerSymbol: "META", exDate: "2024-11-27", paymentDate: "2024-12-26", amount: 0.525, type: "regular" },
  // JPM
  { tickerSymbol: "JPM", exDate: "2025-01-02", paymentDate: "2025-01-31", amount: 1.15, type: "regular" },
  { tickerSymbol: "JPM", exDate: "2024-10-04", paymentDate: "2024-10-31", amount: 1.15, type: "regular" },
  // JNJ, PG, XOM, V, WMT
  { tickerSymbol: "JNJ", exDate: "2025-02-20", paymentDate: "2025-03-11", amount: 1.24, type: "regular" },
  { tickerSymbol: "JNJ", exDate: "2024-11-19", paymentDate: "2024-12-10", amount: 1.19, type: "regular" },
  { tickerSymbol: "PG", exDate: "2025-01-16", paymentDate: "2025-02-18", amount: 1.05, type: "regular" },
  { tickerSymbol: "XOM", exDate: "2025-02-11", paymentDate: "2025-03-10", amount: 0.95, type: "regular" },
  { tickerSymbol: "XOM", exDate: "2024-11-12", paymentDate: "2024-12-10", amount: 0.95, type: "regular" },
  { tickerSymbol: "V", exDate: "2025-02-06", paymentDate: "2025-03-06", amount: 0.52, type: "regular" },
  { tickerSymbol: "WMT", exDate: "2025-01-09", paymentDate: "2025-02-03", amount: 0.83, type: "regular" },
  { tickerSymbol: "WMT", exDate: "2024-10-10", paymentDate: "2024-11-04", amount: 0.83, type: "regular" },
];

// ——— SEC Filings ———
export const secFilings: SecFiling[] = [
  { id: "s1", tickerSymbol: "NVDA", type: "10-Q", date: "2024-11-27", summary: "Q3 revenue of $22.1B, up 206% YoY. Data center segment $18.4B. Gross margin 74%." },
  { id: "s2", tickerSymbol: "AAPL", type: "10-K", date: "2024-10-31", summary: "FY2024 revenue $383.3B. iPhone revenue $200.6B. Services growth 14%." },
  { id: "s3", tickerSymbol: "MSFT", type: "10-Q", date: "2024-10-24", summary: "Q1 revenue $65.5B. Azure +28%. Gaming revenue up 22%." },
  { id: "s4", tickerSymbol: "TSLA", type: "8-K", date: "2024-10-23", summary: "Announces Q3 delivery numbers below estimates. Cybertruck production ramping." },
  { id: "s5", tickerSymbol: "META", type: "10-Q", date: "2024-10-30", summary: "Q3 revenue $40.1B. Reality Labs loss $4.6B. Daily active people 3.19B." },
  { id: "s6", tickerSymbol: "AMZN", type: "10-Q", date: "2024-10-31", summary: "Q3 AWS revenue $24.2B. Advertising revenue $14.0B, up 26%." },
  { id: "s7", tickerSymbol: "GOOGL", type: "10-Q", date: "2024-10-29", summary: "Q3 revenue $76.9B. Google Cloud profitable. YouTube ads $8.0B." },
  { id: "s8", tickerSymbol: "JPM", type: "10-Q", date: "2024-10-11", summary: "Q3 net income $13.2B. NII $22.9B. Credit reserves stable." },
  { id: "s9", tickerSymbol: "NVDA", type: "8-K", date: "2024-09-18", summary: "Announces new Blackwell GPU architecture. Shipments expected 2025." },
  { id: "s10", tickerSymbol: "AAPL", type: "8-K", date: "2024-09-10", summary: "Special event: iPhone 16, Apple Watch Series 10. Pre-orders begin Sept 13." },
];

// ——— Transcript Summaries ———
export const transcriptSummaries: TranscriptSummary[] = [
  { tickerSymbol: "NVDA", date: "2024-11-20", summary: "Management emphasized unprecedented demand for Hopper and upcoming Blackwell. Data center backlog remains strong. Gaming segment stabilizing." },
  { tickerSymbol: "AAPL", date: "2024-10-31", summary: "iPhone 15 Pro drove mix shift. Services hit all-time record. India growth accelerating. Vision Pro production scaling." },
  { tickerSymbol: "MSFT", date: "2024-10-24", summary: "Azure AI services contributing meaningfully. Copilot adoption in enterprise. LinkedIn and Office 365 growth sustained." },
  { tickerSymbol: "TSLA", date: "2024-10-23", summary: "FSD v12 rollout progressing. Energy storage deployments up 90%. Cybertruck deliveries ramping. Focus on cost reduction." },
  { tickerSymbol: "META", date: "2024-10-30", summary: "Reels monetization improving. Metaverse investment continues. Capital intensity moderating. Share buybacks accelerated." },
  { tickerSymbol: "AMZN", date: "2024-10-31", summary: "AWS reaccelerating. Advertising growth strong. Fulfillment efficiency gains. International margins improving." },
];

// ——— Calendar Events ———
export const calendarEvents: CalendarEvent[] = [
  ...tickers.filter((t) => t.earningsDate).map((t, i) => ({ id: `cal-e${i}`, tickerSymbol: t.symbol, type: "earnings" as const, date: t.earningsDate!, details: "Earnings" })),
  ...dividendRecords.map((d, i) => ({ id: `cal-d${i}`, tickerSymbol: d.tickerSymbol, type: "dividend" as const, date: d.exDate, details: `Ex-date: $${d.amount}` })),
];

// ——— Lookups ———
export function getTicker(symbol: string): Ticker | undefined {
  return tickers.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
}

export function getPerson(id: string): Person | undefined {
  return people.find((p) => p.id === id);
}

export function getFund(id: string): Fund | undefined {
  return funds.find((f) => f.id === id);
}

export function getFundByTicker(symbol: string): Fund | undefined {
  return funds.find((f) => f.tickerSymbol?.toUpperCase() === symbol.toUpperCase());
}

export function getEventsByTicker(symbol: string): FlowEvent[] {
  return flowEvents
    .filter((e) => e.tickerSymbol.toUpperCase() === symbol.toUpperCase())
    .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
}

export function getEventsByPerson(personId: string): FlowEvent[] {
  return flowEvents
    .filter((e) => e.personId === personId)
    .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
}

export function getNewsByTicker(symbol: string): NewsArticle[] {
  return newsArticles
    .filter((n) => n.tickers.map((t) => t.toUpperCase()).includes(symbol.toUpperCase()))
    .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
}

export function getEarningsByTicker(symbol: string): EarningsRecord[] {
  return earningsRecords.filter((e) => e.tickerSymbol.toUpperCase() === symbol.toUpperCase()).sort((a, b) => (b.date > a.date ? 1 : -1));
}

export function getDividendsByTicker(symbol: string): DividendRecord[] {
  return dividendRecords.filter((d) => d.tickerSymbol.toUpperCase() === symbol.toUpperCase()).sort((a, b) => (b.exDate > a.exDate ? 1 : -1));
}

export function getFilingsByTicker(symbol: string): SecFiling[] {
  return secFilings.filter((f) => f.tickerSymbol.toUpperCase() === symbol.toUpperCase()).sort((a, b) => (b.date > a.date ? 1 : -1));
}

// Person holdings (derived from events for display)
export interface PersonHolding {
  personId: string;
  tickerSymbol: string;
  valueUsd: number;
  lastTradeDate: string;
}

export const personHoldings: PersonHolding[] = [
  { personId: "p1", tickerSymbol: "AAPL", valueUsd: 1_240_000, lastTradeDate: today },
  { personId: "p2", tickerSymbol: "MSFT", valueUsd: 45_000, lastTradeDate: today },
  { personId: "p2", tickerSymbol: "JPM", valueUsd: 28_000, lastTradeDate: today },
  { personId: "p3", tickerSymbol: "META", valueUsd: 3_200_000, lastTradeDate: today },
  { personId: "p3", tickerSymbol: "AMD", valueUsd: 1_800_000, lastTradeDate: yesterday },
  { personId: "p4", tickerSymbol: "META", valueUsd: 2_100_000, lastTradeDate: yesterday },
  { personId: "p5", tickerSymbol: "JPM", valueUsd: 28_000, lastTradeDate: today },
  { personId: "p6", tickerSymbol: "NVDA", valueUsd: 15_600_000, lastTradeDate: yesterday },
  { personId: "p7", tickerSymbol: "AAPL", valueUsd: 1_200_000, lastTradeDate: today },
  { personId: "p8", tickerSymbol: "GOOGL", valueUsd: 85_000, lastTradeDate: weekAgo },
  { personId: "p9", tickerSymbol: "TSLA", valueUsd: 8_500_000, lastTradeDate: weekAgo },
  { personId: "p10", tickerSymbol: "NVDA", valueUsd: 4_200_000, lastTradeDate: today },
];

export function getHoldingsByPerson(personId: string): PersonHolding[] {
  return personHoldings
    .filter((h) => h.personId === personId)
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export function getTranscriptByTicker(symbol: string): TranscriptSummary[] {
  return transcriptSummaries.filter((t) => t.tickerSymbol.toUpperCase() === symbol.toUpperCase()).sort((a, b) => (b.date > a.date ? 1 : -1));
}

// Options call/put volume by ticker (from flow events)
export function getCallPutByTicker(): Map<string, { call: number; put: number }> {
  const map = new Map<string, { call: number; put: number }>();
  for (const e of flowEvents) {
    if (e.type !== "options") continue;
    const cur = map.get(e.tickerSymbol) ?? { call: 0, put: 0 };
    if (e.direction === "call") cur.call += e.sizeUsd;
    if (e.direction === "put") cur.put += e.sizeUsd;
    map.set(e.tickerSymbol, cur);
  }
  return map;
}

// Mock price history for sparklines (last 20 days)
export function getPriceHistory(symbol: string): number[] {
  const t = getTicker(symbol);
  if (!t) return [];
  const points = 20;
  const prices: number[] = [];
  const volatility = (t.high52w - t.low52w) / t.price * 0.3;
  let p = t.price * (0.92 + Math.random() * 0.08);
  for (let i = 0; i < points; i++) {
    p = p * (1 + (Math.random() - 0.48) * volatility);
    p = Math.max(t.low52w * 0.95, Math.min(t.high52w * 1.02, p));
    prices.push(p);
  }
  prices[points - 1] = t.price;
  return prices;
}

export function getHoldingsByFund(fundId: string, quarter?: string): FundHolding[] {
  let list = fundHoldings.filter((h) => h.fundId === fundId);
  if (quarter) list = list.filter((h) => h.quarter === quarter);
  return list.sort((a, b) => b.valueUsd - a.valueUsd);
}

export function getFundsHoldingTicker(symbol: string): (FundHolding & { fund: Fund })[] {
  return fundHoldings
    .filter((h) => h.tickerSymbol.toUpperCase() === symbol.toUpperCase())
    .map((h) => ({ ...h, fund: funds.find((f) => f.id === h.fundId)! }))
    .filter((x) => x.fund)
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export function getTopTickersByFlowToday(limit = 5): { symbol: string; totalSize: number; count: number }[] {
  const todayStart = today + "T00:00:00Z";
  const byTicker = new Map<string, { totalSize: number; count: number }>();
  for (const e of flowEvents) {
    if (e.timestamp < todayStart) continue;
    const cur = byTicker.get(e.tickerSymbol) ?? { totalSize: 0, count: 0 };
    cur.totalSize += e.sizeUsd;
    cur.count += 1;
    byTicker.set(e.tickerSymbol, cur);
  }
  return Array.from(byTicker.entries())
    .map(([symbol, v]) => ({ symbol, ...v }))
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, limit);
}

export function getLargestEventsToday(limit = 5): FlowEvent[] {
  const todayStart = today + "T00:00:00Z";
  return flowEvents
    .filter((e) => e.timestamp >= todayStart)
    .sort((a, b) => b.sizeUsd - a.sizeUsd)
    .slice(0, limit);
}

export function formatSize(sizeUsd: number): string {
  if (sizeUsd >= 1_000_000) return `$${(sizeUsd / 1_000_000).toFixed(1)}M`;
  if (sizeUsd >= 1_000) return `$${(sizeUsd / 1_000).toFixed(1)}K`;
  return `$${sizeUsd}`;
}

export function formatMarketCap(n: number): string {
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n}`;
}

// Search: tickers, people, funds
export const searchableTickers = tickers.map((t) => ({ ...t, type: "ticker" as const }));
export const searchablePeople = people.map((p) => ({ ...p, type: "person" as const }));
export const searchableFunds = funds.map((f) => ({ ...f, type: "fund" as const }));