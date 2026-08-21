import { Field } from "formik";
import "./auth.scss";

export function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <main className="auth-page">
      <section className="auth-page__hero" aria-label="BudgetManager overview">
        <div className="auth-page__hero-overlay" />
        <div className="auth-page__hero-content">
          <p className="auth-page__kicker">BudgetManager</p>
          <h1>Clarity for every euro. Confidence for every decision.</h1>
          <p>
            Build a complete picture of your money and make your next move with
            intention.
          </p>
          <ul
            className="auth-page__benefits"
            aria-label="BudgetManager features"
          >
            <li>Spending in focus</li>
            <li>Accounts in one place</li>
            <li>Wealth over time</li>
          </ul>
        </div>
      </section>
      <section className="auth-page__form-panel">
        <div className="auth-card">
          <div className="auth-card__heading">
            <p className="auth-card__eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

export function TextField({ name, label, type = "text", autoComplete, error }) {
  const errorId = `${name}-error`;
  return (
    <div className="auth-field">
      <label htmlFor={name}>{label}</label>
      <Field
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="auth-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordField({ showPassword, onToggle, autoComplete, error }) {
  const errorId = "password-error";
  return (
    <div className="auth-field">
      <label htmlFor="password">Password</label>
      <div className="auth-field__password">
        <Field
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <button
          type="button"
          className="auth-field__password-toggle"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          onClick={onToggle}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      {error && (
        <p id={errorId} className="auth-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ loading, children }) {
  return (
    <button className="auth-submit" type="submit" disabled={loading}>
      {loading && <span className="auth-submit__spinner" aria-hidden="true" />}
      {loading ? "Please wait…" : children}
    </button>
  );
}
