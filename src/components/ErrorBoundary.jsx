import { Component } from "react";
import { RouteLink } from "../navigation.jsx";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("KtrlAI render error", error, info);
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="fatalErrorShell">
        <div className="emptyState">
          <strong>Something interrupted this view</strong>
          <p>Refresh the page to recover, or return to your dashboard while KtrlAI reloads the workspace.</p>
          <div className="emptyStateActions">
            <button type="button" className="primaryButton smallButton" onClick={() => window.location.reload()}>
              Refresh
            </button>
            <RouteLink to="/dashboard" className="secondaryButton smallButton">
              Open dashboard
            </RouteLink>
          </div>
        </div>
      </div>
    );
  }
}
