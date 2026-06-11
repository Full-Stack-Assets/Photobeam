// Web fallback for the AirPlay plugin. Browsers cannot enumerate AirPlay
// devices or render to an external Apple TV screen, so every method fails
// loudly (or no-ops) rather than pretending a TV is connected.

import { WebPlugin } from "@capacitor/core";

export class AirPlayWeb extends WebPlugin {
  async presentRoutePicker() {
    throw this.unavailable("AirPlay is only available on a physical iOS device.");
  }

  async isConnected() {
    return { connected: false };
  }

  async showPhoto() {
    // No external screen in the browser — nothing to do.
    return;
  }

  async disconnect() {
    return;
  }
}
