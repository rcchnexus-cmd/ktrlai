import { useCallback, useEffect, useState } from "react";
import Logo from "./Logo.jsx";
import ProductHint from "./ProductHint.jsx";
import { RouteLink, useNavigation } from "../navigation.jsx";
import { useApp } from "../context/AppContext.jsx";

const navGroups = [
  {
    label: "Monitor",
    routes: [
      { to: "/dashboard", label: "Operations", icon: "O" },
      { to: "/activity", label: "Activity", icon: "A" },
      { to: "/analytics", label: "Analytics", icon: "I" },
      { to: "/visibility", label: "Visibility", icon: "V" }
    ]
  },
  {
    label: "Govern",
    routes: [
      { to: "/control", label: "Governance", icon: "G" },
      { to: "/training", label: "Training", icon: "T" },
      { to: "/monetization", label: "Monetization", icon: "$" }
    ]
  },
  {
    label: "Configure",
    routes: [{ to: "/settings", label: "Configuration", icon: "C" }]
  }
];

const adminGroup = {
  label: "Platform",
  routes: [{ to: "/admin", label: "Admin", icon: "A" }]
};

function routePath(to) {
  return to.split("#")[0];
}

function isRouteActive(currentPath, to) {
  if (to.includes("#")) {
    return false;
  }

  return currentPath === routePath(to);
}

export default function AppShell({ title, eyebrow, children, action }) {
  const { path, navigate } = useNavigation();
  const { state, actions } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarGroups = state.auth.isPlatformAdmin ? [...navGroups, adminGroup] : navGroups;

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
          {sidebarGroups.map((group) => (
            <div className="sidebarGroup" key={group.label}>
              <span className="sidebarGroupLabel">{group.label}</span>
              {group.routes.map((route) => (
                <RouteLink
                  key={route.to}
                  to={route.to}
                  className={isRouteActive(path, route.to) ? "sidebarLink active" : "sidebarLink"}
                  onClick={closeSidebar}
                >
                  <span>{route.icon}</span>
                  {route.label}
                </RouteLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebarFooter">
          <span>{state.auth.workspace?.name || "Workspace"}</span>
          <strong>{state.auth.user?.email || "northstar.media"}</strong>
          <em>{state.auth.user?.plan || "Free"} plan</em>
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
            <RouteLink to="/" className="secondaryButton smallButton" aria-label="Back to public site" title="Back to public site">
              Public site
            </RouteLink>
          </div>
        </header>
        <ProductHint path={path} />
        {children}
      </main>
    </div>
  );
}
