import Logo from "./Logo.jsx";
import { RouteLink } from "../navigation.jsx";

const columns = [
  ["Product", ["Operations", "Live Stream", "Governance", "Visibility", "Docs"]],
  ["Pricing", ["Free", "Pro", "Business", "Compare plans"]],
  ["Company", ["About", "Contact", "Security", "Help"]],
  ["Legal", ["Privacy", "Terms", "Security", "Contact"]]
];

const routeFor = {
  Operations: "/dashboard",
  "Live Stream": "/activity",
  Governance: "/control",
  Visibility: "/visibility",
  Docs: "/docs",
  Help: "/help",
  Free: "/#pricing",
  Pro: "/#pricing",
  Business: "/#pricing",
  "Compare plans": "/#pricing",
  About: "/#about",
  Pricing: "/#pricing",
  Contact: "/contact",
  Privacy: "/privacy",
  Terms: "/terms",
  Security: "/security"
};

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footerBrand">
        <Logo linked={false} />
        <p>AI crawler visibility, governance, and licensing readiness for website owners.</p>
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
