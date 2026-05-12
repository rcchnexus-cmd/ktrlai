(function () {
  "use strict";

  var SDK_VERSION = "1.0.0";
  var GLOBAL_NAME = "KtrlAI";
  var MAX_QUEUE = 40;
  var MAX_RETRIES = 2;
  var RETRY_DELAY = 1200;
  var EVENT_DEDUPE_WINDOW = 1200;
  var MAX_PAYLOAD_BYTES = 18000;
  var initialized = false;
  var flushing = false;
  var queue = [];
  var identity = {};
  var lastPageKey = "";
  var currentScript = document.currentScript;
  var previousGlobal = window[GLOBAL_NAME];

  var config = {
    workspaceId: "",
    apiKey: "",
    endpoint: "",
    autoTrack: true,
    debug: false
  };

  function readScriptAttribute(name) {
    return currentScript ? currentScript.getAttribute(name) : "";
  }

  function getDefaultEndpoint() {
    if (readScriptAttribute("data-endpoint")) {
      return readScriptAttribute("data-endpoint");
    }

    try {
      return currentScript && currentScript.src ? new URL("/api/track", currentScript.src).toString() : "/api/track";
    } catch (error) {
      return "/api/track";
    }
  }

  function trimString(value, maxLength) {
    var text = String(value == null ? "" : value);
    return text.length > maxLength ? text.slice(0, maxLength) : text;
  }

  function safeObject(value, maxKeys) {
    var output = {};
    var count = 0;

    if (!value || typeof value !== "object") {
      return output;
    }

    Object.keys(value).forEach(function (key) {
      if (count >= maxKeys) {
        return;
      }

      var safeKey = trimString(key, 80);
      var item = value[key];

      if (item == null || typeof item === "boolean" || typeof item === "number") {
        output[safeKey] = item;
      } else if (typeof item === "string") {
        output[safeKey] = trimString(item, 500);
      }

      count += 1;
    });

    return output;
  }

  function createEventId() {
    var random = Math.random().toString(36).slice(2);
    return "kt_evt_" + Date.now().toString(36) + random;
  }

  function getTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (error) {
      return "";
    }
  }

  function isLocalDebugEnvironment() {
    var hostname = window.location && window.location.hostname;
    return window.location.protocol === "file:" || hostname === "localhost" || hostname === "127.0.0.1";
  }

  function debugWarn(message, detail) {
    if (!config.debug || !window.console || !window.console.warn) {
      return;
    }

    if (detail !== undefined) {
      window.console.warn("[KtrlAI]", message, detail);
    } else {
      window.console.warn("[KtrlAI]", message);
    }
  }

  function getSafePageUrl() {
    if (window.location.protocol !== "file:") {
      return window.location.href;
    }

    var path = window.location.pathname || "/local-test";
    return "https://local-file.ktrlai.test" + path.replace(/\\/g, "/");
  }

  function getSafePagePath() {
    if (window.location.protocol === "file:") {
      return window.location.pathname || "/local-test";
    }

    return window.location.pathname + window.location.search;
  }

  function getBasePayload() {
    var pageUrl = getSafePageUrl();
    var pagePath = getSafePagePath();

    return {
      workspaceId: config.workspaceId,
      apiKey: config.apiKey,
      url: pageUrl,
      pageUrl: pageUrl,
      path: pagePath,
      pagePath: pagePath,
      title: document.title || "",
      pageTitle: document.title || "",
      referrer: document.referrer || "",
      userAgent: navigator.userAgent || "",
      timestamp: new Date().toISOString(),
      screen: {
        width: window.screen ? window.screen.width : window.innerWidth,
        height: window.screen ? window.screen.height : window.innerHeight,
        viewportWidth: window.innerWidth || 0,
        viewportHeight: window.innerHeight || 0
      },
      language: navigator.language || "",
      timezone: getTimezone(),
      sdk: {
        name: "ktrlai-browser",
        version: SDK_VERSION
      }
    };
  }

  function normalizePayload(eventName, properties) {
    var base = getBasePayload();
    var eventProperties = safeObject(properties, 24);
    eventProperties.sourceProtocol = window.location.protocol || "";

    if (window.location.protocol === "file:") {
      eventProperties.localFilePath = trimString(window.location.pathname || "", 500);
    }

    return {
      workspaceId: base.workspaceId,
      apiKey: base.apiKey,
      event: trimString(eventName || "custom", 80),
      eventId: createEventId(),
      pageUrl: trimString(base.pageUrl, 1200),
      url: trimString(base.url, 1200),
      pagePath: trimString(base.pagePath, 500),
      path: trimString(base.path, 500),
      referrer: trimString(base.referrer, 1200),
      userAgent: trimString(base.userAgent, 800),
      timestamp: base.timestamp,
      pageTitle: trimString(base.pageTitle, 300),
      title: trimString(base.title, 300),
      screen: base.screen,
      language: trimString(base.language, 40),
      timezone: trimString(base.timezone, 80),
      anonymousId: identity.anonymousId || "",
      userId: identity.userId || "",
      traits: safeObject(identity.traits, 16),
      properties: eventProperties,
      source: "ktrlai-tracker",
      sdk: base.sdk
    };
  }

  function canSend() {
    return Boolean(config.workspaceId && config.apiKey && config.endpoint);
  }

  function payloadSize(payload) {
    try {
      return JSON.stringify(payload || {}).length;
    } catch (error) {
      return MAX_PAYLOAD_BYTES + 1;
    }
  }

  function enqueue(payload) {
    if (!payload || !canSend()) {
      debugWarn("Tracker is not configured. Add data-workspace-id and data-api-key to the script tag.");
      return false;
    }

    if (payloadSize(payload) > MAX_PAYLOAD_BYTES) {
      debugWarn("Tracking payload was too large and was not sent.");
      return false;
    }

    queue.push({
      payload: payload,
      attempts: 0
    });

    if (queue.length > MAX_QUEUE) {
      queue = queue.slice(queue.length - MAX_QUEUE);
    }

    scheduleFlush();
    return true;
  }

  function scheduleFlush() {
    if (flushing) {
      return;
    }

    window.setTimeout(flush, 0);
  }

  function sendWithFetch(item) {
    if (!window.fetch) {
      return Promise.resolve({ ok: false });
    }

    return fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(item.payload),
      keepalive: true,
      credentials: "omit"
    }).then(function (response) {
      if (!response.ok) {
        debugWarn("Tracking request was not accepted.", {
          status: response.status,
          endpoint: config.endpoint
        });
      }

      if (response.status >= 400 && response.status < 500) {
        return { ok: true, permanent: true };
      }

      return { ok: response.ok };
    });
  }

  function sendWithBeacon(item) {
    if (!navigator.sendBeacon) {
      return false;
    }

    try {
      return navigator.sendBeacon(
        config.endpoint,
        new Blob([JSON.stringify(item.payload)], { type: "application/json" })
      );
    } catch (error) {
      return false;
    }
  }

  function flush() {
    if (flushing || !queue.length || !canSend()) {
      return;
    }

    flushing = true;

    var item = queue.shift();
    var isPageEvent = item.payload.event === "page";

    if (isPageEvent && !config.debug && sendWithBeacon(item)) {
      flushing = false;
      scheduleFlush();
      return;
    }

    sendWithFetch(item)
      .then(function (result) {
        if (!result.ok && !result.permanent && item.attempts < MAX_RETRIES) {
          item.attempts += 1;
          window.setTimeout(function () {
            queue.unshift(item);
            scheduleFlush();
          }, RETRY_DELAY * item.attempts);
        }
      })
      .catch(function () {
        debugWarn("Tracking request failed. Check the endpoint, network tab, and API key.");
        if (item.attempts < MAX_RETRIES) {
          item.attempts += 1;
          window.setTimeout(function () {
            queue.unshift(item);
            scheduleFlush();
          }, RETRY_DELAY * item.attempts);
        }
      })
      .then(function () {
        flushing = false;
        scheduleFlush();
      });
  }

  function track(eventName, properties) {
    return enqueue(normalizePayload(eventName, properties));
  }

  function page(properties) {
    var key = window.location.href + "|" + document.title;
    var now = Date.now();
    var eventProperties = safeObject(properties, 24);

    if (lastPageKey === key && page.lastTrackedAt && now - page.lastTrackedAt < EVENT_DEDUPE_WINDOW) {
      return false;
    }

    lastPageKey = key;
    page.lastTrackedAt = now;
    eventProperties.route = window.location.pathname + window.location.search;
    return track("page", eventProperties);
  }

  function identify(userId, traits) {
    identity = {
      userId: trimString(userId || "", 160),
      anonymousId: identity.anonymousId || "kt_anon_" + Math.random().toString(36).slice(2),
      traits: safeObject(traits, 16)
    };

    return track("identify", {
      identified: Boolean(identity.userId)
    });
  }

  function installRouteListener() {
    if (installRouteListener.installed) {
      return;
    }

    installRouteListener.installed = true;

    ["pushState", "replaceState"].forEach(function (methodName) {
      var original = history[methodName];

      if (typeof original !== "function") {
        return;
      }

      try {
        history[methodName] = function () {
          var result = original.apply(this, arguments);
          window.setTimeout(function () {
            page({ trigger: methodName });
          }, 60);
          return result;
        };
      } catch (error) {
        // The SDK must never break a host app if history is locked down.
      }
    });

    window.addEventListener("popstate", function () {
      window.setTimeout(function () {
        page({ trigger: "popstate" });
      }, 60);
    });

    window.addEventListener("hashchange", function () {
      window.setTimeout(function () {
        page({ trigger: "hashchange" });
      }, 60);
    });
  }

  function drainPreloadQueue() {
    var preloadQueue = previousGlobal && previousGlobal.q;

    if (!preloadQueue || !preloadQueue.length) {
      return;
    }

    preloadQueue.slice(0, MAX_QUEUE).forEach(function (call) {
      if (!call || !call.length) {
        return;
      }

      var method = call[0];
      var args = Array.prototype.slice.call(call, 1);

      if (api[method] && typeof api[method] === "function") {
        api[method].apply(api, args);
      }
    });
  }

  function init(options) {
    var next = options || {};

    config.workspaceId = trimString(next.workspaceId || next.workspace_id || readScriptAttribute("data-workspace-id") || config.workspaceId, 120);
    config.apiKey = trimString(next.apiKey || next.api_key || readScriptAttribute("data-api-key") || config.apiKey, 240);
    config.endpoint = trimString(next.endpoint || getDefaultEndpoint(), 1200);
    config.autoTrack = next.autoTrack === false || readScriptAttribute("data-auto-track") === "false" ? false : true;
    config.debug = next.debug === true || readScriptAttribute("data-debug") === "true" || isLocalDebugEnvironment();

    if (initialized) {
      scheduleFlush();
      return api;
    }

    initialized = true;
    installRouteListener();

    if (config.autoTrack) {
      if (document.readyState === "loading") {
        document.addEventListener(
          "DOMContentLoaded",
          function () {
            page({ trigger: "load" });
          },
          { once: true }
        );
      } else {
        window.setTimeout(function () {
          page({ trigger: "load" });
        }, 0);
      }
    }

    drainPreloadQueue();
    return api;
  }

  var api = {
    version: SDK_VERSION,
    init: init,
    track: track,
    identify: identify,
    page: page,
    flush: flush,
    q: []
  };

  if (previousGlobal && previousGlobal.__initialized) {
    window[GLOBAL_NAME] = previousGlobal;
    return;
  }

  api.__initialized = true;
  window[GLOBAL_NAME] = api;
  init();
})();
