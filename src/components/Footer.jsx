import Logo from "./Logo.jsx";
import { RouteLink } from "../navigation.jsx";

const columns = [
  ["Product", ["Dashboard", "AI Activity", "Control Center", "AI Visibility"]],
  ["Solutions", ["Publishers", "SaaS teams", "Data owners", "Marketplaces"]],
  ["Resources", ["Docs", "API status", "Guides", "Research"]],
  ["Company", ["About", "Pricing", "Contact", "Careers"]],
  ["Legal", ["Privacy", "Terms", "Security", "Contact"]]
];

const routeFor = {
  Dashboard: "/dashboard",
  "AI Activity": "/activity",
  "Control Center": "/control",
  "AI Visibility": "/visibility",
  Pricing: "/#pricing",
  Privacy: "/settings",
  Terms: "/settings",
  Security: "/settings",
  Contact: "/settings"
};

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footerBrand">
        <Logo linked={false} />
        <p>Visibility, control, and monetization for the AI-driven internet.</p>
      </div>
      <div className="footerGrid">
        {columns.map(([title, links]) => (
          <div key={title}>
            <h3>{title}</h3>
            {links.map((link) => {
              const to = routeFor[link] || "/";
              return to.includes("#") ? (
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
