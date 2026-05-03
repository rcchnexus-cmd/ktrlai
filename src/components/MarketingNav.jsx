import { useCallback, useEffect, useRef, useState } from "react";
import Logo from "./Logo.jsx";
import { RouteLink } from "../navigation.jsx";

const menus = [
  {
    label: "Product",
    items: [
      ["Dashboard", "/dashboard"],
      ["AI Visibility", "/visibility"],
      ["Control Center", "/control"]
    ]
  },
  {
    label: "Solutions",
    items: [
      ["Publishers", "/monetization"],
      ["Data owners", "/training"],
      ["SaaS platforms", "/analytics"]
    ]
  },
  {
    label: "AI Governance",
    items: [
      ["Training permissions", "/training"],
      ["Access rules", "/control"],
      ["Audit logs", "/activity"]
    ]
  },
  {
    label: "Resources",
    items: [
      ["AI activity", "/activity"],
      ["Security", "/settings"],
      ["Visibility check", "/visibility"]
    ]
  },
  {
    label: "Company",
    items: [
      ["About KtrlAI", "/"],
      ["Contact", "/settings"],
      ["Careers", "/"]
    ]
  }
];

function ChevronDown() {
  return (
    <svg className="chevronIcon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3.5 5.25L7 8.75L10.5 5.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MarketingNav() {
  const [activeMenu, setActiveMenu] = useState(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  const clearTimers = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  const scheduleOpen = useCallback(
    (label) => {
      clearTimers();
      openTimer.current = window.setTimeout(() => setActiveMenu(label), 110);
    },
    [clearTimers]
  );

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setActiveMenu(null), 150);
  }, [clearTimers]);

  const openNow = useCallback(
    (label) => {
      clearTimers();
      setActiveMenu(label);
    },
    [clearTimers]
  );

  const closeNow = useCallback(() => {
    clearTimers();
    setActiveMenu(null);
  }, [clearTimers]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return (
    <header className="marketingHeader">
      <div className="announcement">
        <span>New</span>
        Content rights controls for answer engines and AI training crawlers are now in beta.
      </div>
      <nav className="marketingNav" aria-label="Main navigation">
        <Logo />
        <div className="navMenus">
          {menus.map((menu) => (
            <div
              className={activeMenu === menu.label ? "navMenu open" : "navMenu"}
              key={menu.label}
              onMouseEnter={() => scheduleOpen(menu.label)}
              onMouseLeave={scheduleClose}
              onFocus={() => openNow(menu.label)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  scheduleClose();
                }
              }}
            >
              <button
                type="button"
                className="navMenuButton"
                aria-controls={`nav-menu-${menu.label.toLowerCase().replace(/\s+/g, "-")}`}
                aria-expanded={activeMenu === menu.label}
                aria-haspopup="true"
              >
                {menu.label}
                <ChevronDown />
              </button>
              <div className="navDropdown" id={`nav-menu-${menu.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {menu.items.map(([label, to]) => (
                  <RouteLink key={label} to={to} onClick={closeNow}>
                    {label}
                  </RouteLink>
                ))}
              </div>
            </div>
          ))}
          <a href="#pricing" className="navMenuButton navPricing">
            Pricing
          </a>
        </div>
        <div className="navActions">
          <RouteLink to="/login" className="ghostButton">
            Log in
          </RouteLink>
          <RouteLink to="/signup" className="primaryButton smallButton">
            Start free
          </RouteLink>
        </div>
      </nav>
    </header>
  );
}
