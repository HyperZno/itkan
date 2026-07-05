package com.itkan.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);

        // WebView Ayarları
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        
        // Çerezleri (Cookie) aktif et
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // Bağlantıların dış tarayıcı yerine uygulama içinde açılması için
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });

        // SUNUCU ADRESİNİZİ YAZIN
        // Not: Bilgisayarda yerel test yaparken bilgisayarınızın yerel IP adresini yazın (Örn: http://192.168.1.100:3000)
        // Canlı sunucuya geçtiğinizde alan adınızı yazın (Örn: https://itkan-kurs.com)
        webView.loadUrl("http://10.0.2.2:3000"); // 10.0.2.2 Android Emülatörü için bilgisayarın localhost adresidir.
    }

    // Android geri tuşu ile WebView geçmişinde geri gitme
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
