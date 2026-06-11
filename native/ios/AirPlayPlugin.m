#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registers the Swift AirPlayPlugin with Capacitor under the JS name "AirPlay".
// Add this file alongside AirPlayPlugin.swift in the App target after
// `npx cap add ios` (see SETUP.md).
CAP_PLUGIN(AirPlayPlugin, "AirPlay",
  CAP_PLUGIN_METHOD(presentRoutePicker, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(isConnected, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(showPhoto, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(disconnect, CAPPluginReturnPromise);
)
