import { useEffect } from "react";
import Landing from "./pages/Landing.jsx";
import { Login, Signup, ForgotPassword } from "./pages/AuthPages.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Activity from "./pages/Activity.jsx";
import ControlCenter from "./pages/ControlCenter.jsx";
import Visibility from "./pages/Visibility.jsx";
import Analytics from "./pages/Analytics.jsx";
import Monetization from "./pages/Monetization.jsx";
import Training from "./pages/Training.jsx";
import Settings from "./pages/Settings.jsx";
import { useNavigation } from "./navigation.jsx";
import { useApp } from "./context/AppContext.jsx";

const INTENDED_ROUTE_KEY = "ktrlai_intended_route";

const routes = {
  "/": Landing,
  "/login": Login,
  "/signup": Signup,
  "/forgot-password": ForgotPassword,
  "/dashboard": Dashboard,
  "/activity": Activity,
  "/control": ControlCenter,
  "/visibility": Visibility,
  "/analytics": Analytics,
  "/monetization": Monetization,
  "/training": Training,
  "/settings": Settings
};

const protectedRoutes = new Set([
  "/dashboard",
  "/activity",
  "/control",
  "/visibility",
  "/analytics",
  "/monetization",
  "/training",
  "/settings"
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

  return <RouteComponent />;
}
