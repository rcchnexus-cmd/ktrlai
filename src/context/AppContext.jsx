import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { mockApi } from "../api/mockApi.js";
import * as authService from "../auth/supabaseAuth.js";
import { requestPayoutReview } from "../billing/billingApi.js";
import { allowLocalMockFallback, showInvestorSampleData } from "../config/runtime.js";

const AppContext = createContext(null);

function createInitialState() {
  const session = authService.getInitialSession();

  return {
    dashboard: null,
    activity: [],
    controls: null,
    visibility: null,
    analytics: null,
    monetization: null,
    training: null,
    settings: null,
    loading: {},
    errors: {},
    auth: {
      isRestoring: session.isRestoring,
      isAuthenticated: session.isAuthenticated,
      user: session.user,
      workspace: session.workspace,
      workspaceId: session.workspaceId,
      mode: session.mode
    }
  };
}

function decorateSettings(settings, auth) {
  if (!settings) {
    return settings;
  }

  return {
    ...settings,
    workspaceId: auth.workspaceId || settings.workspaceId,
    account: auth.user
      ? {
          name: auth.user.name,
          email: auth.user.email,
          plan: auth.user.plan
        }
      : settings.account
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "loading":
      return {
        ...state,
        loading: { ...state.loading, [action.key]: action.value },
        errors: { ...state.errors, [action.key]: null }
      };
    case "error":
      return {
        ...state,
        loading: { ...state.loading, [action.key]: false },
        errors: { ...state.errors, [action.key]: action.error }
      };
    case "set":
      return {
        ...state,
        [action.key]: action.key === "settings" ? decorateSettings(action.value, state.auth) : action.value,
        loading: { ...state.loading, [action.key]: false }
      };
    case "updateControlRule":
      if (!state.controls) {
        return state;
      }
      return {
        ...state,
        controls: {
          ...state.controls,
          rules: state.controls.rules.map((rule) =>
            rule.id === action.ruleId ? { ...rule, enabled: action.enabled } : rule
          )
        }
      };
    case "addControlRule":
      if (!state.controls) {
        return state;
      }
      return {
        ...state,
        controls: {
          ...state.controls,
          customRules: [action.rule, ...state.controls.customRules]
        }
      };
    case "updateMonetization":
      if (!state.monetization) {
        return state;
      }
      return {
        ...state,
        monetization: { ...state.monetization, ...action.updates }
      };
    case "requestPayout":
      if (!state.monetization) {
        return state;
      }
      return {
        ...state,
        monetization: {
          ...state.monetization,
          payoutRequests: [action.request, ...state.monetization.payoutRequests]
        }
      };
    case "updateTraining":
      if (!state.training) {
        return state;
      }
      return {
        ...state,
        training: { ...state.training, ...action.updates }
      };
    case "addTrainingFile":
      if (!state.training) {
        return state;
      }
      return {
        ...state,
        training: {
          ...state.training,
          uploads: [action.file, ...state.training.uploads]
        }
      };
    case "addDomain":
      if (!state.settings) {
        return state;
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          domains: [action.domain, ...state.settings.domains]
        }
      };
    case "verifyDomain":
      if (!state.settings) {
        return state;
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          domains: state.settings.domains.map((domain) =>
            domain.id === action.domain.id ? action.domain : domain
          )
        }
      };
    case "rotateApiKey":
      if (!state.settings) {
        return state;
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          apiKey: action.apiKey,
          script: action.script || state.settings.script
        }
      };
    case "authSession":
      return {
        ...state,
        settings: state.settings
          ? decorateSettings(state.settings, {
              isAuthenticated: action.session.isAuthenticated,
              user: action.session.user,
              workspace: action.session.workspace,
              workspaceId: action.session.workspaceId,
              mode: action.session.mode,
              isRestoring: false
            })
          : state.settings,
        auth: {
          isRestoring: false,
          isAuthenticated: action.session.isAuthenticated,
          user: action.session.user,
          workspace: action.session.workspace,
          workspaceId: action.session.workspaceId,
          mode: action.session.mode
        }
      };
    case "authRestoreFailed":
      return {
        ...state,
        errors: { ...state.errors, auth: action.error },
        auth: {
          isRestoring: false,
          isAuthenticated: false,
          user: null,
          workspace: null,
          workspaceId: null,
          mode: "live"
        }
      };
    default:
      return state;
  }
}

async function load(dispatch, key, request) {
  dispatch({ type: "loading", key, value: true });
  try {
    const value = await request();
    dispatch({ type: "set", key, value });
    return value;
  } catch (error) {
    dispatch({ type: "error", key, error: error.message || "Something went wrong" });
    return null;
  }
}

