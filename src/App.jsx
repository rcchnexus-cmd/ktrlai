import { lazy, Suspense, useEffect } from "react";
import { useNavigation } from "./navigation.jsx";
import { useApp } from "./context/AppContext.jsx";

const INTENDED_ROUTE_KEY = "ktrlai_intended_route";

const Landing = lazy(() => import("./pages/Landing.jsx"));
const Login = lazy(() => import("./pages/AuthPages.jsx").then((module) => ({ default: module.Login })));
const Signup = lazy(() => import("./pages/AuthPages.jsx").then((module) => ({ default: module.Signup })));
const ForgotPassword = lazy(() => import("./pages/AuthPages.jsx").then((module) => ({ default: module.ForgotPassword })));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Activity = lazy(() => import("./pages/Activity.jsx"));
const ControlCenter = lazy(() => import("./pages/ControlCenter.jsx"));
const Visibility = lazy(() => import("./pages/Visibility.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const Monetization = lazy(() => import("./pages/Monetization.jsx"));
const Training = lazy(() => import("./pages/Training.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const Docs = lazy(() => import("./pages/Docs.jsx"));
const Help = lazy(() => import("./pages/Help.jsx"));
const Privacy = lazy(() => import("./pages/LegalPages.jsx").then((module) => ({ default: module.Privacy })));
const Terms = lazy(() => import("./pages/LegalPages.jsx").then((module) => ({ default: module.Terms })));
const Security = lazy(() => import("./pages/LegalPages.jsx").then((module) => ({ default: module.Security })));
const Contact = lazy(() => import("./pages/LegalPages.jsx").then((module) => ({ default: module.Contact })));

const routes = {
  "/": Landing,
  "/login": Login,
  "/signup": Signup,
  "/forgot-password": ForgotPassword,
  "/docs": Docs,
  "/docs/install": Docs,
  "/docs/sdk": Docs,
  "/docs/analytics": Docs,
  "/docs/billing": Docs,
  "/help": Help,
  "/privacy": Privacy,
  "/terms": Terms,
  "/security": Security,
  "/contact": Contact,
  "/dashboard": Dashboard,
  "/activity": Activity,
  "/control": ControlCenter,
  "/visibility": Visibility,
  "/analytics": Analytics,
  "/monetization": Monetization,
  "/training": Training,
  "/settings": Settings,
  "/admin": Admin
};

const protectedRoutes = new Set([
  "/dashboard",
  "/activity",
  "/control",
  "/visibility",
  "/analytics",
  "/monetization",
  "/training",
  "/settings",
  "/admin"
]);

export default function App() {
  const { path, navigate } = useNavigation();
  const { state } = useApp();
  const isProtectedRoute = protectedRoutes.has(path);

  useEffect(() => {
    if (isProtectedRoute && !state.auth.isRestoring && !state.auth.isAuthenticated) {
      window.localStorage.setItem(INTENDED_ROUTE_KEY, path);
      navigate("/login");
    }
  }, [isProtectedRoute, navigate, path, state.auth.isAuthenticated, state.auth.isRestoring]);

  if (isProtectedRoute && state.auth.isRestoring) {
    return <div className="loadingState">Restoring session...</div>;
  }

  if (isProtectedRoute && !state.auth.isAuthenticated) {
    return null;
  }

  const RouteComponent = routes[path] || Landing;

  return (
    <Suspense
      fallback={
        <div className="routeLoading" role="status" aria-live="polite">
          <span />
          <strong>Loading KtrlAI</strong>
          <p>Preparing your workspace experience...</p>
        </div>
      }
    >
      <RouteComponent />
    </Suspense>
  );
}
