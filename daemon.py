"""attend — local web dashboard for brief-based AI session management.

session = cache, brief = state.
vendor (Claude / Codex) = replaceable backend, vault = substrate.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import yaml
from flask import Flask, render_template, request

# ----- config -----

HOME = Path.home()

CONFIG = {
    "vault_roots": [
        HOME / "OneDrive" / "notes",
        Path("D:/workspace/projects"),
    ],
    "claude_projects": HOME / ".claude" / "projects",
    "codex_sessions": HOME / ".codex" / "sessions",
    "memory_file": HOME / ".claude" / "projects" / "c--Users-sinph-OneDrive-notes" / "memory" / "MEMORY.md",
    "port": 5050,
    "scan_depth": 6,
}

# ----- brief scanning -----

def parse_brief(path):
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    fm = {}
    body = text
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end > 0:
            try:
                fm = yaml.safe_load(text[3:end]) or {}
            except yaml.YAMLError:
                fm = {}
            body = text[end + 4:].lstrip()
    sections = {}
    current = None
    buf = []
    for line in body.splitlines():
        m = re.match(r"^#+\s+(\S+)", line)
        if m:
            if current is not None:
                sections[current] = "\n".join(buf).strip()
            current = m.group(1).lower()
            buf = []
        else:
            buf.append(line)
    if current is not None:
        sections[current] = "\n".join(buf).strip()
    project_dir = path.parent
    return {
        "path": str(path),
        "project_dir": str(project_dir),
        "name": project_dir.name,
        "front_matter": fm,
        "what": sections.get("what", ""),
        "accept": sections.get("accept", ""),
        "next": sections.get("next", ""),
        "status": (fm.get("status") or "active"),
        "defer_until": fm.get("defer_until"),
    }

def scan_vault():
    briefs = []
    seen = set()
    for root in CONFIG["vault_roots"]:
        if not root.exists():
            continue
        for path in root.rglob("brief.md"):
            sp = str(path).lower()
            if sp in seen:
                continue
            seen.add(sp)
            b = parse_brief(path)
            if b:
                briefs.append(b)
    return briefs

# ----- claude telemetry -----

def _parse_ts(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None

def _scan_claude_sessions():
    """Yield (jsonl_path, cwd, first_ts, last_ts, prompt_count, action_count)."""
    root = CONFIG["claude_projects"]
    if not root.exists():
        return
    for proj_dir in root.iterdir():
        if not proj_dir.is_dir():
            continue
        for jsonl in proj_dir.glob("*.jsonl"):
            cwd = None
            first_ts = None
            last_ts = None
            prompts = 0
            actions = 0
            try:
                with jsonl.open(encoding="utf-8") as f:
                    for line in f:
                        try:
                            obj = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        if cwd is None and obj.get("cwd"):
                            cwd = obj["cwd"]
                        ts = _parse_ts(obj.get("timestamp"))
                        if ts:
                            if first_ts is None:
                                first_ts = ts
                            last_ts = ts
                        t = obj.get("type")
                        if t == "user":
                            msg = obj.get("message") or {}
                            content = msg.get("content") if isinstance(msg, dict) else None
                            if isinstance(content, str) and content.strip() and not content.startswith("<"):
                                prompts += 1
                            elif isinstance(content, list):
                                for c in content:
                                    if isinstance(c, dict) and c.get("type") == "text":
                                        prompts += 1
                                        break
                        elif t == "assistant":
                            msg = obj.get("message") or {}
                            if isinstance(msg, dict):
                                for c in msg.get("content", []) or []:
                                    if isinstance(c, dict) and c.get("type") == "tool_use":
                                        name = c.get("name", "")
                                        if name in ("Edit", "Write", "NotebookEdit", "Bash", "PowerShell"):
                                            actions += 1
            except OSError:
                continue
            yield {
                "path": str(jsonl),
                "cwd": cwd,
                "first_ts": first_ts,
                "last_ts": last_ts,
                "prompts": prompts,
                "actions": actions,
            }

_SESSION_CACHE = {"ts": None, "data": []}

def get_claude_sessions():
    """Cheap in-process cache to avoid re-scanning JSONL on every refresh."""
    now = datetime.now()
    if _SESSION_CACHE["ts"] and (now - _SESSION_CACHE["ts"]).total_seconds() < 30:
        return _SESSION_CACHE["data"]
    data = list(_scan_claude_sessions())
    _SESSION_CACHE["ts"] = now
    _SESSION_CACHE["data"] = data
    return data

def telemetry_for_brief(brief, sessions):
    """Aggregate sessions whose cwd contains or equals the brief's project_dir."""
    proj = Path(brief["project_dir"]).resolve()
    matched = []
    for s in sessions:
        if not s["cwd"]:
            continue
        try:
            cwd = Path(s["cwd"]).resolve()
        except OSError:
            continue
        try:
            proj.relative_to(cwd)
            matched.append(s)
            continue
        except ValueError:
            pass
        try:
            cwd.relative_to(proj)
            matched.append(s)
        except ValueError:
            pass
    if not matched:
        return {
            "sessions": 0,
            "prompts": 0,
            "actions": 0,
            "total_minutes": 0,
            "avg_session_min": None,
            "last_action_age_days": None,
            "last_touch": None,
            "last_touch_age_days": None,
        }
    total_min = 0.0
    durations = []
    last_action_ts = None
    last_touch_ts = None
    for s in matched:
        if s["first_ts"] and s["last_ts"]:
            d = (s["last_ts"] - s["first_ts"]).total_seconds() / 60
            total_min += d
            durations.append(d)
        if s["last_ts"] and (last_touch_ts is None or s["last_ts"] > last_touch_ts):
            last_touch_ts = s["last_ts"]
        if s["actions"] > 0 and s["last_ts"]:
            if last_action_ts is None or s["last_ts"] > last_action_ts:
                last_action_ts = s["last_ts"]
    now = datetime.now(timezone.utc)
    return {
        "sessions": len(matched),
        "prompts": sum(s["prompts"] for s in matched),
        "actions": sum(s["actions"] for s in matched),
        "total_minutes": total_min,
        "avg_session_min": (sum(durations) / len(durations)) if durations else None,
        "last_action_age_days": ((now - last_action_ts).days if last_action_ts else None),
        "last_touch": (last_touch_ts.isoformat() if last_touch_ts else None),
        "last_touch_age_days": ((now - last_touch_ts).days if last_touch_ts else None),
    }

