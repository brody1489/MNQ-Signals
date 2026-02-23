"""
Live signals config. API key and webhook from environment (or .env in this folder).
"""
import os
from pathlib import Path
from zoneinfo import ZoneInfo

# Load .env from this folder if present (so you can keep keys out of git)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

# --- API: set when you have a subscription (e.g. Databento) ---
# In CMD before running: set DATABENTO_API_KEY=db-your-key-here
# Or add to .env in this folder (see README)
# Railway: use exact name DATABENTO_API_KEY (case-sensitive). We accept common typos too.
API_KEY = (
    os.environ.get("DATABENTO_API_KEY", "").strip()
    or os.environ.get("Databento_API_KEY", "").strip()
)

# --- Discord: optional. If set, each LONG / TAKE PROFIT is posted to your channel. ---
# Create in Discord: Server → Channel → Integrations → Webhooks → New Webhook, copy URL
# Railway: use exact name DISCORD_WEBHOOK_URL (case-sensitive). We accept common typos too.
DISCORD_WEBHOOK_URL = (
    os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
    or os.environ.get("Discord_webhook_url", "").strip()
)

# --- Symbol and session (RTH only: 9:30 AM - 4:00 PM ET) ---
SYMBOL = "MNQ"
RTH_START_ET = (9, 30)   # 9:30 AM ET
RTH_END_ET = (16, 0)     # 4:00 PM ET
BAR_SEC = 60.0
EST = ZoneInfo("America/New_York")

# --- Databento (same as your historical data) ---
DATASET = "GLBX.MDP3"
# Default mbp-1 (L1) for Standard plan — no MBP-10, so paid usage stays off. Set DATABENTO_SCHEMA=mbp-10 only if you have MBP-10.
SCHEMA = os.environ.get("DATABENTO_SCHEMA", "mbp-1").strip() or "mbp-1"
# Historical data is delayed; never request end time past (now - DATA_DELAY_MINUTES). Prevents 422 data_end_after_available_end.
_DATA_DELAY = os.environ.get("DATABENTO_DATA_DELAY_MINUTES", "").strip()
DATA_DELAY_MINUTES = int(_DATA_DELAY) if _DATA_DELAY.isdigit() else 20
