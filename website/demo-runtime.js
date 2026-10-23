/* Browser-only demo backend. It executes before the unmodified native console.
 * Every state mutation is in this page's memory. No request reaches a server. */
(function () {
  "use strict";
  // Native session selection focuses the composer. Keep an embedded demo from
  // scrolling the parent landing page before the visitor chooses to explore it.
  var nativeFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (options) {
    return nativeFocus.call(this, Object.assign({}, options, { preventScroll: true }));
  };

  var data = window.ATTEND_DEMO_FIXTURES;
  var view = data.view;
  var sources = new Set();
  var clone = function (v) {
    return JSON.parse(JSON.stringify(v));
  };
  function memoryStorage(initial) {
    var storage = new Map(initial || []);
    return {
      getItem: function (k) {
        k = String(k);
        return storage.has(k) ? storage.get(k) : null;
      },
      setItem: function (k, v) {
        storage.set(String(k), String(v));
      },
      removeItem: function (k) {
        storage.delete(String(k));
      },
      clear: function () {
        storage.clear();
      },
      key: function (i) {
        return Array.from(storage.keys())[i] || null;
      },
      get length() {
        return storage.size;
      },
    };
  }
  Object.defineProperty(window, "localStorage", {
    value: memoryStorage([["attend.workStatsRange", "3d"]]),
  });
  Object.defineProperty(window, "sessionStorage", { value: memoryStorage() });
  function session(id) {
    return view.sessions.find(function (s) {
      return s.sessionId === id;
    });
  }
  function json(value, status) {
    return Promise.resolve(
      new Response(JSON.stringify(clone(value)), {
        status: status || 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }
  function announce(text) {
    var notice = document.getElementById("attendDemoNotice");
    if (notice) {
      notice.textContent = text;
      notice.hidden = false;
      clearTimeout(announce.timer);
      announce.timer = setTimeout(function () {
        notice.hidden = true;
      }, 6500);
    }
  }
  function denied() {
    announce(
      "Demo only — sending, CLI execution, and model calls are disabled. Edits stay in memory.",
    );
    return json(
      {
        ok: false,
        error: "Demo only: no CLI execution or model calls.",
        code: "demo_execution_disabled",
      },
      403,
    );
  }
  function comments() {
    return {
      kind: "comment_index",
      epoch: "sample",
      generatedAt: Date.now(),
      comments: Object.values(view.vaultState.commentThreads || {}).map(function (thread) {
        return { thread: thread, historyVersion: "sample-1" };
      }),
    };
  }
  function index() {
    return {
      kind: "session_index",
      epoch: "sample",
      revision: 1,
      pending: false,
      sessions: view.sessions,
      tags: view.tags,
      knownDirs: view.knownDirs,
      defaultNewDir: view.defaultNewDir,
    };
  }
  function snapshot() {
    return {
      active: ["sample-04"],
      startedAt: { "sample-04": data.now - 95000 },
      lastAssistantAt: { "sample-04": data.now - 11000 },
      schedules: view.schedules,
      analyzerSettings: view.analyzerSettings,
      queues: Object.fromEntries(
        Object.entries(data.queue).map(function (entry) {
          return [entry[0], { count: entry[1].items.length, parked: entry[1].parked }];
        }),
      ),
      stats: {
        sessions1h: data.activity.sessions,
        prompts1h: data.activity.prompts,
        chars1h: data.activity.chars,
      },
    };
  }
  function publish(message) {
    sources.forEach(function (source) {
      source.emit("message", { data: JSON.stringify(message), lastEventId: "sample" });
    });
  }
  window.fetch = function (input, options) {
    options = options || {};
    var raw = typeof input === "string" ? input : input.url;
    var url;
    try {
      url = new URL(raw, location.href);
    } catch (_) {
      return denied();
    }
    if (url.origin !== location.origin) return denied();
    var p = url.pathname,
      method = String(options.method || "GET").toUpperCase(),
      body = {};
    try {
      body = JSON.parse(options.body || "{}");
    } catch (_) {}
    var id = url.searchParams.get("session"),
      s = session(id);
    if (p === "/stats/work")
      return json(data.stats[url.searchParams.get("range")] || data.stats["3d"]);
    if (p === "/session-index") return json(index());
    if (p === "/comment-index") return json(comments());
    if (p === "/chat/live") return json(snapshot());
    if (p === "/chat/messages" || p === "/comments/messages") {
      if (p === "/comments/messages") {
        var t = (view.vaultState.commentThreads || {})[url.searchParams.get("id")];
        id = t && t.providerSessionId;
      }
      if (!id) {
        s = view.sessions.find(function (v) {
          return v.file === url.searchParams.get("file");
        });
        id = s && s.sessionId;
      }
      var messages = data.histories[id] || [];
      return json({
        messages: messages,
        page: {
          before: 0,
          hasMore: false,
          total: messages.length,
          version: "sample-1",
          sourceTruncated: false,
        },
      });
    }
    if (p === "/session/view") return json({ view: s || null });
    if (p === "/session/analysis")
      return json({
        analysis: s
          ? {
              brief: s.brief,
              state: s.state,
              priority: s.score,
              reason: s.reason,
              etaMin: s.etaMin,
              nextStep: s.nextStep,
              probe: s.probe,
            }
          : null,
        execution: { mode: "off", reason: "Static sample analysis; no AI calls." },
      });
    if (p.indexOf("/models/") === 0)
      return json({
        ok: true,
        models: [],
        defaults: { model: "", effort: "", speed: "" },
        warning: "Sample configuration. No model discovery or CLI calls.",
      });
    if (p === "/vault/ui-state" && method === "POST") {
      Object.keys(body).forEach(function (key) {
        if (
          [
            "sessionNotes",
            "sessionTodos",
            "pins",
            "sessionPins",
            "sessionTitles",
            "forkParents",
            "chatGroups",
            "commentThreads",
            "modelPrefs",
            "sessionRunConfigs",
            "customThemes",
          ].includes(key)
        ) {
          var records = view.vaultState[key] || (view.vaultState[key] = {});
          Object.keys(body[key] || {}).forEach(function (id) {
            if (body[key][id] === null) delete records[id];
            else records[id] = body[key][id];
          });
        } else if (key === "focusViewPatch")
          Object.keys(body[key]).forEach(function (fid) {
            var list = view.vaultState.focusViews || [],
              at = list.findIndex(function (f) {
                return f.id === fid;
              });
            if (body[key][fid] === null) {
              if (at >= 0) list.splice(at, 1);
            } else if (at >= 0) list[at] = body[key][fid];
            else list.push(body[key][fid]);
          });
        else view.vaultState[key] = body[key];
      });
      return json({ ok: true });
    }
    if (p === "/session/override" && method === "POST" && s) {
      Object.keys(body).forEach(function (k) {
        if (k === "priority") {
          s.score = body[k];
          s.priorityset = body[k] != null;
        } else if (k === "state") {
          s.state = body[k];
          s.stateset = body[k] != null;
        } else if (k === "stateColor") s.stateColor = body[k];
        else if (k === "etaMin") {
          s.etaMin = body[k];
          s.etaset = body[k] != null;
        } else if (k === "pattern") s.pattern = body[k];
      });
      return json({ ok: true });
    }
    if (
      p === "/session/status" ||
      p === "/session/viewed" ||
      p === "/session/engagement" ||
      p === "/session/touch"
    )
      return json({ ok: true });
    if (p === "/session/tags" && method === "POST" && s) {
      s.tags = body.tags || [];
      return json({ ok: true, tags: s.tags });
    }
    if (
      p === "/tags" ||
      p === "/tags/order" ||
      p === "/tags/batch" ||
      p === "/tags/clear-session-bindings"
    ) {
      if (p === "/tags/order") view.tags = body.tags || view.tags;
      else if (p === "/tags/batch" || p === "/tags/clear-session-bindings") {
        var removed = p === "/tags/batch" ? body.names || [] : [body.name];
        view.sessions.forEach(function (s) {
          s.tags = s.tags.filter(function (t) {
            return !removed.includes(t);
          });
        });
        if (body.action === "delete")
          view.tags = view.tags.filter(function (t) {
            return !removed.includes(t);
          });
      } else if (method === "POST" && body.name && !view.tags.includes(body.name))
        view.tags.push(body.name);
      else if (method === "DELETE") {
        var name = url.searchParams.get("name");
        view.tags = view.tags.filter(function (t) {
          return t !== name;
        });
        view.sessions.forEach(function (s) {
          s.tags = s.tags.filter(function (t) {
            return t !== name;
          });
        });
      }
      return json({ ok: true, tags: view.tags });
    }
    if (p === "/chat/queue") {
      var q = data.queue[id] || (data.queue[id] = { parked: false, items: [] });
      var qid = url.searchParams.get("item"),
        qi = q.items.find(function (i) {
          return i.id === qid;
        });
      if (method === "PATCH" && qi && typeof body.text === "string") qi.text = body.text;
      if (method === "DELETE")
        q.items = q.items.filter(function (i) {
          return i.id !== qid;
        });
      if (method === "POST") return denied();
      return json({ ok: true, items: q.items, parked: q.parked, steerable: false });
    }
    if (p === "/comments/read" || p === "/comments/status") {
      var thread = view.vaultState.commentThreads[body.id];
      if (thread) thread.status = body.status || "read";
      return json({ ok: true });
    }
    if (p === "/dirs/suggest")
      return json({ dirs: view.knownDirs, suggestions: view.knownDirs, hasMore: false });
    if (p === "/schedules" && method === "GET")
      return json({ ok: true, schedules: view.schedules });
    if (p === "/chat/goal") return json({ ok: true, goal: null });
    if (p === "/paths/exists") return json({ exists: {} });
    if (p === "/session/source")
      return json({ ok: false, error: "Synthetic transcript; no local source file." });
    if (p.indexOf("/search") === 0 || p === "/sessions/search") {
      var query = String(url.searchParams.get("q") || "").toLowerCase();
      return json({
        results: view.sessions
          .filter(function (s) {
            return JSON.stringify(s).toLowerCase().includes(query);
          })
          .map(function (s) {
            return {
              sessionId: s.sessionId,
              vendor: s.vendor,
              file: s.file,
              count: 1,
              hits: [{ role: "assistant", text: s.reason }],
            };
          }),
      });
    }
    return denied();
  };
  class DemoEventSource {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      this.listeners = {};
      sources.add(this);
      var self = this;
      setTimeout(function () {
        if (!sources.has(self)) return;
        self.emit("open", {});
        self.emit("message", { data: JSON.stringify(snapshot()), lastEventId: "sample" });
        self.emit("message", { data: JSON.stringify(comments()), lastEventId: "sample" });
      }, 50);
      this.timer = setInterval(function () {
        self.emit("message", { data: JSON.stringify(snapshot()), lastEventId: "sample" });
      }, 30000);
    }
    addEventListener(type, listener) {
      (this.listeners[type] || (this.listeners[type] = [])).push(listener);
    }
    removeEventListener(type, listener) {
      this.listeners[type] = (this.listeners[type] || []).filter(function (l) {
        return l !== listener;
      });
    }
    emit(type, event) {
      if (!sources.has(this)) return;
      if (typeof this["on" + type] === "function") this["on" + type](event);
      (this.listeners[type] || []).forEach(function (l) {
        l(event);
      });
    }
    close() {
      this.readyState = 2;
      clearInterval(this.timer);
      sources.delete(this);
    }
  }
  DemoEventSource.CONNECTING = 0;
  DemoEventSource.OPEN = 1;
  DemoEventSource.CLOSED = 2;
  window.EventSource = DemoEventSource;
  window.WebSocket = function () {
    throw new Error("Network disabled in sample workspace");
  };
  window.XMLHttpRequest = function () {
    throw new Error("Network disabled in sample workspace");
  };
  try {
    navigator.sendBeacon = function () {
      return false;
    };
  } catch (_) {}
  window.open = function () {
    announce("External navigation is disabled inside this sample workspace.");
    return null;
  };
  function click(selector) {
    var e = document.querySelector(selector);
    if (!e || e.disabled) return false;
    e.click();
    return true;
  }
  function selectInitial() {
    return click('.item[data-session-id="' + data.initial + '"]');
  }
  function tour(kind) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    ["workStatsClose", "forkTreeClose", "commentClose"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b && b.offsetParent !== null) b.click();
    });
    selectInitial();
    setTimeout(function () {
      if (kind === "statistics") click("#workStatsBtn");
      else if (kind === "structure") click("#forkTreeBtn");
      else if (kind === "comments") {
        if (!click("#pinTray .pincomment"))
          if (!click("#msgs .msg-comment.has-comments"))
            click('.item[data-session-id="sample-01"] .it-comment');
      } else if (kind === "analysis") click("#h-sig .state");
      else if (kind === "queue") {
        var queue = document.getElementById("queue");
        if (queue) queue.scrollIntoView({ block: "nearest" });
      }
    }, 180);
  }
  window.addEventListener("message", function (event) {
    if (
      event.source !== window.parent ||
      event.origin !== location.origin ||
      !event.data ||
      event.data.type !== "attend-demo-tour"
    )
      return;
    if (
      ["overview", "analysis", "structure", "statistics", "comments", "queue"].includes(
        event.data.view,
      )
    )
      tour(event.data.view);
  });
  document.addEventListener("DOMContentLoaded", function () {
    var style = document.createElement("style");
    style.textContent =
      "body{padding-top:31px!important;height:100dvh!important;box-sizing:border-box}.workstats,.forktree-overlay{top:31px!important}.workstats-panel{max-height:calc(100dvh - 31px - 2rem)!important}.forktree-panel{max-height:calc(100dvh - 31px - 2rem)!important}.attend-demo-banner{position:fixed;top:0;left:0;right:0;height:31px;z-index:1000;display:flex;align-items:center;justify-content:center;gap:12px;padding:0 6px;box-sizing:border-box;background:#1e293b;color:#f8fafc;font:11px/1.2 system-ui,sans-serif;letter-spacing:.01em}.attend-demo-banner strong{font-weight:750;white-space:nowrap;flex-shrink:0}.attend-demo-banner span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.attend-demo-notice{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:1100;max-width:90%;padding:10px 15px;background:#1e293b;color:white;border-radius:8px;font:12px/1.5 system-ui;box-shadow:0 4px 25px #0003}.attend-demo-notice[hidden]{display:none}";
    document.head.appendChild(style);
    var banner = document.createElement("div");
    banner.className = "attend-demo-banner";
    banner.innerHTML =
      "<strong>INTERACTIVE SAMPLE</strong><span>Synthetic data · edits in memory · sending and model calls disabled</span>";
    document.body.appendChild(banner);
    var notice = document.createElement("div");
    notice.id = "attendDemoNotice";
    notice.className = "attend-demo-notice";
    notice.setAttribute("role", "status");
    notice.hidden = true;
    document.body.appendChild(notice);
    document.addEventListener(
      "click",
      function (event) {
        var button = event.target.closest("button");
        if (
          button &&
          (["send", "commentSend", "nstart", "commentPromote", "forkStart", "forkConfirm"].includes(
            button.id,
          ) ||
            button.matches(".qsend,.qfork,.forkprimary,.nbtn-primary"))
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          denied();
        }
        var link = event.target.closest("a[href]");
        if (link) {
          event.preventDefault();
          event.stopImmediatePropagation();
          announce("Links inside this synthetic transcript do not open files or external sites.");
        }
      },
      true,
    );
    document.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          ["input", "commentInput", "np"].includes(event.target.id)
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          denied();
        }
      },
      true,
    );
    setTimeout(function () {
      selectInitial();
      window.parent.postMessage({ type: "attend-demo-ready" }, location.origin);
    }, 60);
  });
})();
