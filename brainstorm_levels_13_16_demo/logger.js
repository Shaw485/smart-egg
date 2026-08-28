(function (root) {
  'use strict';

  const REDACT_PATTERN = /password|token|secret|authorization|cookie|session_key|openid/i;
  const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

  function safeClone(value, depth) {
    if (depth > 5) return '[depth-limit]';
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.length > 500 ? value.slice(0, 500) + '…' : value;
    if (Array.isArray(value)) return value.slice(0, 50).map(function (item) { return safeClone(item, depth + 1); });
    if (typeof value === 'object') {
      const out = {};
      Object.keys(value).slice(0, 80).forEach(function (key) {
        out[key] = REDACT_PATTERN.test(key) ? '[redacted]' : safeClone(value[key], depth + 1);
      });
      return out;
    }
    return String(value);
  }

  class RoundTwoLogger {
    constructor(options) {
      const opts = options || {};
      this.version = opts.version || 'dev';
      this.maxEntries = Math.max(100, opts.maxEntries || 1000);
      this.minLevel = opts.minLevel || 'info';
      this.modules = new Map();
      this.entries = [];
      this.sessionId = 'round2-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      this.startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    }
    setModule(name, enabled) { this.modules.set(name, enabled !== false); }
    setLevel(level) { if (LEVELS[level] != null) this.minLevel = level; }
    isEnabled(module, level) {
      return this.modules.get(module) !== false && LEVELS[level || 'info'] >= LEVELS[this.minLevel];
    }
    log(module, event, context, level) {
      const resolvedLevel = level || 'info';
      if (!this.isEnabled(module, resolvedLevel)) return null;
      const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const entry = {
        ts: new Date().toISOString(),
        elapsed_ms: Math.round(now - this.startedAt),
        session_id: this.sessionId,
        trace_id: this.sessionId,
        runtime_side: 'client',
        module: module,
        level: resolvedLevel,
        event: event,
        context: safeClone(context || {}, 0)
      };
      this.entries.push(entry);
      if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
      const method = resolvedLevel === 'error' ? 'error' : resolvedLevel === 'warn' ? 'warn' : 'info';
      if (typeof console !== 'undefined' && console[method]) console[method]('[ROUND2 ' + module + '/' + event + ']', entry.context);
      return entry;
    }
    snapshot() {
      return {
        schema: 'guaiqi-round2-log-v1',
        version: this.version,
        session_id: this.sessionId,
        generated_at: new Date().toISOString(),
        retention: { max_entries: this.maxEntries, current_entries: this.entries.length, persistence: 'memory-only' },
        module_filters: Object.fromEntries(this.modules),
        privacy: { sensitive_fields_redacted: true },
        entries: this.entries.slice()
      };
    }
    download(filename) {
      const blob = new Blob([JSON.stringify(this.snapshot(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || ('guaiqi-round2-' + Date.now() + '.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
  }

  root.GuaiqiRoundTwoLogger = RoundTwoLogger;
  if (typeof module !== 'undefined' && module.exports) module.exports = { RoundTwoLogger, safeClone };
})(typeof window !== 'undefined' ? window : globalThis);
