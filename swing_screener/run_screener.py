"""
Large-Cap Swing Screener v2
Goal: 1-4 week hold, several % gain. Key levels, sector/RS, cooldown, real 1-10 score.
Run: python run_screener.py
"""

import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
import time
import os
import warnings
warnings.filterwarnings("ignore")

# -----------------------------------------------------------------------------
# CONFIG v2 (key levels, sector, cooldown, scoring)
# -----------------------------------------------------------------------------
MIN_MARKET_CAP_B = 20
MIN_AVG_VOLUME = 500_000
SPY_REQUIRE_ABOVE_200 = True
PULLBACK_MIN_PCT = 5
PULLBACK_MAX_PCT = 15
MAX_EXTENDED_PCT_ABOVE_200 = 25   # allow names up to 25% above 200 SMA (was 15, too strict in strong markets)
RECENT_VOLUME_MAX_RATIO = 1.3
EARNINGS_DAYS_AHEAD_EXCLUDE = 14
BATCH_SIZE = 100
PERIOD = "2y"                      # 2 years for key levels and 200 SMA
SLEEP_BETWEEN_BATCHES = 1.2
COOLDOWN_DAYS = 28                 # don't re-suggest a ticker for 4 weeks
PIVOT_LOOKBACK = 5                 # bars each side for swing high/low
NEAR_SUPPORT_PCT = 4               # must be within this % of a support level or 50 SMA
MIN_UPSIDE_TO_RESISTANCE_PCT = 3   # min % upside to next resistance (or to 20d high)
LOG_FILENAME = "screener_log.csv"

# GICS sector name -> SPDR sector ETF
GICS_TO_ETF = {
    "Information Technology": "XLK",
    "Financials": "XLF",
    "Health Care": "XLV",
    "Consumer Discretionary": "XLY",
    "Communication Services": "XLC",
    "Industrials": "XLI",
    "Consumer Staples": "XLP",
    "Energy": "XLE",
    "Utilities": "XLU",
    "Real Estate": "XLRE",
    "Materials": "XLB",
}

# -----------------------------------------------------------------------------
# S&P 500 universe (with sector for v2)
# -----------------------------------------------------------------------------
def get_sp500_with_sectors():
    """Returns (list of tickers, dict ticker -> GICS sector name)."""
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    try:
        import urllib.request
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read()
        tables = pd.read_html(html)
        df = tables[0]
        df["Symbol"] = df["Symbol"].str.replace(".", "-", regex=False)
        symbols = df["Symbol"].tolist()
        sector_col = "GICS Sector" if "GICS Sector" in df.columns else (df.columns[2] if len(df.columns) > 2 else None)
        sector_map = {}
        if sector_col:
            sector_map = dict(zip(df["Symbol"], df[sector_col].astype(str)))
        return symbols, sector_map
    except Exception:
        pass
    script_dir = os.path.dirname(os.path.abspath(__file__))
    fallback_path = os.path.join(script_dir, "sp500_tickers.txt")
    try:
        import urllib.request
        from io import StringIO
        csv_url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
        req = urllib.request.Request(csv_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            csv_data = resp.read().decode()
        df = pd.read_csv(StringIO(csv_data))
        df["Symbol"] = df["Symbol"].str.replace(".", "-", regex=False)
        symbols = df["Symbol"].tolist()
        sector_map = {}
        if "GICS Sector" in df.columns:
            sector_map = dict(zip(df["Symbol"], df["GICS Sector"].astype(str)))
        try:
            with open(fallback_path, "w") as f:
                f.write("\n".join(symbols))
        except Exception:
            pass
        print(f"Loaded S&P 500 from backup ({len(symbols)} tickers).")
        return symbols, sector_map
    except Exception:
        pass
    if os.path.isfile(fallback_path):
        try:
            with open(fallback_path, "r") as f:
                symbols = [line.strip() for line in f if line.strip()]
            print(f"Using cached list ({len(symbols)} tickers).")
            return symbols, {}
        except Exception:
            pass
    fallback = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "BRK-B", "JPM", "V", "JNJ"]
    return fallback, {}

def get_sp500_tickers():
    tickers, _ = get_sp500_with_sectors()
    return tickers

