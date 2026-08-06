import { monitorEventLoopDelay, performance } from "node:perf_hooks";

const MAX_ROUTE_SAMPLES = 256;

interface RouteStats {
  count: number;
  totalMs: number;
  maxMs: number;
  samples: number[];
}

export interface RuntimePerformanceSnapshot {
  uptimeMs: number;
  eventLoop: {
    minMs: number;
    maxMs: number;
    meanMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  routes: Record<
    string,
    {
      count: number;
      meanMs: number;
      maxMs: number;
      p95Ms: number;
      p99Ms: number;
    }
  >;
}

function milliseconds(nanoseconds: number): number {
  if (!Number.isFinite(nanoseconds) || nanoseconds < 0) return 0;
  return Math.round((nanoseconds / 1_000_000) * 100) / 100;
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

/** Low-overhead runtime telemetry used by the performance regression harness. */
export class RuntimePerformanceMonitor {
  private readonly startedAt = performance.now();
  private readonly eventLoop = monitorEventLoopDelay({ resolution: 10 });
  private readonly routes = new Map<string, RouteStats>();

  constructor() {
    this.eventLoop.enable();
  }

  recordRoute(route: string, durationMs: number): void {
    const current = this.routes.get(route) ?? {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      samples: [],
    };
    current.count += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    current.samples.push(durationMs);
    if (current.samples.length > MAX_ROUTE_SAMPLES) current.samples.shift();
    this.routes.set(route, current);
  }

  snapshot(): RuntimePerformanceSnapshot {
    return {
      uptimeMs: Math.round(performance.now() - this.startedAt),
      eventLoop: {
        minMs: milliseconds(this.eventLoop.min),
        maxMs: milliseconds(this.eventLoop.max),
        meanMs: milliseconds(this.eventLoop.mean),
        p50Ms: milliseconds(this.eventLoop.percentile(50)),
        p95Ms: milliseconds(this.eventLoop.percentile(95)),
        p99Ms: milliseconds(this.eventLoop.percentile(99)),
      },
      routes: Object.fromEntries(
        [...this.routes].map(([route, stats]) => [
          route,
          {
            count: stats.count,
            meanMs: Math.round((stats.totalMs / stats.count) * 100) / 100,
            maxMs: Math.round(stats.maxMs * 100) / 100,
            p95Ms: Math.round(percentile(stats.samples, 0.95) * 100) / 100,
            p99Ms: Math.round(percentile(stats.samples, 0.99) * 100) / 100,
          },
        ]),
      ),
    };
  }

  close(): void {
    this.eventLoop.disable();
  }
}
