import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const normalizePath = useCallback((pathname) => {
    const cleanPath = pathname || "/";
    return cleanPath !== "/" ? cleanPath.replace(/\/+$/, "") : cleanPath;
  }, []);
  const getPath = useCallback(() => normalizePath(window.location.pathname), [normalizePath]);
  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const handlePopState = () => setPath(getPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [getPath]);

  const navigate = useCallback(
    (to) => {
      if (!to || to.startsWith("http")) {
        return;
      }

      const target = to.startsWith("/") || to.startsWith("#") ? to : `/${to}`;
      const url = new URL(target, window.location.origin);
      const routePath = normalizePath(url.pathname);
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const targetHref = `${url.pathname}${url.search}${url.hash}`;

      if (targetHref !== currentHref) {
        window.history.pushState({}, "", targetHref);
      }

      setPath(routePath);

      if (url.hash) {
        window.requestAnimationFrame(() => {
          const targetElement = document.getElementById(decodeURIComponent(url.hash.slice(1)));
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [getPath, normalizePath]
  );

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used inside NavigationProvider");
  }
  return context;
}

export function RouteLink({ to, children, className, onClick, ...props }) {
  const { navigate } = useNavigation();

  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} className={className} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
