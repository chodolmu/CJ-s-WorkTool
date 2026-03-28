import { BrowserWindow } from "electron";

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
};

/**
 * 에러 분류 및 대응 전략
 */
export function classifyError(error: unknown): {
  type: "rate_limit" | "network" | "crash" | "build_fail" | "unknown";
  retryable: boolean;
  message: string;
} {
  const msg = String(error).toLowerCase();

  if (msg.includes("rate limit") || msg.includes("429") || msg.includes("too many")) {
    return { type: "rate_limit", retryable: true, message: "API rate limit reached. Waiting before retry..." };
  }

  if (msg.includes("enotfound") || msg.includes("network") || msg.includes("fetch failed") || msg.includes("econnrefused")) {
    return { type: "network", retryable: true, message: "Network connection issue. Check your internet." };
  }

  if (msg.includes("exited with code") || msg.includes("sigterm") || msg.includes("sigkill")) {
    return { type: "crash", retryable: true, message: "Agent process crashed. Attempting restart..." };
  }

  if (msg.includes("build") && (msg.includes("error") || msg.includes("fail"))) {
    return { type: "build_fail", retryable: false, message: "Build failed. Evaluator will handle this." };
  }

  return { type: "unknown", retryable: false, message: String(error) };
}

/**
 * 재시도 로직 (지수 백오프)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY,
  onRetry?: (attempt: number, delay: number, error: unknown) => void,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const classified = classifyError(error);

      if (!classified.retryable || attempt === config.maxRetries) {
        throw error;
      }

      // 지수 백오프 (rate limit은 더 긴 대기)
      const baseDelay = classified.type === "rate_limit"
        ? config.baseDelayMs * 5
        : config.baseDelayMs;
      const delay = Math.min(baseDelay * Math.pow(2, attempt), config.maxDelayMs);

      onRetry?.(attempt + 1, delay, error);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 데스크톱 알림 전송 (에러용)
 */
export function notifyError(title: string, body: string): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send("agent:activity", {
      agentId: "system",
      eventType: "error",
      message: `${title}: ${body}`,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
