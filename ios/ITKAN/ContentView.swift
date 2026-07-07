import SwiftUI
import WebKit
import CoreLocation
import UserNotifications

class PermissionManager: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    
    func requestPermissions() {
        // Bildirim izinlerini iste
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                print("Bildirim izni onaylandı.")
                self.scheduleDailyAttendanceReminder()
            } else if let error = error {
                print("Bildirim izni hatası: \(error.localizedDescription)")
            }
        }
        
        // Konum izinlerini iste
        locationManager.delegate = self
        locationManager.requestAlwaysAuthorization()
    }
    
    private func scheduleDailyAttendanceReminder() {
        let content = UNMutableNotificationContent()
        content.title = "Yoklama Hatırlatması"
        content.body = "Bugünkü ders yoklamasını almayı unutmayın!"
        content.sound = .default
        
        var dateComponents = DateComponents()
        dateComponents.hour = 13
        dateComponents.minute = 0
        
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        let request = UNNotificationRequest(identifier: "AttendanceReminder", content: content, trigger: trigger)
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Bildirim programlama hatası: \(error)")
            } else {
                print("Her gün saat 13:00 için yoklama hatırlatıcısı kuruldu.")
            }
        }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        let webConfiguration = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: webConfiguration)
        webView.allowsBackForwardNavigationGestures = true
        
        webView.evaluateJavaScript("navigator.userAgent") { (result, error) in
            if let userAgent = result as? String {
                webView.customUserAgent = userAgent + " ITKAN_APP_V2"
            }
        }
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        let request = URLRequest(url: url)
        uiView.load(request)
    }
}

struct ContentView: View {
    private let permissionManager = PermissionManager()
    
    var body: some View {
        WebView(url: URL(string: "https://itkan-nu.vercel.app")!)
            .edgesIgnoringSafeArea(.bottom)
            .background(Color(red: 11/255, green: 59/255, blue: 58/255))
            .onAppear {
                permissionManager.requestPermissions()
            }
    }
}
