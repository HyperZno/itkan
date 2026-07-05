# İTKAN - Akıllı Sınıf, Öğrenci ve Ödevlendirme Sistemi

İTKAN, modern eğitim kurumları ve kurslar için tasarlanmış; sınıf yönetimi, kişi bazlı ödev takibi, yoklama kayıtları ve veli bilgilendirme süreçlerini tek bir çatı altında toplayan premium **Indigo Glassmorphic** temalı web ve Android tabanlı bir yönetim otomasyonudur.

---

## 🚀 Öne Çıkan Özellikler

### 1. 🗂️ Öğrenci ve Sınıf Yönetimi
- **Merkezi Öğrenciler Portalı**: Tüm öğrencileri listeleyebileceğiniz, yaş ve sınıf filtreli, anlık arama (instant-search) çubuğuna sahip tek sayfa yönetim sistemi.
- **Kademeli Okul Sınıfı Seçimi**: Öğrenciler için 1. sınıftan 12. sınıfa kadar okul sınıf seçimi ve "Yok / Mezun" desteği.
- **Esnek Kayıt Girişi**: Öğrenci formlarındaki tüm zorunlu alanlar kaldırılmıştır. Doldurulmayan alanlar sistem tarafından otomatik olarak varsayılan değerlerle (TC: `11111111111`, Veli: `Belirtilmedi`, Telefon: `5555555555`) doldurulur.
- **Açılır-Kapanır (Collapsible) Formlar**: Sayfa karmaşıklığını önleyen, akıcı animasyonlu açılır-kapanır yeni öğrenci ekleme kartları.

### 2. 📖 Kişi Bazlı Gelişmiş Ödevlendirme
- **Diyanet Elifba Entegrasyonu**: Diyanet İşleri Başkanlığı Elifba müfredatına uygun tam 30 derslik ders listesi.
- **Sayfa ve Satır Aralığı Seçici**: Ödev notlandırma aşamasında "Sayfanın Tamamı", "Sayfanın Yarısı", "1. Satır", "2. Satır" gibi aralıkları tek tıkla seçerek otomatik açıklama metni oluşturma desteği.
- **Kişi Bazlı Takip**: Sınıf geneli yerine tamamen öğrenci özelinde atanabilen, durumu ("Çalışıyor", "Ezberledi", "Başlamadı") anlık güncellenebilen esnek ödev yapısı.

### 3. 📅 Akıllı Yoklama ve Bildirim Eklentileri
- **İnteraktif Yoklama Takvimi**: Sınıfa özel, geçmiş yoklama durumlarını yeşil noktalarla işaretleyen ve geçmişe dönük yoklama almayı/düzenlemeyi sağlayan özel takvim arayüzü.
- **Veli WhatsApp Bildirim Eklentisi**: Derse katılmayan öğrencilerin velilerine, telefon numaralarını otomatik temizleyerek tek tıkla profesyonel ve düzenli WhatsApp şablonları gönderen bildirim motoru.
- **Müdür Bilgilendirme Kopyalama Tuşu**: Gelmeyen öğrenci, veli adı ve telefon bilgilerini müdürün hızlıca arama yapabilmesi için tek tıkla panoya kopyalayan akıllı kopyalama butonu.

### 4. 🔒 Güvenlik ve Yetkilendirme
- **Tek Seferlik Şifre Değiştirme**: Öğretmen hesapları ilk açıldığında veya şifreleri sıfırlandığında güvenlik amacıyla sadece 1 kez şifre değiştirme hakkına sahiptir. Sonrasında şifre yönetimi sadece Süper Admin yetkisindedir.
- **Süper Admin Yönetim Paneli**: Yetkili ekleme, silme ve şifre sıfırlama işlemlerini gerçekleştirebileceğiniz gelişmiş yönetim alanı.

### 5. 📱 Android Uygulaması
- **Native WebView Wrapper**: Uygulamayı telefonunuzda tam ekran çalıştırmak için çerez (session cookie) korumalı, JavaScript ve DOM Storage aktif, geri tuşu destekli Android Studio projesi.

---

## 🛠️ Teknoloji Yığını

- **Backend**: Node.js & Express.js
- **Database**: SQLite3 (`better-sqlite3` entegrasyonu ve otomatik göç mekanizması)
- **Frontend**: HTML5, EJS (Embedded JavaScript) Templates & Vanilla CSS3
- **Mobil**: Android Studio (Java, Gradle 8.5, SDK 34)

---

## 📦 Kurulum ve Çalıştırma

### 1. Gereksinimler
- Node.js (v16+)
- NPM
- SQLite3

### 2. Adımlar
Proje dizininde terminali açıp aşağıdaki komutları çalıştırın:

```bash
# Bağımlılıkları yükleyin
npm install

# Uygulamayı başlatın (Veritabanı ve tablolar otomatik oluşturulacaktır)
npm start
```

Tarayıcınızdan **`http://localhost:3000`** adresine giderek uygulamaya erişebilirsiniz.

### 🔑 Varsayılan Giriş Bilgileri
- **Kullanıcı Adı**: `admin`
- **Şifre**: `admin123`

---

## 📱 Android APK Derleme
1. [android](file:///Users/bunyaminkizilkaya/Downloads/Ashab%C4%B1%20Suffa/%C4%B0TKAN/android) klasörünü Android Studio ile açın.
2. `MainActivity.java` içindeki `loadUrl` adresine kendi sunucu adresinizi yazın.
3. **Build > Build Bundle(s) / APK(s) > Build APK(s)** adımlarını takip ederek APK dosyanızı oluşturun.
