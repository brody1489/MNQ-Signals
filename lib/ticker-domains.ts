// Symbol → Clearbit domain for company logos
export const TICKER_DOMAINS: Record<string, string> = {
  AAPL: "apple.com",
  MSFT: "microsoft.com",
  GOOGL: "google.com",
  AMZN: "amazon.com",
  NVDA: "nvidia.com",
  META: "meta.com",
  TSLA: "tesla.com",
  AMD: "amd.com",
  JPM: "jpmorganchase.com",
  "BRK.B": "berkshirehathaway.com",
  V: "visa.com",
  WMT: "walmart.com",
  JNJ: "jnj.com",
  PG: "pg.com",
  XOM: "exxonmobil.com",
  BAC: "bankofamerica.com",
  CVX: "chevron.com",
  BLK: "blackrock.com",
};

export function getTickerLogoUrl(symbol: string, size = 48): string {
  const domain = TICKER_DOMAINS[symbol];
  if (domain) {
    return `https://logo.clearbit.com/${domain}`;
  }
  return "";
}
