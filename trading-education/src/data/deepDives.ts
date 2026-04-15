/**
 * Deep-dive sub-pages. Linked from main content via "Learn more" / gold links.
 * Shown on a full black page with back button; not in main nav.
 */

export type DeepDiveContent = string | { paragraphs: string[]; bullets?: string[] };

export const DEEP_DIVES: Record<string, { title: string; content: DeepDiveContent }> = {
  greeks: {
    title: 'The Greeks — Deeper Dive',
    content: {
      paragraphs: [
        'The Greeks measure how sensitive an option\'s price is to different factors. You don\'t need to memorize formulas — you need to understand what each one means for how your position behaves.',
        'Delta: How much the option price changes for a $1 move in the stock. A delta of 0.50 means the option gains or loses about $0.50 per $1 move. Since options control 100 shares, that\'s $50 per contract per $1 move. Calls have positive delta (0 to +1); puts have negative (0 to -1). ATM options sit near 0.50. Deep ITM options approach 1.0 — they move almost dollar-for-dollar with the stock. Delta is also used as a rough probability of finishing ITM at expiration.',
        'Gamma: How fast delta changes as the stock moves. Think of it as delta\'s velocity. High gamma means a small stock move creates a large shift in your directional exposure. ATM options near expiration have the highest gamma. That\'s why 0DTE options can swing wildly on small moves — and why they\'re riskier than they look. Sellers fear gamma; buyers can benefit from it if the move happens fast enough to beat time decay.',
        'Theta: The daily loss in option value from time alone. If the stock does nothing for a day, the option still loses theta. Negative for buyers, positive for sellers. Theta accelerates in the final 30 days. Selling short-dated options captures faster decay; buying them is expensive relative to the time you have.',
        'Vega: Sensitivity to changes in implied volatility. A vega of 0.15 means the option gains or loses $0.15 per share (or $15 per contract) for every 1% move in IV. Vega matters most around known events — earnings, FDA decisions, economic data. Before the event, IV often rises and inflates premiums. After the event, IV collapses. If you\'re long options into a catalyst and the event resolves without a huge move, vega can work against you even when direction was right.',
        'Rho: Sensitivity to interest rates. For most short-term traders, rho is the least relevant Greek. It matters more for long-dated options (LEAPS) where rate changes over a year or more have a real impact.',
      ],
      bullets: [
        'Premium = Intrinsic Value + Extrinsic Value. Only extrinsic decays to zero at expiration.',
        'ATM options have the most extrinsic value and the highest gamma near expiration.',
        'IV crush after earnings is normal — it\'s the resolution of uncertainty, not manipulation.',
      ],
    },
  },
  'wash-sale': {
    title: 'Wash Sale Rule — Details',
    content: {
      paragraphs: [
        'The wash sale rule prevents you from claiming a tax loss on a security if you buy a "substantially identical" security within 30 days before or after the sale that generated the loss. The 30-day window runs in both directions.',
        'Example: You sell 100 shares of XYZ at a $1,000 loss on December 28. On January 5 (8 days later), you buy XYZ again. The $1,000 loss is disallowed and added to the cost basis of the new shares. You haven\'t escaped the loss — it\'s deferred, not gone.',
        'The rule applies to stocks, ETFs, and options on the same underlying. It does not currently apply to crypto under IRS guidance (this could change — check with a tax professional). It does not apply to futures (Section 1256 rules apply instead). "Substantially identical" is interpreted broadly — similar ETFs tracking the same index may qualify.',
      ],
      bullets: [
        'Always verify current rules at IRS.gov and with a qualified tax professional.',
        'Wash sales can affect year-end tax planning; plan around the 30-day window.',
      ],
    },
  },
  'section-1256': {
    title: 'Section 1256 & the 60/40 Rule',
    content: {
      paragraphs: [
        'Futures contracts and certain index options fall under Section 1256 of the tax code. They get a special treatment that many traders find advantageous.',
        'The 60/40 rule: Under Section 1256, gains and losses are split as 60% long-term and 40% short-term — regardless of how long you actually held the position. Even if you day-traded futures all year and held nothing overnight, 60% of your net gain is still taxed at long-term capital gains rates. That\'s a real advantage compared to stock day trading, where all short-term gains are taxed as ordinary income.',
        'Mark-to-market at year-end: Section 1256 contracts are marked to market on December 31. All open positions are treated as if sold at their year-end value for tax purposes. That creates a gain or loss even if you didn\'t close the position.',
        'What qualifies: Regulated futures (ES, MES, NQ, MNQ, crude, gold, etc.), certain foreign currency contracts, and broad-based index options (e.g. SPX, NDX, RUT) — confirm with a tax professional. Equity options on individual stocks do not qualify.',
      ],
      bullets: [
        'Form 6781 is used to report Section 1256 gains and losses and the 60/40 split.',
        'Tax rules change. Verify with IRS.gov and a qualified tax professional.',
      ],
    },
  },
  'pdt-rule': {
    title: 'Pattern Day Trader (PDT) Rule',
    content: {
      paragraphs: [
        'FINRA Rule 4210 defines a Pattern Day Trader as someone who executes four or more "day trades" within five business days in a margin account, when those day trades are more than 6% of their total trades in that period.',
        'A day trade is opening and closing the same position (same security, same direction) on the same trading day. Each round trip counts as one day trade.',
        'On April 14, 2026, the SEC approved FINRA changes that remove the fixed $25,000 PDT minimum equity requirement and replace the old PDT framework with intraday margin standards. FINRA stated the rule becomes effective 45 days after it publishes the related Regulatory Notice, with firms allowed a phased rollout after that.',
        'Until your broker implements the new framework, many firms may still enforce legacy PDT restrictions (including the three-day-trades-in-five-days limitation for under-$25,000 margin accounts). Once implemented, there is no universal fixed $25,000 PDT gate, but broker house rules and margin requirements still apply.',
        'PDT/legacy day-trading limits do not apply to: cash accounts (but settlement rules still limit rapid cycling); futures accounts; forex accounts; crypto exchanges; or accounts outside the U.S.',
        'Cash-account myth check: cash accounts are not subject to PDT, but you can only use settled funds. Selling on Monday may not settle until Tuesday; reusing that cash too early can cause a good faith violation.',
      ],
      bullets: [
        'Watch your broker\'s notices for the exact implementation date and account-level changes.',
        'Even after PDT removal, margin accounts can still have broker-specific minimum equity and risk controls.',
        'Futures traders can day trade with any account size; PDT does not apply.',
      ],
    },
  },
};
