import { useCallback, useEffect, useState } from "react";
import Logo from "./Logo.jsx";
import { RouteLink, useNavigation } from "../navigation.jsx";
import { useApp } from "../context/AppContext.jsx";

const appRoutes = [
  { to: "/dashboard", label: "Dashboard", icon: "D" },
  { to: "/activity", label: "AI Activity", icon: "A" },
  { to: "/control", label: "Control Center", icon: "C" },
  { to: "/visibility", label: "AI Visibility", icon: "V" },
  { to: "/analytics", label: "Analytics", icon: "#" },
  { to: "/monetization", label: "Monetization", icon: "$" },
  { to: "/training", label: "AI Training", icon: "T" },
  { to: "/settings", label: "Settings", icon: "*" }
];

export default function AppShell({ title, eyebrow, children, action }) {
  const { path, navigate } = useNavigation();
  const { state, actions } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen((isOpen) => !isOpen), []);

  const handleLogout = async () => {
    closeSidebar();
    await actions.logout();
    navigate("/");
  };

  useEffect(() => {
    closeSidebar();
  }, [closeSidebar, path]);

  useEffect(() => {
    document.body.classList.toggle("appDrawerOpen", isSidebarOpen);

    return () => document.body.classList.remove("appDrawerOpen");
  }, [isSidebarOpen]);

  return (
    <div className="appShell">
      <aside className={isSidebarOpen ? "sidebar open" : "sidebar"}>
        <div className="sidebarBrand">
          <Logo />
        </div>
        <nav className="sidebarNav" aria-label="Application navigation">
          {appRoutes.map((route) => (
            <RouteLink
              key={route.to}
              to={route.to}
              className={path === route.to ? "sidebarLink active" : "sidebarLink"}
              onClick={closeSidebar}
            >
              <span>{route.icon}</span>
              {route.label}
            </RouteLink>
          ))}
        </nav>
        <div className="sidebarFooter">
          <span>{state.auth.user?.plan || "Free"} plan</span>
          <strong>{state.auth.user?.email || "northstar.media"}</strong>
          <button type="button" className="logoutButton" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
      <button
        type="button"
        className={isSidebarOpen ? "sidebarScrim visible" : "sidebarScrim"}
        aria-label="Close navigation menu"
        onClick={closeSidebar}
      />
      <main className="mainPanel">
        <header className="topbar">
          <div className="topbarTitle">
            <button
              type="button"
              className="appMenuButton"
              aria-label={isSidebarOpen ? "Close app navigation" : "Open app navigation"}
              aria-expanded={isSidebarOpen}
              onClick={toggleSidebar}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topbarActions">
            {action}
            <button type="button" className="secondaryButton smallButton" onClick={handleLogout}>
              Log out
            </button>
            <RouteLink to="/" className="secondaryButton smallButton" aria-label="Back to landing page" title="Back to landing page">
              Open
            </RouteLink>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
