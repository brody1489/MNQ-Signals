import { useMemo, useState } from 'react';
import './AppV2.css';
import { TERMS, TERM_CATEGORIES, type TermCategory } from './data/terms';
import { DEEP_DIVES } from './data/deepDives';

interface Resource {
  id: string;
  title: string;
  type: 'Video' | 'Article' | 'Tool';
  blurb: string;
  linkLabel: string;
}

const SAMPLE_RESOURCES: Resource[] = [
  {
    id: 'cme',
    title: 'CME Group (Official)',
    type: 'Video',
    blurb: 'Futures education from the exchange. Mechanics, margin, contract specs. No sales pitch.',
    linkLabel: 'YouTube',
  },
  {
    id: 'options-davis',
    title: 'Options with Davis',
    type: 'Video',
    blurb: 'Options mechanics and Greeks explained clearly with real examples.',
    linkLabel: 'YouTube',
  },
  {
    id: 'irs',
    title: 'IRS.gov — Investment Income',
    type: 'Tool',
    blurb: 'Publication 550, Form 6781, Schedule D. The source for tax rules. Not optional if you trade actively.',
    linkLabel: 'irs.gov',
  },
];

const NAV_ITEMS: [string, string][] = [
  ['home', 'Home'],
  ['terminology', 'Terminology'],
  ['foundations', 'Foundations'],
  ['trading', 'Trading'],
  ['retirement', 'Retirement'],
  ['taxes', 'Taxes'],
  ['risk', 'Risk'],
  ['scams', 'Scams'],
  ['resources', 'Resources'],
];