# -----------------------------------------------------------------------------
# Price data in batches
# -----------------------------------------------------------------------------
def fetch_ohlcv_batched(tickers, period=PERIOD):
    all_data = {}
    for i in range(0, len(tickers), BATCH_SIZE):
        batch = tickers[i : i + BATCH_SIZE]
        try:
            df = yf.download(
                batch, period=period, group_by="ticker", auto_adjust=True,
                progress=False, threads=True, timeout=15
            )
            if df.empty:
                time.sleep(SLEEP_BETWEEN_BATCHES)
                continue
            if len(batch) == 1:
                df = df.copy()
                df.columns = [c if isinstance(c, str) else c[0] for c in df.columns]
                all_data[batch[0]] = df[["Close", "High", "Low", "Volume"]].copy()
            else:
                if isinstance(df.columns, pd.MultiIndex):
                    tickers_in_df = df.columns.get_level_values(0).unique()
                else:
                    tickers_in_df = [batch[0]] if len(batch) == 1 else []
                for sym in batch:
                    if sym not in tickers_in_df:
                        continue
                    try:
                        sub = df[sym].copy()
                        if sub is None or sub.empty:
                            continue
                        if isinstance(sub.columns, pd.MultiIndex):
                            sub.columns = sub.columns.get_level_values(0)
                        needed = ["Close", "High", "Low", "Volume"]
                        if all(c in sub.columns for c in needed):
                            all_data[sym] = sub[needed].copy()
                    except Exception:
                        continue
        except Exception as e:
            print(f"  Batch error: {e}")
        time.sleep(SLEEP_BETWEEN_BATCHES)
    return all_data

# -----------------------------------------------------------------------------
# Key levels from swing pivots (support / resistance)
# -----------------------------------------------------------------------------
def find_swing_pivots(high_series, low_series, lookback=PIVOT_LOOKBACK):
    """Return (list of swing_high prices, list of swing_low prices)."""
    high = high_series.values
    low = low_series.values
    n = len(high)
    swing_highs = []
    swing_lows = []
    for i in range(lookback, n - lookback):
        if high[i] >= np.max(high[i - lookback : i + lookback + 1]):
            swing_highs.append(high[i])
        if low[i] <= np.min(low[i - lookback : i + lookback + 1]):
            swing_lows.append(low[i])
    return swing_highs, swing_lows

def nearest_support_resistance(close_last, swing_highs, swing_lows):
    """Nearest support below price, nearest resistance above. Returns (support, resistance, pct_to_support, pct_to_resistance)."""
    supports = [s for s in swing_lows if s < close_last]
    resistances = [r for r in swing_highs if r > close_last]
    support = max(supports) if supports else None
    resistance = min(resistances) if resistances else None
    pct_to_support = (close_last - support) / close_last * 100 if support and close_last > 0 else None
    pct_to_resistance = (resistance - close_last) / close_last * 100 if resistance and close_last > 0 else None
    return support, resistance, pct_to_support, pct_to_resistance

