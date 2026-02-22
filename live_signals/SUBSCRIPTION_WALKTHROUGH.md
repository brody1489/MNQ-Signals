# What to get so V1 and V2 run flawlessly (without surprise billing)

**L3 in market data:** In this context L3 = order-level (individual orders in the book), not satellite or alternative data. Your 1 month historic L2 + L3 is for backtesting/analysis; live we use L1 (mbp-1) on Standard.

After checking Databento, DXFeed, Rithmic, IQFeed, CME Group API, and Bookmap, here’s the concise picture and what to do.

---

## What the strategy actually needs

From our code we use:

- **mid** – from top of book (L1 is enough).
- **bid_depth / ask_depth** – sum of size at each level (passive accumulation and depth filter). With L1 that’s a single level; with MBP-10 that’s 10 levels.
- **buy_vol / sell_vol** – from trades (we need trades either way).
- **cob_ask** – list of (price, ask_depth) for “heatmap” resistance (TP). With MBP-10 we have 10 levels; with L1 we have one level per bar, so TP at resistance is weaker but still defined.

So: **L1 + trades is enough for the strategy to run.** Full MBP-10 improves depth and multi-level resistance; it’s not required for V1/V2 to function.

---

## Databento: what each plan gives you

- **Standard ($180/mo)**  
  - Live: **“core and L1 live (all schemas except MBP-10 and MBO)”**  
  - So live: **MBP-1** (L1), **trades**, and other core/L1 schemas. **No MBP-10, no MBO.**  
  - Historical: Depends on plan; often pay-per-use or included for some schemas. Confirm with Databento whether **Historical** requests for **MBP-1** (and/or MBP-10) are allowed on Standard and how they’re billed.

- **Higher tiers ($1,500 / $4,000 etc.)**  
  - These are where MBP-10 **live** is included. You said you’re not doing that, so we don’t rely on them.

So with **only** Standard:

- You **must not** request MBP-10 in live (or you’ll get denied or billed on a different product).  
- You **can** use **MBP-1 + trades** for live. Our app is built to support that.

---

## How we avoid billing for what you don’t have

We never request MBP-10 when you’re on Standard:

1. **Config**  
   - Set **`DATABENTO_SCHEMA=mbp-1`** in your environment (e.g. Railway Variables).  
   - The app then uses **only** the `mbp-1` schema for both backfill and live polling.  
   - No MBP-10 is requested → no MBP-10 billing.

2. **Same code path**  
   - Our bar builder already works with 1 or 10 levels. With MBP-1 we get one level per book update; we aggregate into 1-min bars (and running bar for V2) the same way.  
   - V1 and V2 run as they do now; only the schema (and thus depth) changes.

3. **What you get on Standard**  
   - **V1** (1-min bar close) and **V2** (running bar every 10s) both run.  
   - Same params, same Discord/CSV, same signals.  
   - **Difference:** depth is L1 (one level) and **cob_ask** is single-level, so “heatmap” TP is weaker than with MBP-10, but the strategy still runs and you won’t be billed for something you don’t have.

---

## Other providers (for full L2, if you want it later)

| Provider        | L2? | API? | Rough cost | Note |
|----------------|-----|-----|------------|------|
| **Databento Standard** | No (L1) | Yes | $180/mo | Use `mbp-1`; V1/V2 run; no MBP-10. |
| **Databento (higher)** | Yes (MBP-10) | Yes | $1.5k–4k/mo | You’re not doing this. |
| **IQFeed**     | Yes (futures depth) | Yes (socket) | ~\$157–182/mo | Core + RT futures + depth + exchange fees. Real L2; similar price to Standard but with depth. |
| **DXFeed**     | Yes | Yes | Quote-based | Used by Bookmap (~\$37/exchange for futures); no public retail price for API. |
| **Rithmic**    | Yes | Yes | Often via broker (e.g. ~\$20 + fees) | Full L2; need broker + their data. |
| **CME Group API** | No (top of book + trades) | Yes (WebSocket) | ~\$0.50/GB + ILA | L1 only. |
| **Bookmap**    | Depends on data feed | GUI-first | Platform + data separate | Data is usually DXFeed or similar; we’d need API access to the feed, not just the GUI. |

So: **for full L2 at a similar price to Standard, IQFeed is the main option** (~\$160–180/mo with depth). For **cheapest that works with our code today**, use **Databento Standard + MBP-1**.

---

## What to do step by step (recommended path)

### 1. Get Databento Standard ($180/mo)

- Sign up for **Standard** (the one that says “core and L1 live (all schemas except MBP-10 and MBO)”).  
- Do **not** subscribe to any add-on or product that includes MBP-10 unless you explicitly want to pay for that.

### 2. Create an API key

- In the Databento portal, create an API key that has access to **live** (and historical if you use backfill).  
- Standard includes L1 live; key should work for MBP-1 and trades.

### 3. Set env so we never touch MBP-10

In **Railway** (or wherever you run the app):

- **`DATABENTO_API_KEY`** = your Databento API key.  
- **`DATABENTO_SCHEMA`** = **`mbp-1`**  

Do **not** set `DATABENTO_SCHEMA=mbp-10` on Standard (that schema isn’t in your plan and could cause errors or different billing if they ever allow it).

### 4. Deploy and run

- Backfill and live polling both use **MBP-1** (and trades).  
- V1 and V2 run as they do now; Discord and CSV show V1/V2 with the same message format.  
- You only consume data that’s included in Standard → no surprise billing for MBP-10.

### 5. (Optional) Confirm with Databento

- Ask: “On Standard, can I use the **Historical** API for **MBP-1** for the same symbol (e.g. MNQ) and how is it billed?”  
- That way you know exactly what happens if the app does a backfill or extra historical requests.

---

## Summary

- **To run V1 and V2 flawlessly on what you’re willing to pay:**  
  - Get **Databento Standard ($180/mo)**.  
  - Set **`DATABENTO_SCHEMA=mbp-1`** and **`DATABENTO_API_KEY`** in your environment.  
  - We never request MBP-10; you only use L1 + trades that Standard includes.  

- **Functionally:**  
  - Both V1 and V2 run; notifications and tracking are the same; only depth is L1 (one level) and COB-based TP is weaker than with full MBP-10.  

- **If you later want full L2 at a similar price:**  
  - Consider **IQFeed** (~\$160–180/mo with futures L2); we’d add an IQFeed data source adapter and keep the same V1/V2 and Discord/CSV behavior.
