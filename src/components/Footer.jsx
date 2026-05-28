import Logo from "./Logo.jsx";
import { RouteLink } from "../navigation.jsx";

const columns = [
  ["Product", ["Operations", "Live Stream", "Traffic Intelligence", "Visibility"]],
  ["Governance", ["Governance", "AI Training", "Licensing Readiness", "Configuration"]],
  ["Resources", ["Docs", "Install guide", "Help", "Contact"]],
  ["Legal", ["Privacy", "Terms", "Security", "Login", "Start free"]]
];

const routeFor = {
  Operations: "/dashboard",
  "Live Stream": "/activity",
  "Traffic Intelligence": "/analytics",
  Governance: "/control",
  Visibility: "/visibility",
  "AI Training": "/training",
  "Licensing Readiness": "/monetization",
  Configuration: "/settings",
  Docs: "/docs",
  "Install guide": "/docs/install",
  Help: "/help",
  Contact: "/contact",
  Privacy: "/privacy",
  Terms: "/terms",
  Security: "/security",
  Login: "/login",
  "Start free": "/signup"
};

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footerBrand">
        <Logo linked={false} />
        <p>AI access governance infrastructure for open web operators.</p>
      </div>
      <div className="footerGrid">
        {columns.map(([title, links]) => (
          <div key={title}>
            <h3>{title}</h3>
            {links.map((link) => {
              const to = routeFor[link] || "/";
              return to.startsWith("mailto:") || to.includes("#") ? (
                <a key={link} href={to}>
                  {link}
                </a>
              ) : (
                <RouteLink key={link} to={to}>
                  {link}
                </RouteLink>
              );
            })}
          </div>
        ))}
      </div>
    </footer>
  );
}
