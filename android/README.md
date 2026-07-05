# İTKAN Android WebView Uygulaması

Bu klasör, İTKAN Web uygulamanızı yerel veya canlı sunucunuz üzerinden çalıştıracak olan Android Studio projesini içermektedir. Proje, yerel HTTP isteklerine (Cleartext) izin verecek ve cookie ile giriş durumunuzu koruyacak şekilde optimize edilmiştir.

## Kurulum ve APK Oluşturma Adımları

1. **Android Studio'yu Açın**:
   - Android Studio uygulamasını açın ve **"Open"** seçeneği ile bu dizindeki `android` klasörünü seçin.
   - Gradle eşitlemesinin (Sync) tamamlanmasını bekleyin.

2. **Sunucu Adresinizi (URL) Ayarlayın**:
   - `app/src/main/java/com/itkan/app/MainActivity.java` dosyasını açın.
   - `webView.loadUrl(...)` satırındaki URL adresini kendi sunucunuza göre düzenleyin:
     - **Emülatör ile yerel test yaparken**: Bilgisayarınızın localhost'una emülatörden erişmek için varsayılan `http://10.0.2.2:3000` adresini bırakabilirsiniz.
     - **Gerçek telefon ile yerel test yaparken**: Bilgisayarınızın yerel IP adresini yazın (Örn: `http://192.168.1.100:3000`). Telefonunuz ve bilgisayarınızın aynı Wi-Fi ağına bağlı olduğundan emin olun.
     - **Uygulamayı sunucuya yüklediğinizde**: Canlı alan adınızı yazın (Örn: `https://itkan-app.example.com`).

3. **Uygulamayı Test Edin**:
   - Üst taraftaki "Run" (Yeşil Üçgen) butonuna basarak bir emülatörde veya bağlı olan gerçek Android telefonunuzda uygulamayı başlatıp test edin.

4. **APK Çıktısı (Release / Debug APK) Alın**:
   - Menüden **Build > Build Bundle(s) / APK(s) > Build APK(s)** seçeneğine tıklayın.
   - Derleme bittiğinde sağ altta çıkan bildirimdeki **"locate"** bağlantısına tıklayarak oluşturulan `.apk` dosyasını bulabilir ve telefonunuza kurup kullanabilirsiniz.
