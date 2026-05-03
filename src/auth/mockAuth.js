const SESSION_KEY = "ktrlai_mock_session";

const fallbackUser = {
  name: "Avery Stone",
  email: "avery@northstar.media",
  plan: "Free"
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readSession() {
  if (!canUseStorage()) {
    return { isAuthenticated: false, user: null };
  }

  try {
    const rawSession = window.localStorage.getItem(SESSION_KEY);
    if (!rawSession) {
      return { isAuthenticated: false, user: null };
    }

    const session = JSON.parse(rawSession);
    return {
      isAuthenticated: Boolean(session.isAuthenticated && session.user),
      user: session.user || null
    };
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return { isAuthenticated: false, user: null };
  }
}

function writeSession(user) {
  const session = {
    isAuthenticated: true,
    user
  };

  if (canUseStorage()) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return session;
}

function nameFromEmail(email) {
  const localPart = email.split("@")[0] || "KtrlAI User";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function login({ email, password, name, plan } = {}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  if (!cleanPassword || cleanPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  return writeSession({
    name: name || nameFromEmail(cleanEmail) || fallbackUser.name,
    email: cleanEmail,
    plan: plan || fallbackUser.plan
  });
}

export function signup({ email, password, name, plan } = {}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Enter a valid work email address.");
  }

  if (!cleanPassword || cleanPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  return writeSession({
    name: name || nameFromEmail(cleanEmail) || fallbackUser.name,
    email: cleanEmail,
    plan: plan || "Free"
  });
}

export function logout() {
  if (canUseStorage()) {
    window.localStorage.removeItem(SESSION_KEY);
  }

  return { isAuthenticated: false, user: null };
}

export function getUser() {
  return readSession().user;
}

export function isAuthenticated() {
  return readSession().isAuthenticated;
}

export function getSession() {
  return readSession();
}
