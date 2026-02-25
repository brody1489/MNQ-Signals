@echo off
cd /d "%~dp0"
if "%DATABENTO_API_KEY%"=="" (
  echo Set your API key first in this CMD window:
  echo   set DATABENTO_API_KEY=db-your-key-here
  echo Then run this script again.
  pause
  exit /b 1
)
echo Running 1-year L1 backtest (last 12 months to today, 10 workers). Results: data\long_backtest_trades.jsonl
echo For 1-month: add --months 1. For L2: add --schema mbp-10 (writes data\long_backtest_trades_mbp10.jsonl).
echo.
python run_long_backtest.py --workers 10
pause
