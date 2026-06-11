import Foundation
import Capacitor
import AVKit
import UIKit

// Native AirPlay output for PhotoBeam.
//
// Add this file (and AirPlayPlugin.m) to the App target in Xcode AFTER running
// `npx cap add ios` — see SETUP.md. Capacitor discovers the plugin via the
// CAP_PLUGIN macro in the .m file.
//
// Behavior:
//   - presentRoutePicker: shows the system AirPlay picker (AVRoutePickerView).
//   - When the user picks an Apple TV / AirPlay display, iOS attaches it as an
//     external UIScreen; we render a dedicated black window + image view on it
//     (a clean TV view, NOT phone mirroring) and drive it from JS via showPhoto.
@objc(AirPlayPlugin)
public class AirPlayPlugin: CAPPlugin {
    private var externalWindow: UIWindow?
    private var imageView: UIImageView?
    private var titleLabel: UILabel?

    override public func load() {
        NotificationCenter.default.addObserver(
            self, selector: #selector(screenDidConnect(_:)),
            name: UIScreen.didConnectNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(screenDidDisconnect(_:)),
            name: UIScreen.didDisconnectNotification, object: nil)

        // A display may already be attached (e.g. mirroring was on before launch).
        if let screen = UIScreen.screens.first(where: { $0 !== UIScreen.main }) {
            DispatchQueue.main.async { self.setupExternalWindow(for: screen) }
        }
    }

    // MARK: - JS-facing methods

    @objc func presentRoutePicker(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let hostView = self.bridge?.viewController?.view else {
                call.reject("No host view available")
                return
            }
            // AVRoutePickerView placed off-screen; we trigger its button so the
            // system route sheet appears without showing our own UI chrome.
            let picker = AVRoutePickerView(frame: CGRect(x: -200, y: -200, width: 44, height: 44))
            picker.prioritizesVideoDevices = true
            hostView.addSubview(picker)
            for sub in picker.subviews {
                if let button = sub as? UIButton {
                    button.sendActions(for: .touchUpInside)
                    break
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                picker.removeFromSuperview()
            }
            call.resolve()
        }
    }

    @objc func isConnected(_ call: CAPPluginCall) {
        call.resolve(["connected": UIScreen.screens.count > 1])
    }

    @objc func showPhoto(_ call: CAPPluginCall) {
        guard let imageArg = call.getString("image") else {
            call.reject("Missing 'image'")
            return
        }
        let title = call.getString("title") ?? ""
        // Accept either a raw base64 string or a data: URL.
        let base64 = imageArg.components(separatedBy: ",").last ?? imageArg
        guard let data = Data(base64Encoded: base64), let image = UIImage(data: data) else {
            call.reject("Invalid image data")
            return
        }
        DispatchQueue.main.async {
            if self.externalWindow == nil,
               let screen = UIScreen.screens.first(where: { $0 !== UIScreen.main }) {
                self.setupExternalWindow(for: screen)
            }
            guard let iv = self.imageView else {
                call.reject("No external display connected")
                return
            }
            UIView.transition(with: iv, duration: 0.4, options: .transitionCrossDissolve,
                              animations: { iv.image = image }, completion: nil)
            self.titleLabel?.text = title
            call.resolve()
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.teardownExternalWindow()
            call.resolve()
        }
    }

    // MARK: - External screen lifecycle

    @objc private func screenDidConnect(_ notification: Notification) {
        guard let screen = notification.object as? UIScreen else { return }
        DispatchQueue.main.async { self.setupExternalWindow(for: screen) }
        notifyListeners("screenConnected", data: ["name": screen.bounds.debugDescription])
    }

    @objc private func screenDidDisconnect(_ notification: Notification) {
        DispatchQueue.main.async { self.teardownExternalWindow() }
        notifyListeners("screenDisconnected", data: [:])
    }

    private func setupExternalWindow(for screen: UIScreen) {
        guard externalWindow == nil else { return }

        let window = UIWindow(frame: screen.bounds)
        window.screen = screen

        let root = UIViewController()
        root.view.backgroundColor = .black

        let iv = UIImageView(frame: root.view.bounds)
        iv.contentMode = .scaleAspectFit
        iv.backgroundColor = .black
        iv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        root.view.addSubview(iv)

        let label = UILabel(frame: CGRect(x: 24, y: screen.bounds.height - 64,
                                          width: screen.bounds.width - 48, height: 40))
        label.textColor = UIColor(white: 1, alpha: 0.85)
        label.font = .systemFont(ofSize: 22, weight: .medium)
        label.autoresizingMask = [.flexibleWidth, .flexibleTopMargin]
        root.view.addSubview(label)

        window.rootViewController = root
        window.isHidden = false

        self.externalWindow = window
        self.imageView = iv
        self.titleLabel = label
    }

    private func teardownExternalWindow() {
        externalWindow?.isHidden = true
        externalWindow = nil
        imageView = nil
        titleLabel = nil
    }
}
