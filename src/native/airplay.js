// Real AirPlay output plugin (JS side).
//
// On iOS this is backed by the native AirPlayPlugin (Swift) registered under
// the name "AirPlay". The native side:
//   - presentRoutePicker(): opens the system AVRoutePickerView so the user
//     picks a real AirPlay device (Apple TV, AirPlay-capable TV).
//   - emits "screenConnected" / "screenDisconnected" when an external display
//     attaches/detaches (UIScreen.didConnect/didDisconnect).
//   - showPhoto({ image, title }): renders the photo on a dedicated UIWindow
//     bound to the external screen (a real TV-optimized view, not mirroring).
//   - disconnect(): tears the external window down.
//
// On web (browser dev) there is no AirPlay; the stub reports "unsupported" so
// the UI can show an honest message instead of faking a connection.

import { registerPlugin, Capacitor } from "@capacitor/core";

const AirPlay = registerPlugin("AirPlay", {
  web: () => import("./airplay-web").then((m) => new m.AirPlayWeb()),
});

// AirPlay external-screen output is only available on iOS hardware.
export const isAirPlaySupported = () => Capacitor.getPlatform() === "ios";

export default AirPlay;
