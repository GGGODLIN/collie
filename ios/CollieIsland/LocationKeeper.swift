import CoreLocation

// Keeps the app running in the background so it can keep updating the Live Activity.
// Silent audio was tried first and dropped: liveactivitiesd refuses updates from a process that
// is "only playing background media" (Apple Developer Forums thread 748569), which matched the
// island freezing ~2-3 min after backgrounding. Background location is not an officially
// supported way either ("not explicitly supported", same thread) and may stop working with an
// iOS update. Accuracy has to be 100 m or better: an Apple engineer (forums thread 727015)
// warns that coarse accuracy plus a distance filter can get the app suspended since iOS 16.4,
// so this costs more battery than the 3 km setting it replaced. The blue location arrow is off
// only under "Always" with showsBackgroundLocationIndicator = false and no activity session
// (Technical Q&A QA1965).
@MainActor
final class LocationKeeper: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var session: CLBackgroundActivitySession?
  private(set) var running = false

  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    manager.distanceFilter = kCLDistanceFilterNone
    manager.pausesLocationUpdatesAutomatically = false
    manager.showsBackgroundLocationIndicator = false
  }

  var authorization: String {
    switch manager.authorizationStatus {
    case .authorizedAlways: return "always"
    case .authorizedWhenInUse: return "whenInUse"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "?"
    }
  }

  func start() {
    switch manager.authorizationStatus {
    case .notDetermined, .authorizedWhenInUse:
      // "Always" is what lets a background launch (RestartIslandIntent) start updates; with
      // only "While Using" the keeper works after a foreground open but not after a restart.
      manager.requestAlwaysAuthorization()
    default:
      break
    }
    guard manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse
    else {
      DiagLog.write("location not authorised (\(authorization)); background keep-alive off")
      return
    }
    // A CLBackgroundActivitySession always shows the blue location arrow, and that arrow takes
    // the Dynamic Island away from our Live Activity (seen 2026-09-26). With "Always" it is not
    // needed, so it is held only under "While Using", where background updates require it.
    if manager.authorizationStatus == .authorizedWhenInUse {
      if session == nil { session = CLBackgroundActivitySession() }
    } else {
      session?.invalidate()
      session = nil
    }
    manager.allowsBackgroundLocationUpdates = true
    manager.startUpdatingLocation()
    if !running { DiagLog.write("location keep-alive started (\(authorization))") }
    running = true
  }

  nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    MainActor.assumeIsolated {
      DiagLog.write("location authorisation -> \(authorization)")
      if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse {
        start()
      }
    }
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    MainActor.assumeIsolated { DiagLog.write("location error \(error.localizedDescription)") }
  }
}
