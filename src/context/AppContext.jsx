import { createContext, useContext, useMemo, useReducer } from "react";
import { mockApi } from "../api/mockApi.js";
import * as mockAuth from "../auth/mockAuth.js";

const AppContext = createContext(null);

function createInitialState() {
  const session = mockAuth.getSession();

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
      isAuthenticated: session.isAuthenticated,
      user: session.user
    }
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
        [action.key]: action.value,
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
        auth: {
          isAuthenticated: action.session.isAuthenticated,
          user: action.session.user
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

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const actions = useMemo(
    () => ({
      loadDashboard: () => load(dispatch, "dashboard", mockApi.getDashboard),
      loadActivity: () => load(dispatch, "activity", mockApi.getActivityLogs),
      loadControls: () => load(dispatch, "controls", mockApi.getControls),
      loadAnalytics: () => load(dispatch, "analytics", mockApi.getAnalytics),
      loadMonetization: () => load(dispatch, "monetization", mockApi.getMonetization),
      loadTraining: () => load(dispatch, "training", mockApi.getTraining),
      loadSettings: () => load(dispatch, "settings", mockApi.getSettings),
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
        const request = await mockApi.requestPayout({ amountCents, currency });
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
        const created = await mockApi.addDomain(domain);
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
      login: (credentials) => {
        const session = mockAuth.login(credentials);
        dispatch({ type: "authSession", session });
        return session;
      },
      signup: (credentials) => {
        const session = mockAuth.signup(credentials);
        dispatch({ type: "authSession", session });
        return session;
      },
      logout: () => {
        const session = mockAuth.logout();
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
