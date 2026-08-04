# 🚀 Indian Stock Analyzer & TradingView AI Engine

> **Aladdin Multi-Timeframe Adaptive AI Trading Engine & Screener Suite**  
> **Release Date**: August 4, 2026

## 📌 Overview
An advanced algorithmic trading and stock screening system tailored for the Indian Stock Market (NSE / BSE), NIFTY / BANKNIFTY Options, and F&O trading.

## 🚀 Key Features

### 1. TradingView Indicators (`tradingview_indicator.pine`)
- **13 Multi-Confluence AI Engines**:
  1. Trend Engine (KAMA Adaptive Moving Average + Fast EMA + Slow 200 SMA)
  2. Momentum Engine (RSI + MACD Derivative)
  3. Participation / VWAP Engine (VWAP + 1σ/2σ Bands)
  4. Market Structure & Smart Money Concepts (BOS, CHoCH, Fair Value Gaps, Liquidity Sweeps, Order Blocks)
  5. Central Pivot Range (CPR - Narrow/Wide/Average Day Classification)
  6. GIFT NIFTY Overnight Lead Engine (NSE IX 6:30 AM - 2:30 AM IST sentiment tracking)
  7. Multi-Timeframe Alignment (Auto HTF mapping)
  8. Stochastic RSI Engine (K/D crossover in overbought/oversold zones)
  9. Supertrend Engine (Factor-based dynamic trend flips)
  10. Ichimoku Cloud Engine (Tenkan/Kijun cross + Senkou Span cloud positioning)
  11. OBV Divergence Engine (Bullish & Bearish volume divergence tracking)
  12. Chaikin Money Flow (CMF money flow intensity)
  13. Volatility Squeeze & ATR Regime Engine
- **Movable Telemetry Dashboard**: 9 chart positions, customizable text size, displaying 16 real-time metrics & F&O action calls (`BUY CE`, `BUY PE`, `HOLD`).
- **Dynamic Trendlines & Key Levels**: Auto-drawn support/resistance trendlines with live price tags.

### 2. Strategy Companion (`tradingview_strategy.pine`)
- Synchronized backtest engine for TradingView strategy tester.
- Risk management with ATR-based stop loss, automated 1:2 R:R targets, and session/date filters.

### 3. Sector-Wide Penny Stock Breakout Scanner (`backend/scratch/runPennyBreakoutScanner.js`)
- Scans 100+ penny stock candidates (< ₹100) across 12 sectors in the Indian market.
- Evaluates 8 technical breakout signals: Volume Explosion, Bollinger Squeeze, 52W Low Bounce, MA Crossover, RSI Momentum, Accumulation, Base Breakout, and Institutional Footprint.
- Generates ranked breakout candidates with "Explosion Probability" scores.

---

*Pushed on August 4, 2026*