def classify_pattern(tel):
    s = tel["sessions"]
    a = tel["actions"]
    p = tel["prompts"]
    avg = tel["avg_session_min"]
    age = tel["last_action_age_days"]
    touch_age = tel["last_touch_age_days"]
    if s == 0:
        return "fresh"
    if p >= 5 and a == 0:
        return "avoidance"
    if a == 0 and touch_age is not None and touch_age >= 7:
        return "stalled"
    if a > 0 and avg and avg >= 10 and touch_age is not None and touch_age <= 3:
        return "healthy"
    if a > 0:
        return "active"
    return "unknown"

# ----- memory & priority -----

_MEMORY_CACHE = {"ts": None, "keywords": []}

def load_memory_keywords():
    now = datetime.now()
    if _MEMORY_CACHE["ts"] and (now - _MEMORY_CACHE["ts"]).total_seconds() < 60:
        return _MEMORY_CACHE["keywords"]
    memfile = CONFIG["memory_file"]
    if not memfile.exists():
        return []
    try:
        text = memfile.read_text(encoding="utf-8")
    except OSError:
        return []
    cjk = re.findall(r"[一-鿿]{2,}", text)
    latin = re.findall(r"\b[A-Za-z][A-Za-z0-9_-]{3,}\b", text)
    stop = {"the", "and", "with", "this", "that", "from", "have", "will",
            "name", "description", "metadata", "type", "memory", "file"}
    keywords = list({w for w in cjk + latin if w.lower() not in stop})
    _MEMORY_CACHE["ts"] = now
    _MEMORY_CACHE["keywords"] = keywords
    return keywords

