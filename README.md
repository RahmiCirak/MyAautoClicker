#  Sequential Auto Clicker: Teknik Dokümantasyon ve Eğitim Rehberi

Bu proje, sadece bir "tıklama aracı" değil, aynı zamanda modern **Chrome Eklenti Geliştirme (Manifest V3)** standartlarını öğrenmek için tasarlanmış kapsamlı bir örnektir.

Bu doküman, projenin mimarisini, kullanılan algoritmaları ve kod yapısını **eğitici bir dille** anlatır.

---

##  1. Mimari Genel Bakış (Architecture)

Chrome eklentileri, birbirlerinden izole edilmiş "dünyalarda" çalışan bileşenlerden oluşur. Bu projede 3 ana bileşen vardır:

### A. Manifest (`manifest.json`)
Eklentinin "kimliğidir". Tarayıcıya "Ben kimim?", "Hangi yetkilere ihtiyacım var?" ve "Hangi dosyaları ne zaman çalıştırmalıyım?" sorularının cevabını verir.

*   **`manifest_version: 3`**: Chrome'un en yeni ve güvenli eklenti standardıdır.
*   **Permissions**:
    *   `activeTab`: Kullanıcının o an açık olan sekmesine erişim izni.
    *   `scripting`: Sayfaya dışarıdan JavaScript (`content.js`) enjekte etme izni.
    *   `storage`: Kullanıcı ayarlarını tarayıcı hafızasında tutma izni.

### B. Popup (`popup.html` + `popup.js`)
*   **Nedir?**: Eklenti ikonuna tıkladığınızda açılan küçük penceredir.
*   **Görevi**: Kullanıcı arayüzünü (UI) sunar ve kullanıcının komutlarını alır.
*   **Kısıtlama**: Web sayfası ile doğrudan konuşamaz. Sayfadaki bir butona tıklayamaz. Sadece "mesaj" gönderebilir.

### C. Content Script (`content.js`)
*   **Nedir?**: Gerçek web sayfasının içine "sızan" ve orada çalışan JavaScript kodudur.
*   **Görevi**: DOM (Document Object Model) elementlerini görür, tıklar, sayfa üzerinde değişiklik yapar.
*   **Kısıtlama**: Kendi başına dış dünya ile konuşamaz, Popup'tan emir bekler.

---

##  2. Veri Akışı ve İletişim

Bu projede bileşenler nasıl haberleşiyor?

1.  **Kullanıcı** Popup'taki "Start" butonuna basar.
2.  **`popup.js`** bu tıklamayı yakalar ve kullanıcının girdiği verileri (selector listesi, gecikme süresi) alır.
3.  **`popup.js`**, aktif sekmeyi bulur ve oraya `content.js` dosyasını enjekte eder (`chrome.scripting.executeScript`).
   *(Not: Manifest V3'te content scriptler her zaman otomatik çalışmayabilir, gerektiğinde manuel enjekte etmek daha güvenilirdir.)*
4.  **`popup.js`**, sekmeye bir **Mesaj** gönderir:
    ```javascript
    chrome.tabs.sendMessage(tabId, { action: "start_clicking", selectors: [...] });
    ```
5.  **`content.js`** bu mesajı dinler (`chrome.runtime.onMessage`) ve aldığı emre göre tıklama döngüsünü başlatır.

---

##  3. Akıllı Seçici Algoritması (Smart Selector Logic)

Bu projenin en kritik teknolojik özelliği `generateSelector` fonksiyonudur. Kullanıcı bir öğeye tıkladığında, o öğeyi tekrar bulabilmek için benzersiz bir "adres" (CSS Selector) üretmemiz gerekir.

### Sorun
Klasik yöntem (`body > div > div:nth-child(3) > button`) çok kırılgandır. Site tasarımında küçük bir değişiklik olursa (araya bir div eklenirse) bu yol bozulur.

### Çözüm: "Shortest Unique Path" (En Kısa Benzersiz Yol)
Projede kullandığımız algoritma şu adımları izler:

1.  **Benzersiz Kimlik Kontrolü**:
    *   Öğenin `id`'si var mı? Varsa ve sayfada tekse, direkt onu kullan (`#submit-btn`). En hızlı ve güvenilir yoldur.

2.  **Akıllı Özellik (Attribute) Tarama**:
    *   Modern frameworkler (React, Vue, Angular) test için özel etiketler bırakır. Algoritmamız sırasıyla şunları arar:
        *   `data-testid`, `data-cy`, `aria-label`, `name`, `placeholder`...
    *   Örneğin: `<button data-testid="save-btn">` varsa, direkt `[data-testid="save-btn"]` seçicisini üretir. Bu çok kararlıdır.

3.  **Kısa Yol Analizi**:
    *   Yukarıdakiler yoksa, algoritma öğeden yukarı (ebeveynlerine) doğru tırmanmaya başlar.
    *   Her adımda: "Şu anki yolum sayfada benzersiz mi?" diye sorar.
    *   Benzersiz olduğu anda durur.
    *   *Örnek*: `div > button` (binlerce var) -> `form.login > button` (sadece 1 tane var). Algoritma `form.login > button` sonucunu döndürür.

---

##  4. Kod İncelemesi (Önemli Parçalar)

### Asenkron Döngü ve Gecikme (`content.js`)
JavaScript tek iş parçacıklı (single-threaded) olduğu için, `sleep()` gibi bir fonksiyon yoktur. Bekleme işlemini `Promise` ve `setTimeout` ile simüle ederiz:

```javascript
// Gecikme Fonksiyonu
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Kullanımı (Async/Await)
async function processQueue(items) {
    for (const item of items) {
        await clickElement(item); // Tıkla
        await wait(1000);         // 1 saniye bekle (kod burada durur)
    }
}
```
Bu yapı sayesinde tarayıcı donmadan bekleme işlemi gerçekleşir.

### İnsan Benzeri Tıklama (Human-like Click)
Sadece `.click()` fonksiyonu çağırmak, modern web sitelerinde (özellikle React/Angular) işe yaramayabilir. Çünkü bu siteler tıklamayı değil, farenin aşağı inip kalkmasını (`mousedown`, `mouseup`) dinler.

Bu yüzden tam bir olay zinciri simüle ediyoruz:
```javascript
function simulateClick(element) {
    // Sırasıyla 3 olay tetiklenir
    ['mousedown', 'mouseup', 'click'].forEach(eventType => {
        const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window
        });
        element.dispatchEvent(event);
    });
}
```

---

##  5. Nasıl Geliştirebilirsiniz?

Bu projeyi daha da ileri götürmek isterseniz şu fikirleri deneyebilirsiniz:

1.  **Kayıt Özelliği**: Yapılan tıklamaları bir "profil" ismiyle kaydedip sonra tekrar yüklemek (localStorage kullanarak).
2.  **Rastgele Gecikme**: Robot olduğunun anlaşılmaması için bekleme süresine rastgelelik eklemek (örn: 1000ms +/- 200ms).
3.  **Klavye Girdisi**: Sadece tıklama değil, input alanlarına metin yazma özelliği eklemek (`element.value = "..."` ve `input` event tetikleme).

---

##  Kurulum ve Test

1.  Klasörü indirin.
2.  Chrome'da `chrome://extensions` adresine gidin.
3.  **Developer Mode**'u açın.
4.  **Load Unpacked** diyerek klasörü seçin.
5.  İyi eğlenceler! 🚀
