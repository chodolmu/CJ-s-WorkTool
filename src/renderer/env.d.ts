/// <reference types="vite/client" />

import type { HarnessAPI } from "../preload/index";

declare global {
  interface Window {
    harness: HarnessAPI;
  }
}
