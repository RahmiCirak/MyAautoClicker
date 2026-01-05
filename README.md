# Sequential Auto Clicker (Chrome Extension)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)

**Sequential Auto Clicker**, web otomasyonu, test süreçleri ve veri girişi görevlerini kolaylaştırmak için tasarlanmış, **Manifest V3** standartlarına uygun, yüksek performanslı bir Chrome eklentisidir.

Bu proje, modern web teknolojileri (JavaScript ES6+, Chrome Extension API) kullanılarak geliştirilmiş olup, dinamik web sitelerinde dahi kararlı çalışabilen akıllı algoritmalarla donatılmıştır.

---

## 📑 İçindekiler

- [Özellikler](#-özellikler)
- [Teknik Mimari](#-teknik-mimari)
- [Kurulum](#-kurulum)
- [Kullanım Kılavuzu](#-kullanım-kılavuzu)
- [Dizin Yapısı](#-dizin-yapısı)
- [Geliştirici Notları](#-geliştirici-notları)

---

## 🚀 Özellikler

*   **Akıllı Seçici (Smart Selector)**: Dinamik olarak değişen DOM yapılarında bile öğeleri hatasız bulabilen "Shortest Unique Path" (En Kısa Benzersiz Yol) algoritması. `data-testid`, `aria-label` gibi kararlı nitelikleri önceliklendirir.
*   **Görsel Seçim Modu (Visual Picker)**: Kod yazmanıza gerek kalmadan, doğrudan sayfa üzerindeki öğelere tıklayarak seçim yapmanızı sağlayan interaktif arayüz.
*   **Gelişmiş Döngü Kontrolü**: İşlemleri sonsuz döngüde veya belirlenen tekrar sayısında çalıştırabilme yeteneği.
*   **Hassas Gecikme Yönetimi**: Tıklamalar arasında milisaniye cinsinden ayarlanabilir bekleme süreleri (Non-blocking async delay).
*   **İnsan Benzeri Etkileşim**: Sadece `click()` olayını değil, tam bir `mousedown` -> `mouseup` -> `click` zincirini simüle ederek React/Angular/Vue tabanlı sitelerle tam uyumluluk.
*   **Koordinat Desteği**: CSS seçicilerinin yetersiz kaldığı durumlar için X,Y koordinat tabanlı tıklama.

---

## 🏗️ Teknik Mimari

Bu proje, Chrome'un izole edilmiş bileşen mimarisine (Isolated World Architecture) dayanır.

### 1. Kullanıcı Arayüzü (UI Layer)
*   **Dosyalar**: `popup.html`, `popup.css`, `popup.js`
*   **Görevi**: Kullanıcı konfigürasyonunu (seçiciler, süre, döngü ayarları) alır ve `chrome.storage` API üzerinden kalıcı olarak saklar. Web sayfasıyla doğrudan iletişim kurmaz; bir "Köprü" görevi görür.

### 2. İş Mantığı Katmanı (Business Logic / Driver)
*   **Dosya**: `content.js`
*   **Görevi**: Hedef web sayfasına enjekte edilir ve DOM (Document Object Model) üzerinde işlem yapar.
*   **Algoritma**: 
    *   **Selector Engine**: Hedef öğeyi bulmak için önce ID, sonra özel nitelikler (attributes), en son yapısal konum (nth-of-type) analizi yapar. 
    *   **Event Loop**: JavaScript'in `async/await` yapısını kullanarak ana iş parçacığını (main thread) kilitlemeden zamanlama yönetimi sağlar.

### 3. İletişim Protokolü (Messaging)
*   UI ve İş Mantığı katmanları arasında `chrome.runtime.sendMessage` ve `chrome.tabs.sendMessage` metodları kullanılarak asenkron veri paketleri taşınır.

---

## 📥 Kurulum

Bu eklenti, geliştirme aşamasında olduğu için "Unpacked" (Paketlenmemiş) modda yüklenir.

1.  Bu proje klasörünü bilgisayarınıza indirin.
2.  Chrome tarayıcısında adres çubuğuna `chrome://extensions/` yazın.
3.  Sağ üst köşedeki **Geliştirici modu (Developer mode)** anahtarını **AÇIK** konuma getirin.
4.  Sol üstte beliren **Paketlenmemiş öğe yükle (Load unpacked)** butonuna tıklayın.
5.  İndirdiğiniz proje klasörünü (`MyAautoClıcker`) seçin.

Eklenti başarıyla yüklendiğinde araç çubuğunuzda ikonu belirecektir.

---

## 📖 Kullanım Kılavuzu

### 1. Öğeleri Seçme
Otomasyona başlamadan önce tıklanacak öğeleri belirlemeniz gerekir.
*   **Seçici Modu (Önerilen)**: Eklentiyi açın ve `+ Pick Element` butonuna tıklayın. Sayfa üzerinde tıklamak istediğiniz öğenin üzerine gelin (sarı çerçeve ile vurgulanır) ve tıklayın. Seçici otomatik olarak listeye eklenecektir.
*   **Manuel Mod**: CSS seçicilerini (örn: `#login-button`, `.submit-form`) alt alta metin kutusuna yapıştırın.

### 2. Ayarlar
*   **Delay (ms)**: İki tıklama arasında beklenecek süre. (Örn: `1000` = 1 saniye).
*   **Smart Selectors**: Bu kutu işaretliyse (varsayılan), eklenti en kararlı seçiciyi bulmaya çalışır.
*   **Loop**:
    *   **Infinite**: İşlemi siz durdurana kadar sonsuza dek tekrarlar.
    *   **Repeats**: Belirlediğiniz sayı kadar tur atar ve durur.

### 3. Başlatma
`Start` butonuna basın. Eklenti simge durumuna küçülse bile arkaplanda çalışmaya devam edecektir. İşlemi durdurmak için eklentiyi tekrar açıp `Stop` butonuna basabilirsiniz.

---

## 📂 Dizin Yapısı

```bash
MyAautoClıcker/
├── manifest.json       # Konfigürasyon ve İzinler (Linker Script)
├── popup.html          # Arayüz İskeleti
├── popup.css           # Arayüz Stilleri (Dark Theme)
├── popup.js            # Arayüz Kontrolcüsü (HMI Logic)
├── content.js          # DOM Manipülasyonu ve Algoritmalar (Driver)
└── README.md           # Proje Dokümantasyonu
```

---

## 👨‍💻 Geliştirici Notları

*   **Güvenlik**: Bu eklenti sadece çalıştırdığınız (aktif) sekmede yetki sahibidir (`activeTab` izni). Arkaplanda diğer sekmelerinizi izleyemez.
*   **Performans**: `content.js`, sayfa performansını etkilememek için "Event Delegation" ve "Lazy Evaluation" prensiplerini kullanır.

---
*Geliştirildi: 2026*