# -----------------------------------------------------------------------------
# Indicators
# -----------------------------------------------------------------------------
def rsi(close_series, period=14):
    delta = close_series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def compute_metrics(ticker, df):
    if df is None or len(df) < 50:
        return None
    df = df.dropna(subset=["Close", "Volume"])
    if len(df) < 50:
        return None
    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    vol = df["Volume"]

    # MAs
    sma20 = close.rolling(20).mean()
    sma50 = close.rolling(50).mean()
    sma200 = close.rolling(200).mean()
    # We may have fewer than 200 rows
    if len(close) < 200:
        sma200 = close.rolling(min(200, len(close))).mean()

    last = close.iloc[-1]
    last_vol = vol.iloc[-1] if len(vol) > 0 else np.nan
    vol_20d = vol.rolling(20).mean().iloc[-1] if len(vol) >= 20 else np.nan

    # Highs (use last 20 and full window for "52w")
    high_20d = high.iloc[-20:].max() if len(high) >= 20 else high.max()
    high_52w = high.max()

    sma20_last = sma20.iloc[-1]
    sma50_last = sma50.iloc[-1]
    sma200_last = sma200.iloc[-1]

    # % down from highs
    pct_down_20d = (1 - last / high_20d) * 100 if high_20d > 0 else 0
    pct_down_52w = (1 - last / high_52w) * 100 if high_52w > 0 else 0

    # Last 2 / 3 days
    if len(close) >= 3:
        last_2d_return = (close.iloc[-1] / close.iloc[-2] - 1) * 100
        last_3d_return = (close.iloc[-1] / close.iloc[-3] - 1) * 100
        last_2d_vol_avg = vol.iloc[-2:].mean()
        last_3d_vol_avg = vol.iloc[-3:].mean()
    else:
        last_2d_return = last_3d_return = 0
        last_2d_vol_avg = last_3d_vol_avg = vol_20d

    vol_ratio_2d = last_2d_vol_avg / vol_20d if vol_20d and vol_20d > 0 else 1
    vol_ratio_3d = last_3d_vol_avg / vol_20d if vol_20d and vol_20d > 0 else 1

    # RSI
    rsi_last = rsi(close, 14).iloc[-1] if len(close) >= 14 else 50

    # % above 200 SMA
    pct_above_200 = (last / sma200_last - 1) * 100 if sma200_last and sma200_last > 0 else 0

    # 50 SMA slope (5 days)
    if len(sma50) >= 5 and not pd.isna(sma50.iloc[-5]):
        sma50_slope = (sma50.iloc[-1] - sma50.iloc[-5]) / sma50.iloc[-5] * 100
    else:
        sma50_slope = 0

    # Key levels from swing pivots (full history)
    swing_highs, swing_lows = find_swing_pivots(high, low)
    support, resistance, pct_to_support, upside_to_resistance = nearest_support_resistance(last, swing_highs, swing_lows)
    # Also consider 50 SMA as support if no pivot support
    if support is None and sma50_last and sma50_last < last:
        support = sma50_last
        pct_to_support = (last - sma50_last) / last * 100

    return {
        "ticker": ticker,
        "close": last,
        "sma20": sma20_last,
        "sma50": sma50_last,
        "sma200": sma200_last,
        "high_20d": high_20d,
        "high_52w": high_52w,
        "pct_down_20d": pct_down_20d,
        "pct_down_52w": pct_down_52w,
        "last_2d_return": last_2d_return,
        "last_3d_return": last_3d_return,
        "vol_20d": vol_20d,
        "vol_ratio_2d": vol_ratio_2d,
        "vol_ratio_3d": vol_ratio_3d,
        "rsi": rsi_last,
        "pct_above_200": pct_above_200,
        "sma50_slope_pct": sma50_slope,
        "support": support,
        "resistance": resistance,
        "pct_to_support": pct_to_support,
        "upside_to_resistance": upside_to_resistance,
    }

# -----------------------------------------------------------------------------
# SPY regime
# -----------------------------------------------------------------------------
def get_spy_above_200(data_dict):
    if "SPY" not in data_dict:
        return None
    df = data_dict["SPY"]
    if df is None or len(df) < 50:
        return None
    close = df["Close"]
    if isinstance(close.iloc[-1], (pd.Series, np.ndarray)):
        last_close = float(close.iloc[-1].iloc[0]) if len(close.iloc[-1]) else np.nan
    else:
        last_close = float(close.iloc[-1])
    sma200 = close.rolling(min(200, len(close))).mean()
    if isinstance(sma200.iloc[-1], (pd.Series, np.ndarray)):
        last_sma = float(sma200.iloc[-1].iloc[0]) if len(sma200.iloc[-1]) else np.nan
    else:
        last_sma = float(sma200.iloc[-1])
    if np.isnan(last_close) or np.isnan(last_sma):
        return None
    return last_close > last_sma

