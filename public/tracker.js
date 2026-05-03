(function () {
  "use strict";

  var currentScript = document.currentScript;
  var workspaceId = currentScript ? currentScript.getAttribute("data-workspace-id") : "";
  var apiKey = currentScript ? currentScript.getAttribute("data-api-key") : "";

  function classifyUserAgent(userAgent) {
    var value = String(userAgent || "").toLowerCase();

    if (!value) return "Human/Browser";
    if (value.indexOf("chatgpt") !== -1 || value.indexOf("oai-searchbot") !== -1 || value.indexOf("openai") !== -1) {
      return "ChatGPT";
    }
    if (value.indexOf("claudebot") !== -1 || value.indexOf("anthropic") !== -1 || value.indexOf("claude") !== -1) {
      return "Claude";
    }
    if (value.indexOf("perplexitybot") !== -1 || value.indexOf("perplexity") !== -1) {
      return "Perplexity";
    }
    if (value.indexOf("google-extended") !== -1) {
      return "Google-Extended";
    }
    if (value.indexOf("bot") !== -1 || value.indexOf("crawler") !== -1 || value.indexOf("spider") !== -1) {
      return "UnknownBot";
    }

    return "Human/Browser";
  }

  function buildEvent() {
    var userAgent = navigator.userAgent || "";

    return {
      workspaceId: workspaceId,
      apiKey: apiKey,
      pageUrl: window.location.href,
      referrer: document.referrer || "",
      userAgent: userAgent,
      timestamp: new Date().toISOString(),
      pageTitle: document.title || "",
      detectedBotType: classifyUserAgent(userAgent),
      source: "ktrlai-tracker"
    };
  }

  function sendEvent() {
    if (!workspaceId || !apiKey) {
      return;
    }

    var payload = JSON.stringify(buildEvent());
    var endpoint = currentScript && currentScript.src ? new URL("/api/track", currentScript.src).toString() : "/api/track";

    if (navigator.sendBeacon) {
      var sent = navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
      if (sent) return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: payload,
      keepalive: true,
      credentials: "omit"
    }).catch(function () {
      // Tracking should never interrupt the customer's page.
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sendEvent, { once: true });
  } else {
    sendEvent();
  }
})();
