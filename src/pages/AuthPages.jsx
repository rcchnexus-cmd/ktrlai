import { useEffect, useState } from "react";
import Logo from "../components/Logo.jsx";
import { RouteLink, useNavigation } from "../navigation.jsx";
import { useApp } from "../context/AppContext.jsx";

const INTENDED_ROUTE_KEY = "ktrlai_intended_route";

function getRedirectTarget(fallback = "/dashboard") {
  const intendedRoute = window.localStorage.getItem(INTENDED_ROUTE_KEY);
  window.localStorage.removeItem(INTENDED_ROUTE_KEY);
  return intendedRoute && intendedRoute.startsWith("/") && !["/login", "/signup", "/forgot-password"].includes(intendedRoute)
    ? intendedRoute
    : fallback;
}

function AuthFrame({ mode, title, subtitle, children, footer }) {
  return (
    <main className="authPage">
      <section className="authVisual">
        <Logo linked={false} />
        <div>
          <span className="eyebrow">KtrlAI secure access</span>
          <h1>Govern AI access before it becomes invisible infrastructure.</h1>
          <p>
            Monitor traffic, control model permissions, and create new commercial rules for AI systems using your work.
          </p>
        </div>
      </section>
      <section className="authPanel" aria-labelledby={`${mode}-title`}>
        <Logo />
        <div>
          <h2 id={`${mode}-title`}>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {children}
        <p className="authFooter">{footer}</p>
      </section>
    </main>
  );
}

export function Login() {
  const { state, actions } = useApp();
  const { navigate } = useNavigation();
  const [error, setError] = useState("");

  useEffect(() => {
    if (state.auth.isAuthenticated) {
      navigate(getRedirectTarget());
    }
  }, [navigate, state.auth.isAuthenticated]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      actions.login({
        email: formData.get("email"),
        password: formData.get("password")
      });
      navigate(getRedirectTarget());
    } catch (authError) {
      setError(authError.message);
    }
  };

  return (
    <AuthFrame
      mode="login"
      title="Welcome back"
      subtitle="Sign in to continue managing AI access across your domains."
      footer={
        <>
          New to KtrlAI? <RouteLink to="/signup">Create an account</RouteLink>
        </>
      }
    >
      <form className="authForm" onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" name="email" placeholder="avery@company.com" autoComplete="email" />
        </label>
        <label>
          Password
          <input type="password" name="password" placeholder="********" autoComplete="current-password" />
        </label>
        {error && <p className="authError">{error}</p>}
        <div className="formRow">
          <label className="checkLabel">
            <input type="checkbox" /> Remember me
          </label>
          <RouteLink to="/forgot-password">Forgot password?</RouteLink>
        </div>
        <button type="submit" className="primaryButton fullButton">
          Log in
        </button>
      </form>
    </AuthFrame>
  );
}

export function Signup() {
  const { state, actions } = useApp();
  const { navigate } = useNavigation();
  const [error, setError] = useState("");

  useEffect(() => {
    if (state.auth.isAuthenticated) {
      navigate("/dashboard");
    }
  }, [navigate, state.auth.isAuthenticated]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      actions.signup({
        email: formData.get("email"),
        password: formData.get("password")
      });
      navigate("/dashboard");
    } catch (authError) {
      setError(authError.message);
    }
  };

  return (
    <AuthFrame
      mode="signup"
      title="Create your control layer"
      subtitle="Start with visibility, then add control and monetization when ready."
      footer={
        <>
          Already have an account? <RouteLink to="/login">Log in</RouteLink>
        </>
      }
    >
      <form className="authForm" onSubmit={handleSubmit}>
        <label>
          Work email
          <input type="email" name="email" placeholder="you@company.com" autoComplete="email" />
        </label>
        <label>
          Company domain
          <input type="text" name="domain" placeholder="company.com" autoComplete="organization" />
        </label>
        <label>
          Password
          <input type="password" name="password" placeholder="Create a password" autoComplete="new-password" />
        </label>
        {error && <p className="authError">{error}</p>}
        <button type="submit" className="primaryButton fullButton">
          Start free
        </button>
      </form>
    </AuthFrame>
  );
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false);

  return (
    <AuthFrame
      mode="forgot"
      title="Reset your password"
      subtitle="Enter your email and we will send a secure reset link."
      footer={
        <>
          Remembered it? <RouteLink to="/login">Back to login</RouteLink>
        </>
      }
    >
      <form className="authForm" onSubmit={(event) => event.preventDefault()}>
        <label>
          Email
          <input type="email" placeholder="avery@company.com" />
        </label>
        <button type="button" className="primaryButton fullButton" onClick={() => setSent(true)}>
          {sent ? "Reset link sent" : "Send reset link"}
        </button>
        {sent && <p className="formHint">Check your inbox for a secure reset link.</p>}
      </form>
    </AuthFrame>
  );
}
