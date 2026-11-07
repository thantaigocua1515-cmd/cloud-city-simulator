import { ECONOMY, stats, type City } from "../simulation/city";
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
export function EconomyHUD({
  city,
  onExplain,
}: {
  city: City | null;
  onExplain: () => void;
}) {
  const summary = city ? stats(city) : null;
  return (
    <div className="resources" aria-label="City resources">
      <div>
        <span className="resource-icon coin" aria-hidden="true">
          ◈
        </span>
        <span>
          <strong data-testid="credits">
            {city?.credits.toLocaleString() ?? "—"}
          </strong>
          <small>Cloud Coins · +{summary?.income ?? 0}/10s</small>
          <small>Cap {ECONOMY.caps.credits.toLocaleString()}</small>
        </span>
      </div>
      <div>
        <span className="resource-icon" aria-hidden="true">
          ♧
        </span>
        <span>
          <strong data-testid="wood">
            {city?.materials.wood ?? "—"}
            <em> / {ECONOMY.caps.wood}</em>
          </strong>
          <small>Wood · {signed(summary?.net.wood ?? 0)}/10s</small>
        </span>
      </div>
      <div>
        <span className="resource-icon crystal-icon" aria-hidden="true">
          ◇
        </span>
        <span>
          <strong data-testid="crystal">
            {city?.materials.crystal ?? "—"}
            <em> / {ECONOMY.caps.crystal}</em>
          </strong>
          <small>Sky Crystal · {signed(summary?.net.crystal ?? 0)}/10s</small>
        </span>
      </div>
      <div className={summary?.shortage ? "shortage" : ""}>
        <span className="resource-icon" aria-hidden="true">
          ϟ
        </span>
        <span>
          <strong data-testid="energy">
            {summary?.generated ?? 0}
            <em> / {summary?.demand ?? 0}</em>
          </strong>
          <small>Power · supply / demand</small>
          <small data-testid="power-status">
            {summary?.shortage ? "SHORTAGE · consumers stopped" : "Grid stable"}
          </small>
        </span>
      </div>
      <div>
        <span className="resource-icon" aria-hidden="true">
          ♙
        </span>
        <span>
          <strong data-testid="population">
            {city?.population ?? 0}
            <em> / {summary?.capacity ?? 0}</em>
          </strong>
          <small>Residents · +{summary?.growth ?? 0}/10s</small>
        </span>
      </div>
      <div>
        <button
          className="happiness-button"
          aria-label="Explain city economy and happiness"
          onClick={onExplain}
        >
          <strong data-testid="happiness">{summary?.happiness ?? 0}%</strong>
          <small>Happiness ⓘ</small>
        </button>
      </div>
    </div>
  );
}
export function EconomyDetails({
  city,
  onClose,
}: {
  city: City;
  onClose: () => void;
}) {
  const s = stats(city);
  return (
    <section className="economy-panel" aria-label="City economy explanation">
      <button
        className="close"
        aria-label="Close economy explanation"
        onClick={onClose}
      >
        ×
      </button>
      <span className="eyebrow">LIVING SKY CITY</span>
      <h2>What keeps your city happy?</h2>
      <ul>
        {s.reasons.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <strong>{signed(r.value)}</strong>
          </li>
        ))}
      </ul>
      <p>
        <strong>{s.happiness}% happiness.</strong> At least 60% and enough power
        allow up to 2 new residents per tick, within housing capacity. Below
        60%, each active building earns half its normal coins (rounded down).
      </p>
      <p>
        <strong>
          Power: {s.generated} supply / {s.demand} demand.
        </strong>{" "}
        {s.shortage
          ? "Shortage: all power consumers pause, including plazas. Add wind power or fuel a plant."
          : "The grid can serve every consumer."}
      </p>
      <p>
        {s.pausedBuildings} paused buildings · {s.fuelStarved.length} missing
        inputs. Plants reserve 1 crystal each first; harvesters then consume 1
        wood each, in building ID order. New materials arrive at tick end.
      </p>
      <p>
        Next tick: +{s.income} coins; Wood {signed(s.net.wood)}, Sky Crystal{" "}
        {signed(s.net.crystal)} after storage caps. Removal refunds half of coin
        and material costs; residents relocate if housing is removed.
      </p>
    </section>
  );
}
