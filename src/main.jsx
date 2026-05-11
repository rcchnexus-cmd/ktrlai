import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { AppProvider } from "./context/AppContext.jsx";
import { NavigationProvider } from "./navigation.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <NavigationProvider>
      <AppProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AppProvider>
    </NavigationProvider>
  </React.StrictMode>
);