function getLiveEmptyDashboard() {
  return {
    kpis: [
      { label: "Total AI Visits", value: "0", change: "Awaiting first live event", tone: "neutral" },
      { label: "Unique AI Bots", value: "0", change: "Connect tracker", tone: "neutral" },
      { label: "Pages Accessed", value: "0", change: "No events yet", tone: "neutral" },
      { label: "Revenue from AI", value: "$0", change: "No revenue yet", tone: "neutral" }
    ],
    traffic: [],
    botDistribution: [],
    recentActivity: []
  };
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  useEffect(() => {
    let isMounted = true;

    authService
      .restoreSession()
      .then((session) => {
        if (isMounted) {
          dispatch({ type: "authSession", session });
        }
      })
      .catch((error) => {
        if (isMounted) {
          dispatch({ type: "authRestoreFailed", error: error.message || "Authentication could not be restored." });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const actions = useMemo(
    () => ({
      loadDashboard: () =>
        load(dispatch, "dashboard", () => (showInvestorSampleData ? mockApi.getDashboard() : getLiveEmptyDashboard())),
      loadActivity: () => load(dispatch, "activity", mockApi.getActivityLogs),
      loadControls: () => load(dispatch, "controls", mockApi.getControls),
      loadAnalytics: () => load(dispatch, "analytics", mockApi.getAnalytics),
      loadMonetization: () => load(dispatch, "monetization", mockApi.getMonetization),
      loadTraining: () => load(dispatch, "training", mockApi.getTraining),
      loadSettings: () =>
        load(dispatch, "settings", async () => {
          const settings = await mockApi.getSettings();
          return authService.getSettingsOverlay(settings);
        }),
      checkVisibility: async (url) => {
        const value = await load(dispatch, "visibility", () => mockApi.checkVisibility(url));
        return value;
      },
      updateControlRule: async (ruleId, enabled) => {
        dispatch({ type: "updateControlRule", ruleId, enabled });
        await mockApi.updateControlRule(ruleId, enabled);
      },
      addControlRule: async (rule) => {
        const created = await mockApi.createControlRule(rule);
        dispatch({ type: "addControlRule", rule: created });
      },
      updateMonetization: async (updates) => {
        dispatch({ type: "updateMonetization", updates });
        await mockApi.updateMonetizationSettings(updates);
      },
      requestPayout: async ({ amountCents, currency }) => {
        let request;

        try {
          request = await requestPayoutReview({
            amountCents,
            currency,
            workspaceId: authService.getActiveWorkspaceId()
          });
        } catch (error) {
          if (!error.useMockFallback || !allowLocalMockFallback) {
            throw error;
          }
          request = await mockApi.requestPayout({ amountCents, currency });
        }

        dispatch({ type: "requestPayout", request });
        return request;
      },
      updateTraining: async (updates) => {
        dispatch({ type: "updateTraining", updates });
        await mockApi.updateTrainingSetting(updates);
      },
      uploadTrainingFile: async (file) => {
        const uploaded = await mockApi.uploadTrainingFile(file);
        dispatch({ type: "addTrainingFile", file: uploaded });
      },
      addDomain: async (domain) => {
        const supabaseDomain = await authService.addDomain(domain);
        const created = supabaseDomain || (allowLocalMockFallback ? await mockApi.addDomain(domain) : null);

        if (!created) {
          throw new Error("Domain could not be added because the production workspace is not available.");
        }

        dispatch({ type: "addDomain", domain: created });
        return created;
      },
      checkDomainVerification: async (domainId) => {
        const verified = await mockApi.checkDomainVerification(domainId);
        dispatch({ type: "verifyDomain", domain: verified });
        return verified;
      },
      applyDomainVerification: (domain) => {
        dispatch({ type: "verifyDomain", domain });
        return domain;
      },
      rotateApiKey: async () => {
        const result = await mockApi.rotateApiKey();
        dispatch({ type: "rotateApiKey", apiKey: result.apiKey, script: result.script });
        return result;
      },
      applyApiKeyRotation: (result) => {
        dispatch({ type: "rotateApiKey", apiKey: result.apiKey, script: result.script });
        return result;
      },
      login: async (credentials) => {
        const session = await authService.login(credentials);
        dispatch({ type: "authSession", session });
        return session;
      },
      signup: async (credentials) => {
        const session = await authService.signup(credentials);
        dispatch({ type: "authSession", session });
        return session;
      },
      logout: async () => {
        const session = await authService.logout();
        dispatch({ type: "authSession", session });
        return session;
      }
    }),
    []
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return context;
}