function App() {
  const [activeSection, setActiveSection] = useState<string>('home');
  const [deepDiveSlug, setDeepDiveSlug] = useState<string | null>(null);
  const [termFilter, setTermFilter] = useState<TermCategory | 'All'>('All');
  const [termQuery, setTermQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const filteredTerms = useMemo(() => {
    const q = termQuery.trim().toLowerCase();
    return TERMS.filter((t) => {
      const matchCat = termFilter === 'All' || t.category === termFilter;
      const matchName = q === '' || t.name.toLowerCase().includes(q);
      return matchCat && matchName;
    });
  }, [termFilter, termQuery]);

  const handleNav = (id: string) => {
    setActiveSection(id);
    setDeepDiveSlug(null);
    setMobileMenuOpen(false);
  };

  const handleBack = () => setDeepDiveSlug(null);

  const deepDive = deepDiveSlug ? DEEP_DIVES[deepDiveSlug] : null;

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-logo">
          <div className="logo-mark" />
          <div className="logo-text">
            <span className="logo-title">The Trading Circle</span>
            <span className="logo-subtitle">Education Hub</span>
          </div>
        </div>

        <button
          type="button"
          className="nav-toggle"
          aria-label="Open menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((o) => !o)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>

        <nav className={`app-nav ${mobileMenuOpen ? 'app-nav-open' : ''}`}>
          {NAV_ITEMS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`nav-link ${activeSection === id && !deepDiveSlug ? 'nav-link-active' : ''}`}
              onClick={() => handleNav(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {deepDive ? (
          <div className="deep-dive-page">
            <button type="button" className="deep-dive-back" onClick={handleBack}>
              ← Back
            </button>
            <div className="deep-dive-inner">
              <h1 className="deep-dive-title">{deepDive.title}</h1>
              <div className="deep-dive-content">
                {typeof deepDive.content === 'string' ? (
                  <p>{deepDive.content}</p>
                ) : (
                  <>
                    {deepDive.content.paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                    {deepDive.content.bullets && (
                      <ul>
                        {deepDive.content.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeSection === 'home' && (
              <section id="home" className="section home-wrap">
                <div className="hero-center">
                  <span className="eyebrow">For people who actually want to learn.</span>
                  <h1 className="hero-title">Trading education without the sales pitch.</h1>
                  <p className="hero-desc">
                    One place to learn how markets work, what people mean when they talk about
                    trades, and what the real risks look like — without being pushed into a course
                    or signal group.
                  </p>
                  <div className="hero-btns">
                    <button type="button" className="btn btn-primary" onClick={() => handleNav('foundations')}>
                      Start with the basics
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => handleNav('terminology')}>
                      Browse all terms
                    </button>
                  </div>
                  <p className="hero-disclaimer">
                    Nothing here is advice or a promise of results. You&apos;re still in charge of
                    your own decisions and risk.
                  </p>
                </div>
                <div className="path-cards">
                  <div className="path-card" onClick={() => handleNav('foundations')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleNav('foundations')}>
                    <h3>I&apos;m brand new</h3>
                    <p>How markets work, what you can trade, and basic terminology.</p>
                  </div>
                  <div className="path-card" onClick={() => handleNav('trading')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleNav('trading')}>
                    <h3>I already trade</h3>
                    <p>Instruments, account types, and how to size risk so you stop winging it.</p>
                  </div>
                  <div className="path-card" onClick={() => handleNav('scams')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleNav('scams')}>
                    <h3>I want the truth</h3>
                    <p>Why most traders lose, fake gurus, and how to evaluate what you see online.</p>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'terminology' && (
              <section id="terminology" className="section">
                <div className="section-header">
                  <h2>Terminology</h2>
                  <p>Search by term name only. Gold for the term, white for the definition.</p>
                </div>
                <div className="glossary-controls">
                  <div className="glossary-search-left">
                    <input
                      type="search"
                      placeholder="Search term names…"
                      value={termQuery}
                      onChange={(e) => setTermQuery(e.target.value)}
                      aria-label="Search terms"
                    />
                  </div>
                  <div className="glossary-filters-right">
                    {TERM_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`pill ${termFilter === cat ? 'pill-active' : ''}`}
                        onClick={() => setTermFilter(cat as TermCategory | 'All')}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="terminology-list">
                  {filteredTerms.map((term) => (
                    <article key={term.id} className="term-row">
                      <div className="term-row-header">
                        <span className="term-name">{term.name}</span>
                        <span className="badge">{term.category}</span>
                      </div>
                      <p className="term-definition">{term.definition}</p>
                    </article>
                  ))}
                  {filteredTerms.length === 0 && (
                    <p className="empty-state">No terms match your search. Try a different filter or query.</p>
                  )}
                </div>
              </section>
            )}

            {activeSection === 'foundations' && (
              <section id="foundations" className="section section-doc">
                <div className="section-header">
                  <h2>Foundations</h2>
                  <p>Why markets exist, who participates, and how price actually moves. Start here if you&apos;re new.</p>
                </div>
                <div className="doc-layout">
                  <aside className="doc-sidebar">
                    <p className="doc-sidebar-label">Jump to</p>
                    <a href="#why-markets" className="doc-sidebar-link">Why markets exist</a>
                    <a href="#participants" className="doc-sidebar-link">Participants</a>
                    <a href="#sessions" className="doc-sidebar-link">Market hours & sessions</a>
                    <a href="#order-flow" className="doc-sidebar-link">Order flow & price</a>
                  </aside>
                  <div className="doc-body">
                    <h3 id="why-markets">Why markets exist</h3>
                    <p>
                      Markets exist for two core reasons: price discovery and risk transfer. Every
                      trade is somebody trying to learn what something is worth or move risk from
                      one party to another. Speculation is a byproduct — participants willing to take
                      the other side provided liquidity. Without them, hedgers wouldn&apos;t have
                      counterparties.
                    </p>
                    <h3 id="participants">The four core participants</h3>
                    <ul>
                      <li><strong>Hedgers</strong> — Businesses and institutions reducing real-world risk (airlines, farmers, funds). They&apos;re not trying to profit from price movement; they&apos;re protecting against it.</li>
                      <li><strong>Speculators</strong> — Traders taking risk for potential profit. They provide liquidity and help markets price in information.</li>
                      <li><strong>Market makers</strong> — Firms quoting buy and sell prices continuously. They earn the spread and take inventory risk.</li>
                      <li><strong>Arbitrageurs</strong> — Exploiting price differences between related markets, pushing prices toward fair value.</li>
                    </ul>
                    <h3 id="sessions">Market hours & sessions</h3>
                    <ul>
                      <li><strong>Pre-market</strong> 4:00 AM – 9:30 AM ET — Thin liquidity, wider spreads. News and earnings often hit here. Many brokers limit order types.</li>
                      <li><strong>Regular session (RTH)</strong> 9:30 AM – 4:00 PM ET — Main session. Highest liquidity. The open and close are typically the most active and volatile.</li>
                      <li><strong>After-hours</strong> 4:00 PM – 8:00 PM ET — Similar to pre-market. Prices after-hours don&apos;t always reflect the next day&apos;s open.</li>
                      <li><strong>Futures</strong> — Nearly 24/7 (Sun 6PM – Fri 5PM ET). Overnight reflects global news; margin can differ.</li>
                    </ul>
                    <p className="muted">
                      Volatility at the open and close isn&apos;t random — it reflects institutional
                      order flow, index rebalancing, and options activity. New traders often mistake
                      the morning spike for a trend and get caught on the wrong side.
                    </p>
                    <h3 id="order-flow">Order flow & price discovery</h3>
                    <p>
                      Price isn&apos;t set by a central authority. It comes from the continuous
                      interaction of buy and sell orders. The order book has buyers (bid) and
                      sellers (ask). The gap is the spread. When buy orders overwhelm sellers at a
                      level, price moves up to find more sellers — and vice versa. That&apos;s
                      supply and demand in direct form.
                    </p>
                    <p>What actually moves price:</p>
                    <ul>
                      <li>Earnings, guidance, analyst revisions</li>
                      <li>Macro data (inflation, employment, GDP, rates)</li>
                      <li>Central bank policy and forward guidance</li>
                      <li>Geopolitical events and risk-off / risk-on shifts</li>
                      <li>Technical levels where institutional orders cluster</li>
                      <li>Options activity (gamma near expiration), index rebalancing, ETF flows</li>
                      <li>Sentiment and positioning extremes</li>
                    </ul>
                    <p className="muted">
                      Most price movement is not driven by retail. Institutions move markets. Retail
                      traders either read that flow or they don&apos;t.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'trading' && (
              <section id="trading" className="section">
                <div className="section-header">
                  <h2>Trading</h2>
                  <p>Instruments and account types. Each market has its own mechanics and rules.</p>
                </div>
                <div className="grid two-col">
                  <article className="card">
                    <h3>Stocks (equities)</h3>
                    <p>
                      A share is fractional ownership in a company. You own a piece of assets,
                      earnings, and growth. Prices reflect the market&apos;s view of current and
                      future value — earnings, guidance, macro, sentiment. Big moves come from
                      earnings beats/misses, revenue growth, product news, sector rotation, analyst
                      moves, and macro data. Liquidity varies: names like AAPL or MSFT trade
                      billions per day; micro-caps can move on small order flow. Wider spreads and
                      low liquidity compound risk.
                    </p>
                  </article>
                  <article className="card">
                    <h3>Options</h3>
                    <p>
                      Options are derivatives — value comes from an underlying stock, ETF, or index.
                      Three forces affect price at once: direction, time left, and implied
                      volatility. A stock can move your way and the option can still lose (time
                      decay, IV crush). Buying cheap OTM options, ignoring spreads, holding through
                      earnings, and selling options without understanding assignment are common
                      beginner mistakes.
                    </p>
                    <button type="button" className="link-gold" onClick={() => setDeepDiveSlug('greeks')}>
                      Learn more: The Greeks →
                    </button>
                  </article>
                  <article className="card">
                    <h3>Futures</h3>
                    <p>
                      Contracts to buy or sell an asset at a set price on a future date. Most
                      traders never take delivery — they trade the move and close before expiration.
                      Exposure is created by posting margin; leverage is built in. One ES at 5,000
                      controls $250,000 notional; margin might be ~$12–15k. Every point is $50
                      P&L. Not knowing tick value, trading too large, and ignoring overnight margin
                      lead to blow-ups.
                    </p>
                  </article>
                  <article className="card">
                    <h3>Forex & crypto</h3>
                    <p>
                      Forex: you&apos;re always betting on one currency against another. Driven by
                      rates, inflation, central banks. Very high leverage is common — small moves
                      have large account impact. Spreads can blow out on news. Crypto trades 24/7;
                      no open, close, or halts. Liquidity varies by asset; altcoins can gap 20–30%
                      on thin volume. Perpetual futures use funding rates; leverage can be extreme.
                    </p>
                  </article>
                </div>
                <div className="section-header">
                  <h2>Account types</h2>
                </div>
                <article className="card">
                  <h3>Cash vs margin</h3>
                  <p>
                    <strong>Cash:</strong> You only trade with money you&apos;ve deposited. No
                    borrowing. Stock trades settle T+1 (trade date plus one business day). Using
                    unsettled funds to trade can cause good faith violations. Cash accounts are not
                    subject to the Pattern Day Trader rule — but settlement still limits how fast
                    you can recycle capital. You cannot short sell or write naked options.
                  </p>
                  <p>
                    <strong>Margin:</strong> You can borrow from the broker — typically up to 2:1
                    overnight and up to 4:1 intraday (day trading buying power). The broker charges
                    interest on borrowed funds. Margin unlocks short selling and more options
                    strategies. The old fixed $25,000 PDT gate is being replaced by new intraday
                    margin standards (effective 45 days after FINRA publishes its Regulatory Notice,
                    with phased broker rollout afterward), so check your broker's current policy.
                  </p>
                  <button type="button" className="link-gold" onClick={() => setDeepDiveSlug('pdt-rule')}>
                    Learn more: PDT rule →
                  </button>
                </article>
                <article className="card">
                  <h3>Futures & funded accounts</h3>
                  <p>
                    Futures accounts are separate from equity accounts; regulated by CFTC/NFA, not
                    FINRA — so PDT doesn&apos;t apply. You need enough capital for initial margin
                    plus a buffer. Funded (prop) programs give you access to larger size after
                    passing an evaluation; you keep a share of profits. Many firms make most of
                    their revenue from challenge fees, not your trading. Drawdown rules are often
                    tight; payouts and reliability vary. Research any firm thoroughly before
                    paying.
                  </p>
                </article>
              </section>
            )}

            {activeSection === 'retirement' && (
              <section id="retirement" className="section">
                <div className="section-header">
                  <h2>Retirement accounts</h2>
                  <p>
                    Contribution limits and income thresholds change every year. Always verify
                    current limits at <a href="https://www.irs.gov" target="_blank" rel="noopener noreferrer" className="link-gold">IRS.gov</a> before contributing.
                  </p>
                </div>
                <article className="card">
                  <h3>Roth IRA</h3>
                  <p>
                    Funded with after-tax dollars. Growth is tax-free and qualified withdrawals in
                    retirement are tax-free. You can withdraw contributions (not earnings) anytime
                    without penalty. No RMDs during your lifetime. Best when you&apos;re in a lower
                    tax bracket now than you expect in retirement — you pay tax at today&apos;s
                    rate and shelter growth forever. Income limits apply; high earners may not be
                    able to contribute directly.
                  </p>
                  <p className="muted">
                    As of 2025: contribution limit $7,000 ($8,000 if 50+). Limits change annually —
                    confirm at IRS.gov.
                  </p>
                </article>
                <article className="card">
                  <h3>Traditional IRA</h3>
                  <p>
                    Funded with pre-tax dollars; contributions may be tax-deductible depending on
                    income and whether you have a workplace plan. Growth is tax-deferred. Withdrawals
                    in retirement are taxed as ordinary income. RMDs start at age 73. Early
                    withdrawals before 59½ typically incur a 10% penalty plus income tax. Best when
                    you&apos;re in a high bracket now and expect a lower one in retirement.
                  </p>
                </article>
                <article className="card">
                  <h3>401(k)</h3>
                  <p>
                    Employer-sponsored; contributions via payroll. Much higher contribution limits
                    than IRAs — verify current limits at IRS.gov. Employer match is separate. If
                    your employer matches 50% up to 6% of salary and you don&apos;t contribute at
                    least 6%, you&apos;re leaving free money on the table. Traditional 401(k) is
                    pre-tax, taxable in retirement; Roth 401(k) is after-tax, tax-free qualified
                    withdrawals. RMDs apply at 73. Employer contributions may vest over time — check
                    your plan before changing jobs.
                  </p>
                </article>
                <p className="muted">
                  General order of operations for many people: (1) Capture full 401(k) match, (2)
                  Max Roth IRA if eligible, (3) Max 401(k) if budget allows, (4) Taxable brokerage.
                  This is general structure, not personalized advice. A tax professional or
                  fee-only advisor can help model your situation.
                </p>
              </section>
            )}

            {activeSection === 'taxes' && (
              <section id="taxes" className="section">
                <div className="section-header">
                  <h2>Tax basics</h2>
                  <p>
                    This is general education — not tax advice. Rules change and your situation
                    matters. When in doubt, talk to a qualified tax professional or CPA.
                  </p>
                </div>
                <div className="card card-notice">
                  <p>
                    <strong>Not tax advice.</strong> This is general education. Tax rules change.
                    If you&apos;re unsure about your obligations, consult a qualified tax
                    professional. Do not make decisions based solely on this section.
                  </p>
                </div>
                <article className="card">
                  <h3>Capital gains — short vs long term</h3>
                  <p>
                    <strong>Short-term:</strong> Asset held one year or less. Taxed as ordinary
                    income at your marginal rate. For active traders, most gains are short-term.
                  </p>
                  <p>
                    <strong>Long-term:</strong> Held more than one year. Taxed at preferential
                    rates (0%, 15%, or 20% depending on income). Verify current brackets at
                    IRS.gov.
                  </p>
                </article>
                <article className="card">
                  <h3>Losses, wash sales, carryforwards</h3>
                  <p>
                    Losses offset gains dollar-for-dollar. If losses exceed gains, you can deduct
                    up to $3,000 of net losses against ordinary income per year ($1,500 if
                    married filing separately). Excess carries forward to future years.
                  </p>
                  <button type="button" className="link-gold" onClick={() => setDeepDiveSlug('wash-sale')}>
                    Learn more: Wash sale rule →
                  </button>
                </article>
                <article className="card">
                  <h3>Section 1256 & the 60/40 rule</h3>
                  <p>
                    Regulated futures and certain index options get special treatment: 60% of
                    gains/losses are treated as long-term and 40% as short-term, regardless of
                    holding period. Section 1256 positions are marked to market at year-end.
                  </p>
                  <button type="button" className="link-gold" onClick={() => setDeepDiveSlug('section-1256')}>
                    Learn more: Section 1256 →
                  </button>
                </article>
                <article className="card">
                  <h3>Key forms</h3>
                  <ul>
                    <li><strong>Form 8949</strong> — Individual sales of capital assets. Totals flow to Schedule D.</li>
                    <li><strong>Schedule D</strong> — Summarizes gains/losses, applies the $3,000 loss limit, carryovers.</li>
                    <li><strong>Form 6781</strong> — Section 1256 gains and losses; 60/40 calculated here.</li>
                    <li><strong>1099-B</strong> — Broker summary of trades; starting point for 8949. Review it — not always 100% accurate.</li>
                  </ul>
                </article>
              </section>
            )}

            {activeSection === 'risk' && (
              <section id="risk" className="section">
                <div className="section-header">
                  <h2>Risk & psychology</h2>
                  <p>
                    Most traders don&apos;t fail because of a bad strategy. They fail because
                    psychology leads to bad execution or because they take risks their account
                    can&apos;t survive.
                  </p>
                </div>
                <div className="grid two-col">
                  <article className="card">
                    <h3>Why trading is mentally hard</h3>
                    <p>
                      Feedback is immediate and emotional — right or wrong in real time, in
                      dollars. Your brain processes it like physical threat or reward. Humans want
                      pattern, certainty, and loss aversion. Markets offer uncertainty and losses.
                      You can do the same setup ten times and get different outcomes. That&apos;s
                      probability, not a broken strategy. Accepting that intellectually is easy;
                      feeling it with real money is not.
                    </p>
                  </article>
                  <article className="card">
                    <h3>FOMO, greed, revenge</h3>
                    <p>
                      FOMO feels like urgency: &quot;I can still get in.&quot; Usually you&apos;re
                      late and without a plan. Greed shows up as moving your profit target instead
                      of exiting. Revenge trading is trying to get it back immediately after a loss
                      — rules break, size goes up, quality drops. If you feel emotional, you&apos;re
                      done for the session.
                    </p>
                  </article>
                  <article className="card">
                    <h3>Position size as psychology</h3>
                    <p>
                      Most psychological problems come down to size. Too large and normal price
                      action feels threatening; you hesitate, move stops, react instead of think.
                      Good sizing gives you room to think. If a trade moving against you doesn&apos;t
                      spike your heart rate, size is probably appropriate. Your size should be
                      small enough that you can execute your plan calmly when the trade is going
                      against you.
                    </p>
                  </article>
                  <article className="card">
                    <h3>What discipline actually looks like</h3>
                    <p>
                      Discipline isn&apos;t motivation. It&apos;s doing the boring, correct thing
                      when the emotional thing feels better. Sitting out when there&apos;s no clean
                      setup. Taking the stop at your level without arguing. Ending the session after
                      a bad day instead of chasing. Passing on the &quot;almost&quot; setup.
                      Accepting red days as normal. Most people know what they should do; the
                      difference is who does it consistently when it&apos;s uncomfortable.
                    </p>
                  </article>
                </div>
              </section>
            )}

            {activeSection === 'scams' && (
              <section id="scams" className="section">
                <div className="section-header">
                  <h2>Scams & reality</h2>
                  <p>
                    Trading is heavily marketed. The people doing the marketing are often selling
                    something. Understanding the landscape protects you from wasting money and
                    time.
                  </p>
                </div>
                <article className="card">
                  <h3>The real loss statistics</h3>
                  <p>
                    Academic and brokerage studies consistently show that the majority of retail
                    traders lose money over multi-year periods — often in the 70–80% range. That
                    doesn&apos;t mean trading is impossible. It means it&apos;s competitive and
                    hard. Edge is real but finite; costs add up; most people underestimate what it
                    takes. Losses are often structural: transaction costs, poor position sizing,
                    and psychological errors that turn good ideas into bad execution.
                  </p>
                </article>
                <article className="card">
                  <h3>Fake gurus and lifestyle marketing</h3>
                  <p>
                    A lot of trading content online isn&apos;t education — it&apos;s marketing.
                    The product is a course, a Discord, a signal service, or ad revenue. You see
                    wealth displays, vague performance claims, P&L screenshots with no context on
                    losses or win rate, urgency (&quot;limited spots,&quot; &quot;price going
                    up&quot;), and testimonials. The pitch appeals to real desires: financial
                    freedom, independence. The reality: professional traders make money trading.
                    When someone&apos;s business model is selling you education, they have an
                    incentive to make it seem more accessible than it is.
                  </p>
                </article>
                <article className="card">
                  <h3>Signal services and fake edges</h3>
                  <p>
                    Win rate is shown; risk-to-reward and actual dollar outcomes often aren&apos;t.
                    Winning trades get highlighted; losing ones get skipped. By the time you get
                    an alert and act, the entry may be gone. No signals survive forever — when a
                    strategy stops working, subscriptions drop. Following signals builds zero
                    skill and ties you to someone else&apos;s judgment.
                  </p>
                </article>
                <article className="card">
                  <h3>ICT and similar frameworks</h3>
                  <p>
                    Some frameworks (e.g. Inner Circle Trader) use specific vocabulary around
                    institutional order flow, smart money, and liquidity. Some concepts have basis
                    in market microstructure; others are unfalsifiable — they can explain any
                    move in hindsight without generating reliable predictions. The test for any
                    method is whether it produces verifiable, forward-looking results over a
                    meaningful sample. Hindsight chart analysis proves nothing.
                  </p>
                </article>
                <article className="card">
                  <h3>What real edge looks like</h3>
                  <p>
                    Edge isn&apos;t a pattern that always works. It&apos;s a statistical advantage
                    over a large sample. Even the best strategies have losing periods. Real edge
                    comes from execution advantages, behavioral consistency, risk management that
                    lets you survive drawdowns, and actually understanding what you&apos;re
                    trading. More data subscriptions and fancier tools don&apos;t create edge —
                    they create the appearance of activity. The gap between what most retail
                    traders do and what works is in execution, risk, and understanding — not in
                    the number of indicators.
                  </p>
                </article>
                <article className="card">
                  <h3>How to evaluate information</h3>
                  <ul>
                    <li>Is the performance claim audited or verified by a third party?</li>
                    <li>Are losses shown with context on drawdown and win rate?</li>
                    <li>Does the person trade their own method with their own money?</li>
                    <li>Is the business model teaching or trading?</li>
                    <li>Can the method generate predictions in advance, or only explain in hindsight?</li>
                    <li>What&apos;s the sample size behind the claimed results?</li>
                    <li>Are the rules specific enough to be tested, or vague enough to fit anything?</li>
                  </ul>
                </article>
              </section>
            )}

            {activeSection === 'resources' && (
              <section id="resources" className="section">
                <div className="section-header">
                  <h2>Resources</h2>
                  <p>
                    Example of the kind of content we&apos;ll link here — genuinely educational,
                    no course pitch. More videos and tools will be added over time.
                  </p>
                </div>
                <div className="grid three-col">
                  {SAMPLE_RESOURCES.map((res) => (
                    <article key={res.id} className="card resource-card">
                      <p className="badge badge-subtle">{res.type}</p>
                      <h3>{res.title}</h3>
                      <p>{res.blurb}</p>
                      <span className="btn btn-light">{res.linkLabel}</span>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Educational use only. Nothing on this site is financial, legal, or tax advice. You are
          responsible for your own decisions and risk. Tax rules and contribution limits change —
          verify current figures with authoritative sources before acting.
        </p>
        <p className="muted">© {new Date().getFullYear()} The Trading Circle · Education Hub</p>
      </footer>
    </div>
  );
}

export default App;
