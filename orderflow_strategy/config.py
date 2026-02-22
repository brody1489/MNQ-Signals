"""
Safe limits for Databento data fetching.
DO NOT INCREASE without understanding the cost impact.
"""
import os
from pathlib import Path

# Load .env from this directory if present (so you can keep key out of git)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

# --- API key: use env var or .env, NEVER commit .env ---
def get_api_key() -> str:
    key = os.environ.get("DATABENTO_API_KEY", "").strip()
    if not key:
        raise SystemExit(
            "ERROR: Set DATABENTO_API_KEY in your environment.\n"
            "  Windows CMD: set DATABENTO_API_KEY=db-your-key-here\n"
            "  PowerShell:  $env:DATABENTO_API_KEY='db-your-key-here'\n"
            "  Or create .env file in orderflow_strategy/ with DATABENTO_API_KEY=..."
        )
    return key


# --- HARD LIMITS (safety) ---
MAX_ESTIMATED_COST_USD = 10.0     # Abort if get_cost() returns more (raise for more data)
MAX_ESTIMATED_GB = 2.0            # Abort if estimated size > this (raise for more data)
MAX_DAYS_PER_REQUEST = 2          # Never request more than 2 days at once
MAX_HOURS_DEFAULT = 0.1           # Default: 6 min (~0.8GB, ~$0.41)

# --- DATA SIZE GUIDE (MNQH6 MBP-10) ---
# 6 min  = 0.83 GB, $0.41
# 15 min = 1.57 GB, $0.78  (increase MAX_ESTIMATED_GB to 2.0)
# 1 hour = 6.3 GB,  ~$3.15 (increase limits)

# --- Default request params ---
DATASET = "GLBX.MDP3"
SYMBOL = "MNQH6"                  # Single contract - March 2026
SCHEMA = "mbp-10"                 # Level 2 depth, 10 levels

# --- Paths ---
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