# -----------------------------------------------------------------------------
# Filter: trend, pullback, recent days, volume, extended
# -----------------------------------------------------------------------------
def passes_filters(m, spy_ok):
    if m is None or pd.isna(m["close"]):
        return False
    if m["vol_20d"] is None or m["vol_20d"] < MIN_AVG_VOLUME:
        return False
    if m["sma200"] is None or m["sma200"] <= 0:
        return False
    if m["sma50"] is None or m["sma50"] <= 0:
        return False
    # Trend: price above 50 and 200; 50 above 200
    if m["close"] <= m["sma50"] or m["close"] <= m["sma200"]:
        return False
    if m["sma50"] <= m["sma200"]:
        return False
    # Pullback range
    if m["pct_down_20d"] < PULLBACK_MIN_PCT or m["pct_down_20d"] > PULLBACK_MAX_PCT:
        return False
    # Not overextended
    if m["pct_above_200"] > MAX_EXTENDED_PCT_ABOVE_200:
        return False
    # Recent: prefer last 2 up or last 3 up; allow last 3d not deeply red (stabilization)
    last_up = m["last_2d_return"] >= 0
    last_3_up = m["last_3d_return"] >= 0
    last_3_not_crash = m["last_3d_return"] >= -3  # allow small pullback in last 3 days
    if not (last_up or last_3_up or last_3_not_crash):
        return False
    # Volume: no distribution
    if m["vol_ratio_2d"] > RECENT_VOLUME_MAX_RATIO or m["vol_ratio_3d"] > RECENT_VOLUME_MAX_RATIO:
        return False
    # Regime
    if SPY_REQUIRE_ABOVE_200 and spy_ok is not None and not spy_ok:
        return False
    # Key levels: prefer near support or 50 SMA; allow loose (within 8% of 50 SMA) so we get candidates
    near_50_sma = (m["sma50"] and m["close"] > 0 and
                   abs(m["close"] - m["sma50"]) / m["close"] * 100 <= NEAR_SUPPORT_PCT)
    near_pivot_support = (m.get("pct_to_support") is not None and
                          m["pct_to_support"] <= NEAR_SUPPORT_PCT)
    near_50_loose = (m["sma50"] and m["close"] > 0 and
                     abs(m["close"] - m["sma50"]) / m["close"] * 100 <= 8)
    if not (near_50_sma or near_pivot_support or near_50_loose):
        return False
    # Meaningful upside: to resistance or to 20d high (min 2% so we don't over-filter)
    min_upside = min(MIN_UPSIDE_TO_RESISTANCE_PCT, 2)
    upside = m.get("upside_to_resistance")
    if upside is not None:
        if upside < min_upside:
            return False
    else:
        if m["high_20d"] and m["close"] > 0:
            upside_20d = (m["high_20d"] - m["close"]) / m["close"] * 100
            if upside_20d < min_upside:
                return False
    return True

# -----------------------------------------------------------------------------
# Cooldown: exclude tickers suggested in last COOLDOWN_DAYS
# -----------------------------------------------------------------------------
def load_cooldown_tickers(script_dir):
    log_path = os.path.join(script_dir, LOG_FILENAME)
    if not os.path.isfile(log_path):
        return set()
    try:
        df = pd.read_csv(log_path)
        if "Date" not in df.columns or "Ticker" not in df.columns:
            return set()
        cutoff = (pd.Timestamp.now() - timedelta(days=COOLDOWN_DAYS)).strftime("%Y-%m-%d")
        recent = df[df["Date"] >= cutoff]
        return set(recent["Ticker"].dropna().astype(str).unique())
    except Exception:
        return set()

def save_cooldown_append(script_dir, date_str, tickers):
    log_path = os.path.join(script_dir, LOG_FILENAME)
    rows = [{"Date": date_str, "Ticker": t} for t in tickers]
    df_new = pd.DataFrame(rows)
    if os.path.isfile(log_path):
        try:
            df_old = pd.read_csv(log_path)
            df_new = pd.concat([df_old, df_new], ignore_index=True)
        except Exception:
            pass
    df_new.to_csv(log_path, index=False)

# -----------------------------------------------------------------------------
# Market cap, earnings (get_earnings_dates), news
# -----------------------------------------------------------------------------
def get_market_cap(ticker):
    try:
        t = yf.Ticker(ticker)
        info = t.info
        cap = info.get("marketCap")
        if cap is None:
            return None
        return cap
    except Exception:
        return None

def get_next_earnings_days(ticker):
    try:
        t = yf.Ticker(ticker)
        ed = t.get_earnings_dates(limit=20)
        if ed is None or not isinstance(ed, pd.DataFrame) or ed.empty:
            return None
        now = pd.Timestamp.now().normalize()
        if now.tzinfo is not None:
            now = now.tz_localize(None)
        for d in ed.index:
            try:
                dt = pd.Timestamp(d)
                if getattr(dt, "tz", None) is not None:
                    dt = dt.tz_localize(None) if dt.tz is not None else dt
                dt = dt.normalize()
                if dt >= now:
                    delta = (dt - now).days
                    return int(delta)
            except Exception:
                continue
        return None
    except Exception:
        return None

