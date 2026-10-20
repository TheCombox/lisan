# Lisan

**Discord masaüstü uygulaması** için çeviri eklentisi. [Vencord](https://github.com/Vendicated/Vencord) userplugin'i olarak çalışır.

Mesajları **Google Çeviri** (ücretsiz, anahtar gerekmez) veya **DeepL** (API anahtarı gerekir) ile çevirir; seçtiğin kanallarda gelen mesajları otomatik çevirebilir.

> Vencord veya Discord ile bağlantılı değildir, onlar tarafından desteklenmez.
>
> English documentation: [README.md](README.md)

---

## Ne yapar

**Elle çeviri**
- Mesajın üzerine gelince çıkan araç çubuğunda bir düğme.
- Sağ tık menüsünde *"Lisan ile çevir"*.
- Sonuç, mesajın altında italik olarak görünür: algılanan kaynak dil ve *gizle* bağlantısıyla birlikte.

**Kanal bazlı otomatik çeviri**
- Mesaj kutusundaki düğme, bulunduğun kanalda otomatik çeviriyi açar/kapatır. Açıkken yeşil parlar.
- O kanala gelen mesajlar geldikçe çevrilir.
- Kendi mesajların ve zaten hedef dilde olan mesajlar atlanır.
- Ayarlardan tüm kanallar tek seferde sıfırlanabilir.

**Motor yönetimi**
- Google uç noktaları anahtar istemez; DeepL anahtar ister.
- Sonuçlar önbelleğe alınır (500 kayıt) ve aynı metin için eşzamanlı istekler tekilleştirilir.
- Aynı anda en fazla iki istek uçar, aralarında en az 200 ms boşluk bırakılır.

---

## Gereksinimler

- Discord masaüstü (Windows, macOS veya Linux)
- Node.js **>= 22**
- Git

pnpm eksikse script kurar (Vencord'ın beklediği sürüme sabitlenmiştir: `11.9.0`).

---

## Kurulum

Eklenti Vencord'ın içine derlendiği için tek dosya olarak bırakılamaz. Script tüm kurulumu yapar:

1. Vencord'ı bu deponun yanına klonlar,
2. eklentiyi `src/userplugins/lisan` altına kopyalar,
3. bağımlılıkları indirip derler,
4. Vencord kurucusunu indirip Discord'u yamalar.

**Önce Discord'u kapat** (tepsi simgesi dahil).

```powershell
git clone https://github.com/TheCombox/lisan.git
cd lisan
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

Sonra Discord'u aç: **Ayarlar → Vencord → Plugins → Lisan** ve etkinleştir.

Kullanışlı parametreler:

| Parametre | Etkisi |
|---|---|
| `-VencordDir <yol>` | Klonlamak yerine var olan bir Vencord deposunu kullan |
| `-SkipDependencies` | `pnpm install` adımını atla (ilk kurulumdan sonra daha hızlı) |
| `-NoConfirm` | Discord'u yamalamadan önce onay sorma |

Vencord **dev install** olarak kurulur, yani bu depodan yüklenir: yeniden derledikten sonra tekrar kurulum gerekmez, Discord'u yeniden başlatmak yeterlidir.

---

## Kullanım

### Ayarlar

*Ayarlar → Vencord → Plugins → Lisan → dişli simgesi*

| Ayar | Anlamı |
|---|---|
| **Çeviri motoru** | Google (varsayılan), DeepL veya DeepL Pro. |
| **DeepL API anahtarı** | DeepL anahtarın. Boşsa veya kota dolduysa Lisan sessizce Google'a düşer. |
| **Hedef dil** | Çevirilerin dili. Varsayılan **Türkçe (tr)**. |
| **Kaynak dil** | Kaynak dil. Varsayılan otomatik algılama. |
| **Otomatik çeviri genel anahtarı** | Otomatik çevirinin ana anahtarı. Kapatırsan kanal bazlı seçimler korunur ama çeviri yapılmaz. |
| **Otomatik çeviriyi N kanalda kapat** | Tüm kanallardaki otomatik çeviriyi temizler. |

### Otomatik çevirinin kapsamı

Otomatik çeviri, açıldıktan **sonra gelen** mesajları çevirir. Geçmiş kendiliğinden çevrilmez — aksi halde uzun bir kanalı açtığında yüzlerce istek birden çıkardı. Eski bir mesajı çevirmek için üzerine gelip Lisan düğmesini kullan.

---

## Hız sınırı (Google 429)

Google'ın ücretsiz uç noktası zaman zaman `429` döner. Lisan bunu üç katmanda karşılar:

1. **Yeniden dener** — aynı uç noktada iki kez, artan beklemeyle; sunucu `Retry-After` başlığı gönderdiyse ona uyar.
2. **Yedek uç noktaya geçer.** `translate.googleapis.com` sınırlarsa istek `clients5.google.com`'a gider. İkisi de aynı çeviriyi üretir (testlerle kapsanmıştır); yedek belirgin biçimde daha hızlıdır.
3. **Otomatik çeviriyi duraklatır** — ikisi de başarısız olursa 60 saniye boyunca otomatik çeviri durur ve tek bir uyarı gösterilir. Elle çeviri (düğme / sağ tık) bu duraklamadan etkilenmez.

Kalıcı çözüm DeepL'dir: bir anahtar girip motoru değiştirirsen bu sınır hiç devreye girmez.

Uç noktaları kendin ölçmek için:

```bash
node test/rate-limit-probe.mjs
```

---

## Geliştirme

```powershell
# kaynağı düzenledikten sonra kopyala, tip kontrolü yap ve derle
powershell -ExecutionPolicy Bypass -File scripts/update.ps1
```

Çekirdek testleri canlı Google API'sine karşı çalıştır. Discord gerekmez: test dosyası ayrıştırıcıları doğrudan içe aktarır, Vencord'dan ödünç aldığı tek şey `tsx`. Yolu, bu depoyu klonladığın yere göre düzelt.

```bash
cd Vencord
pnpm exec tsx "../lisan/test/verify.ts"
```

Son çalıştırma: **47 geçti, 0 kaldı.** Kapsam: çok satırlı metinlerde parçaların doğru birleşmesi, dil algılama, hedef/kaynak dil değişimi, bozuk yanıtların hata atması, Google↔DeepL kod dönüşümleri, dil etiketleri ve yedek uç noktanın birincil uç noktayla aynı sonucu vermesi.

### Dosya düzeni

| Yol | Ne olduğu |
|---|---|
| `index.tsx` | Plugin tanımı: üst düğme, sağ tık menüsü, gösterge |
| `translate.ts` | Çeviri çekirdeği: motor seçimi, önbellek, hız sınırlama, deneme, soğuma |
| `native.ts` | Ağ istekleri Electron **ana** sürecinde (CORS engelini aşar) |
| `parse.ts` | Saf yanıt ayrıştırma; Discord olmadan test edilebilsin diye ayrı |
| `languages.ts` | Dil kodları ve dönüşümleri |
| `settings.tsx` | Ayar tanımları ve arayüzü |
| `state.ts` | Kanal bazlı otomatik çeviri durumu |
| `TranslationAccessory.tsx` | Mesaj altındaki çeviri göstergesi |
| `AutoTranslateButton.tsx` | Mesaj kutusundaki aç/kapat düğmesi |
| `LisanIcon.tsx` | Eklentinin simgesi |
| `styles.css` | Stiller |
| `test/verify.ts` | Çekirdek testleri (Discord gerekmez) |
| `test/rate-limit-probe.mjs` | Google uç noktalarının hız sınırını ölçer |
| `scripts/install.ps1`, `scripts/update.ps1` | Kurulum ve geliştirme döngüsü scriptleri |

Vencord deposuna yalnızca `.ts`, `.tsx` ve `.css` dosyaları kopyalanır, yani eklenti klasörü temiz kalır.

---

## Sınırlar

- **Arayüz etiketleri şu an Türkçe.** Motor adları, dil isimleri ve ipuçları Türkçe. Eklenti Discord dilinden bağımsız çalışır, ama Türkçe bilmeyen biri Türkçe etiketler görür. Başka diller için katkı memnuniyetle karşılanır.
- **Vencord'ın kendi `Translate` plugin'i var.** İkisini birlikte açarsan her mesajda iki çeviri düğmesi görürsün; birini kapat.
- **Client mod'lar Discord tarafından resmî olarak desteklenmez.** Vencord istemciye kod enjekte eder. Discord'un gerçekten denetlediği davranışlara (self-bot, hesap otomasyonu) burada dokunulmuyor, ama tamamen risksiz de değil.
- **DeepL kotası.** Ücretsiz plan ayda 500.000 karakterle sınırlıdır; dolduğunda Lisan Google'a düşer.

---

## Lisans

**GPL-3.0-or-later.** Bkz. [LICENSE](LICENSE).

Bu eklenti GPL-3.0-or-later lisanslı Vencord'ın türevi bir çalışmadır: `languages.ts` ve dil tablolarının yapısı Vencord'ın `translate` plugin'inden uyarlanmıştır ve eklenti bir Vencord derlemesinin parçası olarak dağıtılır.

`languages.ts` — Copyright (c) 2023 Vendicated and contributors, GPL-3.0-or-later.
