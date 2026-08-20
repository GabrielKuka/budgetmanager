import { useEffect, useId, useState } from "react";
import "./workspace.scss";

export function useMediaQuery(query) {
  const getMatches = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(query);
    const update = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);

  return matches;
}

export function WorkspaceShell({
  as: Element = "main",
  className = "",
  children,
}) {
  return (
    <Element className={`workspace-shell ${className}`.trim()}>
      {children}
    </Element>
  );
}

export function WorkspaceHero({
  eyebrow,
  title,
  description,
  metrics,
  actions,
  children,
  className = "",
}) {
  return (
    <header className={`workspace-hero ${className}`.trim()}>
      <div className="workspace-hero__copy">
        {eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {metrics && <div className="workspace-hero__metrics">{metrics}</div>}
      {actions && <div className="workspace-hero__actions">{actions}</div>}
      {children}
    </header>
  );
}

export function Surface({
  as: Element = "section",
  className = "",
  children,
  ...props
}) {
  return (
    <Element className={`workspace-surface ${className}`.trim()} {...props}>
      {children}
    </Element>
  );
}

export function MetricCard({ label, value, detail, tone = "default" }) {
  return (
    <div className={`workspace-metric workspace-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function SegmentedControl({
  label,
  value,
  options,
  onChange,
  className = "",
}) {
  return (
    <div
      className={`workspace-segments ${className}`.trim()}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={value === option.value ? "is-active" : ""}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function InsightsPanel({
  className = "",
  storageKey = "workspace-insights-open",
  title = "Insights",
  children,
}) {
  const contentId = useId();
  const isPhone = useMediaQuery("(max-width: 640px)");
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(open));
    } catch {}
  }, [open, storageKey]);
  return (
    <aside
      className={`workspace-insights ${
        open ? "is-open" : ""
      } ${className}`.trim()}
    >
      <button
        type="button"
        className="workspace-insights__toggle"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
      >
        <span>
          <b>{title}</b>
          <small>Charts and period breakdowns</small>
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {(!isPhone || open) && (
        <div id={contentId} className="workspace-insights__content">
          {children}
        </div>
      )}
    </aside>
  );
}

export function ChartCard({
  title,
  subtitle,
  summary,
  className = "",
  children,
}) {
  return (
    <Surface
      className={`workspace-chart ${className}`.trim()}
      aria-label={title}
    >
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {summary && <strong>{summary}</strong>}
      </header>
      <div className="workspace-chart__body">{children}</div>
    </Surface>
  );
}

export function StatusBadge({ children, tone = "neutral" }) {
  return (
    <span className={`workspace-badge workspace-badge--${tone}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <Surface className="workspace-empty">
      <span aria-hidden="true">○</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </Surface>
  );
}
