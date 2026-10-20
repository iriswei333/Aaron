/**
 * Adopts the UIKit scene-based life cycle on iOS.
 *
 * Apps built with the iOS 27 SDK (Xcode 27) that don't use scenes are stopped at
 * launch with "UIScene life cycle is required for apps built with this SDK".
 * Expo's prebuild template (SDK 56/57) still creates the window in the AppDelegate,
 * so this plugin:
 *   1. adds UIApplicationSceneManifest to Info.plist, pointing at SceneDelegate
 *   2. moves window creation out of AppDelegate into a SceneDelegate
 *   3. forwards deep links, universal links and app lifecycle events from the
 *      scene back to the AppDelegate so Expo modules and RN Linking keep working
 *
 * Remove once Expo's template adopts scenes natively (expo/expo#46663).
 */
const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');

const MARKER = '// [withSceneLifecycle]';

const SCENE_DELEGATE = `
${MARKER} Added by plugins/withSceneLifecycle.js - required by the iOS 27 SDK.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = appDelegate,
          let factory = appDelegate.reactNativeFactory
    else { return }

    // Under scenes, a link that cold-starts the app arrives here instead of in
    // launchOptions. Put it back so Linking.getInitialURL() / expo-router see it.
    var launchOptions = appDelegate.launchOptions ?? [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityKey": activity,
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
      ]
    }
    appDelegate.launchOptions = launchOptions

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // Expo modules and React Native look the window up on the app delegate.
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }

  // Custom-scheme links (sproutcue://...) while the app is running.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = appDelegate else { return }
    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [
        .openInPlace: context.options.openInPlace
      ]
      if let source = context.options.sourceApplication {
        options[.sourceApplication] = source
      }
      if let annotation = context.options.annotation {
        options[.annotation] = annotation
      }
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  // Universal links while the app is running.
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }

  // With scenes, UIKit stops calling the app delegate's lifecycle methods, so
  // forward them for Expo's app-delegate subscribers.
  func sceneDidBecomeActive(_ scene: UIScene) {
    UIApplication.shared.delegate?.applicationDidBecomeActive?(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    UIApplication.shared.delegate?.applicationWillResignActive?(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    UIApplication.shared.delegate?.applicationWillEnterForeground?(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    UIApplication.shared.delegate?.applicationDidEnterBackground?(UIApplication.shared)
  }
}
`;

const WINDOW_BLOCK =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n?/;

const FACTORY_PROPERTY = /(\n\s*var reactNativeFactory: RCTReactNativeFactory\?\n)/;

function applySceneLifecycleToAppDelegate(contents) {
  if (contents.includes(MARKER)) return contents;

  if (!WINDOW_BLOCK.test(contents) || !FACTORY_PROPERTY.test(contents)) {
    throw new Error(
      '[withSceneLifecycle] AppDelegate.swift does not match the expected Expo template. ' +
        'Check whether Expo now adopts the scene life cycle itself, and update or remove this plugin.'
    );
  }

  return (
    contents
      .replace(
        FACTORY_PROPERTY,
        '$1  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n'
      )
      .replace(
        WINDOW_BLOCK,
        `    self.launchOptions = launchOptions
    ${MARKER} The window is created in SceneDelegate (UIScene life cycle).
`
      )
      .trimEnd() +
    '\n' +
    SCENE_DELEGATE
  );
}

function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('[withSceneLifecycle] Only Swift AppDelegates are supported.');
    }
    cfg.modResults.contents = applySceneLifecycleToAppDelegate(cfg.modResults.contents);
    return cfg;
  });

  return config;
}

module.exports = withSceneLifecycle;
module.exports.applySceneLifecycleToAppDelegate = applySceneLifecycleToAppDelegate;
