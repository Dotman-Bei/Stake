import Link from "next/link";
import {
  Outcome, STATUS_LABEL, TYPE_CODE, TYPE_LABEL, barsFor, marketStatus, settledPayout, toneFor, total, yesPercent,
  type Market, type Status,
} from "@/lib/markets";
import { bot, initials, multiple, pct, timeLeft } from "@/lib/format";
import { imageFor } from "@/lib/marketImage";
import { ClockIcon, PoolIcon, StakeMark, UsersIcon } from "./Icons";

const AVATAR_FILLS = ["#384bff", "#006b52", "#6f63ff", "#7a3d18", "#111"];

/** Square market image, or the four-bar fallback when the market has none (frontend.md §6.5). */
export function MarketVisual({ market, large = false }: { market: Market; large?: boolean }) {
  const image = imageFor(market);
  if (image) {
    return (
      <div className={`market-visual${large ? " lg" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.src} alt={image.alt} loading="lazy" />
      </div>
    );
  }
  return <FallbackVisual market={market} large={large} />;
}

function FallbackVisual({ market, large = false }: { market: Market; large?: boolean }) {
  const bars = barsFor(`${market.id}:${market.question}`);
  return (
    <div className={`fallback-visual${large ? " lg" : ""}`} aria-hidden="true">
      <span className="code">{TYPE_CODE[market.marketType] ?? "MK"}</span>
      {bars.map((h, i) => <span key={i} className="bar" style={{ height: `${h}%` }} />)}
    </div>
  );
}

export function StatusTag({ status }: { status: Status }) {
  const cls = status === "live" || status === "resolved" ? "live" : status === "closed" ? "closed" : status === "invalid" ? "invalid" : "";
  return <span className={`tag ${cls}`}>{STATUS_LABEL[status]}</span>;
}

/** Left/right values of the signal row: the market's verdict as a fact, never advice. */
export function signalFor(m: Market, status: Status): { verdict: string; tone: "" | "warn" | "bad"; right: string } {
  const yes = yesPercent(m);
  if (status === "invalid") return { verdict: "REFUNDED", tone: "bad", right: "full refund" };
  if (status === "resolved") {
    const side = m.outcome === Outcome.Yes ? "YES" : "NO";
    const winPool = m.outcome === Outcome.Yes ? m.totalYes : m.totalNo;
    return { verdict: `RESOLVED ${side}`, tone: "", right: `${multiple(settledPayout(m, m.outcome, winPool), winPool)} winners` };
  }
  if (total(m) === 0n) return { verdict: status === "closed" ? "NO POSITIONS" : "OPEN", tone: status === "closed" ? "warn" : "", right: "no stakes yet" };
  if (status === "closed") return { verdict: "AWAITING RESULT", tone: "warn", right: `${pct(yes)} yes pool` };
  const verdict = yes > 50 ? "YES LEADS" : yes < 50 ? "NO LEADS" : "EVEN";
  return { verdict, tone: "", right: `${pct(yes)} yes pool` };
}

export function MarketCard({ market, now, participants, mySide }: {
  market: Market;
  now: number;
  participants: string[];
  mySide?: number;
}) {
  const status = now ? marketStatus(market, now) : market.outcome === Outcome.Unresolved ? "live" : marketStatus(market, market.closeTime);
  const signal = signalFor(market, status);
  const yes = yesPercent(market);
  const shown = participants.slice(0, 5);
  const predictors = market.yesCount + market.noCount;
  const image = imageFor(market);

  return (
    <article className="market-card">
      <div className="card-tags">
        <span className="tag">{TYPE_LABEL[market.marketType] ?? "Market"}</span>
        <StatusTag status={status} />
        {mySide ? <span className="tag live">You: {mySide === 1 ? "YES" : "NO"}</span> : null}
        <span className="tag id">#{market.id}</span>
      </div>

      <div className={`card-body tone-${toneFor(market.question)}`}>
        <MarketVisual market={market} />
        <h3 className="card-title">
          <Link href={`/market/${market.id}`}>{market.question}</Link>
        </h3>
        <div className="pool-meter" aria-label={`YES ${pct(yes)}, NO ${pct(100 - yes)}`}>
          <div className="label">Pool split</div>
          <div className="track">
            <span className="yes" style={{ width: `${total(market) ? yes : 0}%` }} />
            <span className="no" style={{ width: `${total(market) ? 100 - yes : 0}%` }} />
          </div>
          <div className="legend mono-num">
            <span>YES {bot(market.totalYes)}</span>
            <span>NO {bot(market.totalNo)}</span>
          </div>
        </div>
        <div className="participants">
          <div className="avatars">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar market-avatar" src={image.src} alt="" />
            ) : (
              <span className="avatar mark"><StakeMark /></span>
            )}
            {shown.map((a, i) => (
              <span key={a} className="avatar" style={{ background: AVATAR_FILLS[i % AVATAR_FILLS.length] }} title={a}>{initials(a)}</span>
            ))}
          </div>
          <span className="more">
            {predictors === 0 ? "No predictors yet" : predictors > shown.length ? `+${predictors - shown.length} more` : `${predictors} predictor${predictors === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>

      <div className="card-footer">
        <span className="card-fact" title="Total pool"><PoolIcon /><span className="mono-num">{bot(total(market))} BOT</span></span>
        <span className="card-fact" title={status === "upcoming" ? "Opens in" : "Time left"}>
          <ClockIcon />
          <span className="mono-num">{!now ? "—" : status === "upcoming" ? `in ${timeLeft(market.openTime, now)}` : timeLeft(market.closeTime, now)}</span>
        </span>
        <span className="card-fact" title="Predictors"><UsersIcon /><span className="mono-num">{predictors}</span></span>
      </div>

      <div className="card-signal">
        <span className={`verdict ${signal.tone}`}>{signal.verdict}</span>
        <span className="price">{signal.right}</span>
      </div>
    </article>
  );
}
