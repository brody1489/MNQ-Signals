@echo off
title Run EVERYTHING - Master test suite (all phases, all day)
cd /d "%~dp0"
echo Running MASTER TEST SUITE: Phase 0-4 (TP, trail, entry, time, research), pick best, entry sensitivity, 4-day summary, tick replay.
echo Saves after each phase. Re-run to resume. May take hours.
echo.
python run_master.py
echo.
pause