def evaluate_priority(brief, tel, memory_keywords):
    blob = " ".join([brief["name"], brief["what"], brief["next"]]).lower()
    score = 0.0
    reasons = []
    kw_hits = sum(1 for k in memory_keywords if k.lower() in blob)
    if kw_hits:
        bonus = min(kw_hits, 5) * 2
        score += bonus
        reasons.append(f"memory aligned ({kw_hits})")
    pattern = classify_pattern(tel)
    if pattern == "avoidance":
        score += 4
        reasons.append("avoidance signal — needs decision, not work")
    elif pattern == "stalled":
        score += 3
        reasons.append("stalled — needs unblock or kill")
    elif pattern == "fresh":
        score += 1
        reasons.append("fresh — no entries yet")
    elif pattern == "active":
        score += 0.5
    elif pattern == "healthy":
        score -= 1
        reasons.append("healthy — in flow, don't interrupt")
    if brief["status"] == "deferred":
        if brief["defer_until"]:
            reasons.append(f"deferred until {brief['defer_until']}")
        else:
            reasons.append("deferred without condition")
        score -= 2
    elif brief["status"] == "done":
        score = -100.0
        reasons.append("done")
    nxt = (brief["next"] or "").lower()
    if any(k in nxt for k in ["卡", "block", "stuck", "等"]):
        score += 1
        reasons.append("explicit blocker in next")
    return score, "; ".join(reasons) or "no signal", pattern

# ----- spawn -----

def _quote(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

def spawn_command(brief, vendor):
    project = brief["project_dir"]
    summary = brief["what"].strip()
    nxt = brief["next"].strip()
    parts = []
    if summary:
        parts.append(summary)
    if nxt:
        parts.append(f"\\n\\nNext: {nxt}")
    body = _quote("".join(parts))
    if vendor == "claude":
        return f'cd "{project}"\nclaude "{body}"'
    if vendor == "codex":
        return f'cd "{project}"\ncodex "{body}"'
    return ""

# ----- flask -----

app = Flask(__name__, template_folder=str(Path(__file__).parent / "templates"))

@app.route("/")
def feed():
    briefs = scan_vault()
    sessions = get_claude_sessions()
    memory_keywords = load_memory_keywords()
    ranked = []
    for b in briefs:
        tel = telemetry_for_brief(b, sessions)
        score, reason, pattern = evaluate_priority(b, tel, memory_keywords)
        ranked.append({"brief": b, "tel": tel, "score": score,
                       "reason": reason, "pattern": pattern})
    ranked.sort(key=lambda r: -r["score"])
    counts = {}
    for r in ranked:
        counts[r["pattern"]] = counts.get(r["pattern"], 0) + 1
    return render_template("feed.html", ranked=ranked, counts=counts,
                           memory_keywords=len(memory_keywords))

@app.route("/brief")
def brief_detail():
    path = request.args.get("path")
    if not path:
        return "missing path", 400
    p = Path(path)
    if not p.exists():
        return "not found", 404
    b = parse_brief(p)
    if not b:
        return "parse failed", 500
    sessions = get_claude_sessions()
    tel = telemetry_for_brief(b, sessions)
    score, reason, pattern = evaluate_priority(b, tel, load_memory_keywords())
    matched = []
    proj = Path(b["project_dir"]).resolve()
    for s in sessions:
        if not s["cwd"]:
            continue
        try:
            cwd = Path(s["cwd"]).resolve()
        except OSError:
            continue
        matches = False
        try:
            proj.relative_to(cwd)
            matches = True
        except ValueError:
            try:
                cwd.relative_to(proj)
                matches = True
            except ValueError:
                pass
        if matches:
            matched.append(s)
    matched.sort(key=lambda s: s["last_ts"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return render_template("detail.html", brief=b, telemetry=tel, pattern=pattern,
                           score=score, reason=reason, sessions=matched[:10],
                           spawn_claude=spawn_command(b, "claude"),
                           spawn_codex=spawn_command(b, "codex"))

def main():
    print(f"attend — running at http://localhost:{CONFIG['port']}")
    print("vault roots:")
    for r in CONFIG["vault_roots"]:
        marker = "✓" if r.exists() else "✗"
        print(f"  {marker} {r}")
    print(f"claude projects: {CONFIG['claude_projects']} "
          f"({'✓' if CONFIG['claude_projects'].exists() else '✗'})")
    print(f"codex sessions: {CONFIG['codex_sessions']} "
          f"({'✓' if CONFIG['codex_sessions'].exists() else '✗ (skipped)'})")
    app.run(host="127.0.0.1", port=CONFIG["port"], debug=False)

if __name__ == "__main__":
    main()