def get_recent_headline(ticker):
    try:
        t = yf.Ticker(ticker)
        news = getattr(t, "news", None)
        if news and len(news) > 0 and isinstance(news[0], dict):
            return news[0].get("title", "")[:80] or None
        return None
    except Exception:
        return None

# -----------------------------------------------------------------------------
# Score 1-10 for ranking (differentiated, meaningful)
# -----------------------------------------------------------------------------
def score_1_to_10(m):
    raw = 0.0
    # Pullback in sweet spot 6-12% (0 - 1.5)
    if 6 <= m["pct_down_20d"] <= 12:
        raw += 1.5
    elif PULLBACK_MIN_PCT <= m["pct_down_20d"] <= 15:
        raw += 0.75
    # Near support (0 - 2)
    if m.get("pct_to_support") is not None:
        if m["pct_to_support"] <= 1.5:
            raw += 2.0
        elif m["pct_to_support"] <= NEAR_SUPPORT_PCT:
            raw += 1.0
    elif m["sma50"] and abs(m["close"] - m["sma50"]) / m["close"] * 100 <= NEAR_SUPPORT_PCT:
        raw += 1.0
    # Upside to resistance (0 - 2)
    u = m.get("upside_to_resistance")
    if u is not None:
        if u >= 10:
            raw += 2.0
        elif u >= MIN_UPSIDE_TO_RESISTANCE_PCT:
            raw += 1.0
    # Sector leading (0 - 1.5): sector ETF 20d return > 0
    if m.get("sector_etf_return_20d") is not None and m["sector_etf_return_20d"] > 0:
        raw += 1.5
    elif m.get("sector_etf_return_20d") is not None:
        raw += 0.5
    # Stock vs sector (0 - 1.5): outperforming sector
    if m.get("stock_vs_sector_20d") is not None:
        if m["stock_vs_sector_20d"] > 0:
            raw += 1.5
        else:
            raw += 0.25
    # Volume not distribution (0 - 1)
    if m["vol_ratio_2d"] <= 1.2 and m["vol_ratio_3d"] <= 1.2:
        raw += 1.0
    elif m["vol_ratio_2d"] <= RECENT_VOLUME_MAX_RATIO:
        raw += 0.5
    # RSI in range 35-55 (0 - 0.5)
    if 35 <= m["rsi"] <= 55:
        raw += 0.5
    # 50 SMA rising (0 - 0.5)
    if m["sma50_slope_pct"] > 0:
        raw += 0.5
    # Normalize to 1-10 (max raw ~10)
    score_10 = 1.0 + (raw / 10.0) * 9.0
    return min(10.0, max(1.0, round(score_10, 1)))

# -----------------------------------------------------------------------------
# Narrative string (v2: key levels, sector, RS)
# -----------------------------------------------------------------------------
def narrative(m, earnings_days, headline=None):
    lines = []
    lines.append(f"  Dip: {m['pct_down_20d']:.1f}% from 20d high, {m['pct_down_52w']:.1f}% from 52w high")
    lines.append(f"  Recent: Last 2d {m['last_2d_return']:+.1f}%, Last 3d {m['last_3d_return']:+.1f}% | Vol 2d: {m['vol_ratio_2d']:.2f}x 20d avg")
    lines.append(f"  Structure: Price ${m['close']:.2f} above 50 SMA ${m['sma50']:.2f} & 200 SMA ${m['sma200']:.2f} | RSI {m['rsi']:.0f}")
    # Key levels
    sup = m.get("support")
    res = m.get("resistance")
    if sup is not None or res is not None:
        levels = []
        if sup is not None:
            levels.append(f"Support ${sup:.2f}" + (f" ({m.get('pct_to_support', 0):.1f}% below)" if m.get("pct_to_support") is not None else ""))
        if res is not None:
            levels.append(f"Resistance ${res:.2f}" + (f" ({m.get('upside_to_resistance', 0):.1f}% upside)" if m.get("upside_to_resistance") is not None else ""))
        lines.append(f"  Key levels: " + " | ".join(levels))
    else:
        lines.append(f"  Levels: 20d high ${m['high_20d']:.2f} | 50 SMA ${m['sma50']:.2f}")
    if m.get("sector_etf_return_20d") is not None:
        lines.append(f"  Sector: {m.get('sector_name', '')} | Sector ETF 20d {m['sector_etf_return_20d']:+.1f}% | Stock vs sector 20d {m.get('stock_vs_sector_20d', 0):+.1f}%")
    if earnings_days is not None:
        if earnings_days <= EARNINGS_DAYS_AHEAD_EXCLUDE:
            lines.append(f"  Earnings: in {earnings_days} days (EXCLUDED)")
        else:
            lines.append(f"  Earnings: in {earnings_days} days")
    else:
        lines.append(f"  Earnings: next date unknown")
    if headline:
        lines.append(f"  News: {headline}")
    return "\n".join(lines)

# -----------------------------------------------------------------------------
# Sector returns (20d) for relative strength
# -----------------------------------------------------------------------------
def fetch_sector_returns(script_dir, sector_etfs):
    """Fetch 2y data for sector ETFs, return dict etf_symbol -> 20d return pct."""
    if not sector_etfs:
        return {}
    out = {}
    syms = list(sector_etfs)[:12]
    try:
        df = yf.download(syms, period=PERIOD, group_by="ticker", auto_adjust=True, progress=False, timeout=25)
        if df.empty:
            return {}
        for sym in syms:
            try:
                if len(syms) == 1:
                    close = df["Close"] if "Close" in df.columns else df.iloc[:, 0]
                else:
                    if not isinstance(df.columns, pd.MultiIndex) or sym not in df.columns.get_level_values(0):
                        continue
                    sub = df[sym]
                    close = sub["Close"] if isinstance(sub, pd.DataFrame) and "Close" in sub.columns else sub
                if close is None or len(close) < 20:
                    continue
                ret_20 = (float(close.iloc[-1]) / float(close.iloc[-20]) - 1) * 100
                out[sym] = ret_20
            except Exception:
                continue
        return out
    except Exception:
        return {}

def add_sector_rs(candidates, sector_map, sector_etf_returns, data):
    """Add sector_etf_return_20d, stock_return_20d, stock_vs_sector_20d, sector_name to each m."""
    for m in candidates:
        ticker = m["ticker"]
        sector_name = sector_map.get(ticker, "")
        etf = GICS_TO_ETF.get(sector_name)
        m["sector_name"] = sector_name or "Unknown"
        m["sector_etf_return_20d"] = None
        m["stock_vs_sector_20d"] = None
        if not etf or etf not in sector_etf_returns:
            continue
        m["sector_etf_return_20d"] = sector_etf_returns[etf]
        if ticker in data and data[ticker] is not None and len(data[ticker]) >= 20:
            close = data[ticker]["Close"]
            stock_ret_20 = (close.iloc[-1] / close.iloc[-20] - 1) * 100
            m["stock_vs_sector_20d"] = float(stock_ret_20 - sector_etf_returns[etf])

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    today = datetime.now().strftime("%Y-%m-%d")
    print("=" * 60)
    print("LARGE-CAP SWING SCREENER v2")
    print(f"Run date: {today}")
    print("Key levels | Sector/RS | 4-week cooldown | Score 1-10")
    print("=" * 60)

    # 0) Cooldown: tickers suggested in last 4 weeks
    cooldown = load_cooldown_tickers(script_dir)
    print(f"\n[0] Cooldown: excluding {len(cooldown)} tickers from last {COOLDOWN_DAYS} days")

    # 1) Universe with sectors
    print("\n[1/7] Loading S&P 500 with sectors...")
    tickers, sector_map = get_sp500_with_sectors()
    tickers = [t for t in tickers if t not in cooldown]
    print(f"      {len(tickers)} tickers (after cooldown)")

    # 2) Price data (2y)
    print("\n[2/7] Fetching price data (2y batches)...")
    data = fetch_ohlcv_batched(tickers)
    if "SPY" not in data:
        spy_df = yf.download("SPY", period=PERIOD, auto_adjust=True, progress=False, timeout=15)
        if not spy_df.empty and "Close" in spy_df.columns:
            data["SPY"] = spy_df[["Close", "High", "Low", "Volume"]].copy()
    spy_ok = get_spy_above_200(data)
    # Sector ETFs for relative strength
    sector_etfs = set(GICS_TO_ETF.values())
    sector_etf_returns = fetch_sector_returns(script_dir, sector_etfs)
    print(f"      Data: {len([k for k in data if k != 'SPY'])} tickers | SPY>200: {spy_ok} | Sector ETFs: {len(sector_etf_returns)}")

    # 3) Metrics, key levels, filters
    print("\n[3/7] Computing metrics + key levels, applying filters...")
    candidates = []
    for sym in data:
        if sym == "SPY":
            continue
        m = compute_metrics(sym, data[sym])
        if m and passes_filters(m, spy_ok):
            candidates.append(m)
    add_sector_rs(candidates, sector_map, sector_etf_returns, data)
    print(f"      {len(candidates)} passed trend/pullback/key-level filters")

    if not candidates:
        print("\n[4/7] No candidates.")
        print("--- RESULT: 0 tickers ---")
        out_path = os.path.join(script_dir, f"screener_{datetime.now().strftime('%Y%m%d')}.csv")
        pd.DataFrame(columns=["Date", "Ticker"]).to_csv(out_path, index=False)
        return

    # 4) Market cap
    print("\n[4/7] Market cap >= $20B...")
    min_cap = MIN_MARKET_CAP_B * 1e9
    with_cap = []
    for m in candidates:
        time.sleep(0.12)
        cap = get_market_cap(m["ticker"])
        if cap is not None and cap >= min_cap:
            m["market_cap_b"] = round(cap / 1e9, 1)
            with_cap.append(m)
    candidates = with_cap
    print(f"      {len(candidates)}")

    # 5) Earnings (exclude if within 14 days)
    print("\n[5/7] Earnings filter...")
    for m in candidates:
        time.sleep(0.1)
        ed = get_next_earnings_days(m["ticker"])
        m["earnings_days"] = ed
        m["exclude_earnings"] = ed is not None and ed <= EARNINGS_DAYS_AHEAD_EXCLUDE
    final = [m for m in candidates if not m.get("exclude_earnings", False)]
    print(f"      {len(final)} after earnings")

    # 6) Score 1-10 and sort
    for m in final:
        m["score"] = score_1_to_10(m)
    final.sort(key=lambda x: x["score"], reverse=True)

    # 7) Output + optional news headline
    print("\n[6/7] Output")
    print("-" * 60)
    if not final:
        print("No tickers passed all filters.")
    else:
        for i, m in enumerate(final, 1):
            headline = None
            try:
                headline = get_recent_headline(m["ticker"])
            except Exception:
                pass
            print(f"\n{i}. {m['ticker']}  Score: {m['score']}/10")
            print(narrative(m, m.get("earnings_days"), headline))
    print("\n" + "=" * 60)
    print(f"--- RESULT: {len(final)} ticker(s) ---")

    # Save CSV and cooldown log
    rows = []
    for m in final:
        rows.append({
            "Date": today,
            "Ticker": m["ticker"],
            "Score": m["score"],
            "Close": round(m["close"], 2),
            "Pct_Down_20d": round(m["pct_down_20d"], 1),
            "Support": round(m["support"], 2) if m.get("support") else None,
            "Resistance": round(m["resistance"], 2) if m.get("resistance") else None,
            "Upside_Pct": round(m["upside_to_resistance"], 1) if m.get("upside_to_resistance") is not None else None,
            "Sector": m.get("sector_name"),
            "Stock_vs_Sector_20d": round(m["stock_vs_sector_20d"], 1) if m.get("stock_vs_sector_20d") is not None else None,
            "Earnings_Days": m.get("earnings_days"),
        })
    out_path = os.path.join(script_dir, f"screener_{datetime.now().strftime('%Y%m%d')}.csv")
    pd.DataFrame(rows).to_csv(out_path, index=False)
    print(f"Saved: {out_path}")
    save_cooldown_append(script_dir, today, [m["ticker"] for m in final])
    print(f"Logged to {LOG_FILENAME} (cooldown {COOLDOWN_DAYS} days)")

if __name__ == "__main__":
    main()
