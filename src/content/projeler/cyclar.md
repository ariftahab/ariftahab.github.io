---
title: cyclar
summary: Telefonu bisiklet yol bilgisayarına çeviren uygulama.
lead: Pahalı bir yol bilgisayarı almak yerine, gidondaki telefonu tek bakışta okunabilen bir bisiklet bilgisayarına çeviren kişisel bir Flutter uygulaması.
year: 2026
stack: [flutter, gpx, dem, barometre]
order: 4

gallery:
  - { src: img/cyclar/harita.png, alt: harita sayfası }
  - { src: img/cyclar/veri.png, alt: veri sayfası }
---

## Özet

cyclar, gidondaki telefonu bir bisiklet yol bilgisayarına çeviren bir Flutter uygulaması. Strava'dan alınan rotayı haritada gösteriyor, hızı ve yolun o anki eğimini büyük rakamlarla veriyor, en önemlisi de içinde bulunulan yokuşun ne kadar daha süreceğini ve sıradaki eğimin kaç metre sonra geldiğini söylüyor. Sürüşü kendisi kaydediyor ve Strava'ya yüklüyor. Android ve iOS'ta çalışıyor.

## Ne işe yarıyor?

Bisiklet sürerken en çok merak ettiğim şey, tırmandığım yolun eğimi ve bu eğimin ne kadar daha süreceği. Garmin ya da Wahoo gibi yol bilgisayarları bunu gösteriyor ama pahalılar. Strava sürüş sırasında anlık eğimi göstermiyor; rotanın eğim bilgisine bakmak için sürüş ekranından çıkmak gerekiyor. Benim istediğim, gidondaki telefona tek bakışta okunabilen ve tek kaydırmayla harita ile veri ekranı arasında geçilebilen bir yol bilgisayarıydı.

Uygulamanın iki sürüş sayfası var, yatay kaydırmayla geçiliyor:

- **Harita sayfası.** Rota çizgisi ve konum; harita gidiş yönüne göre dönüyor ve yaklaşık 400-500 metre ilerisini gösteriyor. Eş yükselti eğrileri ve patikalar olan bir harita stili kullanıyorum, çünkü orman ve dağ yollarında da sürüyorum. Altta hız ve sıradaki eğim şeridi var.
- **Veri sayfası.** En üstte hız ve yerel eğim, en büyük rakamlar olarak. Altında "Bölüm %9 · 150 m kaldı" ya da tırmanışın içindeyken "Tırmanış ort. %6 · 1,4 km · +85 m". Tırmanışta değilken "Sıradaki eğim: 400 m sonra · %5,2 · 150 m". Önümüzdeki birkaç kilometrenin yükseklik profili konumum işaretli olarak çiziliyor. Sürüş mesafesi, hareket süresi, ortalama hız, toplam yükselti ve molalar da bu sayfada.

Eğim rakamları renk kodlu (iniş mavi, %3'ün altı yeşil, %3-6 sarı, %6-9 turuncu, %9 ve üstü kırmızı), böylece rakamı okumadan dikliği anlayabiliyorum. Rotadan 40 metreden fazla ve 10 saniyeden uzun saparsam her iki sayfada kırmızı bir uyarı ve rotaya dönüş yönü çıkıyor. Sürüş birkaç saniye 5 km/s'nin üstünde gidince kendiliğinden başlıyor, 3 km/s'nin altına düşünce duraklıyor; 2 dakikadan uzun duraklamalar mola sayılıyor, kırmızı ışık sayılmıyor. Gündüz açık, gün batımından sonra koyu temaya geçiyor.

Rota içe aktarılınca bir özet çıkıyor: toplam mesafe, toplam yükselti, renk kodlu yükseklik profili ve tırmanış listesi ("Tırmanış 1: km 12,4 · 3,4 km · ort. %6,2 · +210 m"). Sürüşten önce zor kısımları buradan görüyorum.

Sonradan eklenenler: profil bilgileriyle tahmini güç, Bluetooth nabız ve kadans sensörleri, sürüş sonu özeti ve Strava'ya doğrudan yükleme.

## Teknik kısım

### İki eğim kaynağı

Projenin en önemli kararı eğimin nereden geldiği. İki kaynak var ve her biri farklı bir iş yapıyor:

- **Yerel eğim** (ekrandaki büyük rakam) her zaman telefonun barometresinden ölçülüyor. Son birkaç on metredeki yükseklik değişimi yumuşatılıp yatay mesafeye bölünüyor. Bu, yolun gerçek eğimi: rotadan bağımsız, köprü ve viyadük gibi yükseklik modelinin yanıldığı yerlerden etkilenmiyor.
- **İleriye dönük bilgiler** (bölümün kalan mesafesi, tırmanış ortalaması, sıradaki eğim) rotanın yükseklik profilinden geliyor. Barometre yalnız geçmişi ölçebiliyor; ileriyi yalnız rota profili biliyor.

Rota profili, rota içe aktarılırken OpenTopoData'dan (Copernicus/SRTM, 30 m çözünürlüklü DEM) bir kez indirilip telefonda saklanıyor. Sürüşte internet çekmese de eğim bilgisi kaybolmuyor. Bunun bir bedeli var: büyük rakam ile altındaki DEM tabanlı bölüm eğimi aynı anda birkaç yüzde farklı olabiliyor. Bunu bilerek kabul ettim, çünkü ikisi farklı soruları cevaplıyor.

Sürüş kaydındaki yükseklik de iki kaynağı birleştiriyor: sürüş başında barometre, başlangıç noktasının DEM yüksekliğine kalibre ediliyor, sonraki değişimler barometreden izleniyor. Böylece Strava'daki yükseklik grafiği hem doğru seviyede hem pürüzsüz.

### Rota analizi

Rota analizi bir GPX dosyasını ve bir yükseklik kaynağını alıp rotayı kısa **eğim bölümlerine** (yaklaşık 100-300 m) ve **tırmanışlara** ayırıyor. Algoritmayı önce bir Python prototipinde, gerçek bir rota üzerinde (Bolu'da 39,9 km'lik bir sürüş) ayarladım, sonra Dart'a taşıdım. Aynı GPX ve aynı yükseklikler için Python'un ürettiği bölümler ve tırmanışlar test fixture'ı olarak saklanıyor ve Dart çıktısıyla karşılaştırılıyor.

Tırmanışın tanımı birkaç kez değişti:

- İlk tanım Garmin ClimbPro ile aynıydı: en az 500 m ve ortalama en az %3. Bolu rotasında 3 tırmanış buldu, ama km 5,6-6,6'daki 1 km'lik %3,4'lük yokuşu kaçırdı. Önündeki kısa rampa ve düzlük ortalamayı %2,8'e düşürüyor, dizi tümden eleniyordu.
- 100 m ve %2,5 eşiği aynı rotada 12 "tırmanış" çıkardı; çoğu 3-11 metrelik rampalardı.
- Seçilen kural Wahoo'ya benziyor: **en az 250 m, ortalama en az %3 ve uzunluk (m) × eğim (%) ≥ 1200**. Yani %3'te 400 m, dikleştikçe 250 m'ye kadar. Ortalamayı tutmayan dizi atılmıyor; içinden çıkış bölümüyle başlayıp biten en uzun geçerli parça tırmanış oluyor, iki yanında aynı arama tekrarlanıyor. 200 metreden kısa ya da 10 metreden az yükseklik kaybettiren düşüşler tırmanışı bölmüyor.

Bolu'da sonuç 5 tırmanış ve 7 kısa rampa. Tırmanışların dışında kalan eğimli kısımlar (%3,1'in üstü, uzunluk şartı yok) "kısa rampalar" olarak ayrıca listeleniyor, çünkü sürerken onlara da hazırlanmak istiyorum.

### Sürüş motoru

Sürüş motoru saf Dart ve ekrandan bağımsız. Zaman damgalı sensör örneklerini (GPS konumu, hız, doğruluk, barometre basıncı) ve isteğe bağlı rota profilini alıyor; her örnekten sonra tek bir **anlık durum** üretiyor. Ekrandaki her alan bu durumdan geliyor: hız, mesafe, eğimler, tırmanış bilgisi, rota konumu, rota dışı durumu, molalar.

Motor duvar saatini hiç okumuyor; zaman örneklerle geliyor. Bu yüzden iki saatlik bir sürüş senaryosu testte anında çalışıyor. Aynı tasarım bir simülasyon modunu da mümkün kıldı: bir GPX'i 1× ile 10× arası hızda sürüyormuş gibi oynatıyor ve her değişikliği bisiklete binmeden masada deneyebiliyorum. Gerçek sürüşlerde sensör örnekleri de bir dosyaya yazılıyor; sonradan aynı sürüşü motordan tekrar geçirip bir ayarın etkisine bakabiliyorum.

Rota eşleştirmede konum rota çizgisine izdüşürülüyor. Gidiş-dönüş rotalarda aynı yol iki kez geçiyor; birden fazla aday varsa son bilinen rota konumundan ileride olan en yakın aday seçiliyor. Böylece dönüş yolunda km 8'den km 32'ye atlayıp yanlış eğim göstermiyor. Kısa GPS sıçramaları ve yolun karşı şeridinde gitmek rota dışı uyarısı vermiyor, çünkü uyarı için hem 40 metre hem 10 saniye gerekiyor.

### Kayıt

Sürüş kaydını Strava'ya bırakmak yerine uygulama kendisi yapıyor. Kayıt GPX olarak diske sürekli, artımlı yazılıyor; uygulama çökse ya da telefon kapansa bile açılışta yarım kalan kayıt bulunup devam ediliyor. Sürüş sırasında başka bir uygulamaya geçince sabit bir bildirimle arka planda saymaya devam ediyor. Ekran sürüş boyunca açık kalıyor.

Strava'ya yükleme OAuth gerektiriyor ve token değişimi bir client secret istiyor. Secret'ı uygulamanın içine koymak, APK açılınca çıkarılabilmesi demekti. Bu yüzden secret durumsuz bir Cloudflare Worker'da duruyor. Worker yalnız token alma ve yenileme isteklerine secret'ı ekleyip Strava'ya iletiyor; hiçbir şey saklamıyor ve loglamıyor. Sürüş verisi Worker'dan geçmiyor, telefon Strava ile doğrudan konuşuyor. Worker'a ulaşılamazsa web üzerinden yükleme yedek olarak kalıyor.

### Tahmini güç ve sensörler

Güç ölçer olmadan güç, bilinen bir fizik modeliyle tahmin ediliyor:

```
P = v · [m·g·(sin θ + Crr·cos θ) + ½·ρ·CdA·v²] / η
```

`v` GPS hızı, `θ` barometreden gelen yerel eğim, `m` sürücü ve bisiklet ağırlığı. Kullanıcıya `CdA` ya da `Crr` sorulmuyor: hava direnci alanı, boy ve kilodan hesaplanan vücut yüzey alanının (Du Bois formülü) bisiklet türüne göre bir pozisyon katsayısıyla çarpımı; yuvarlanma direnci de bisiklet türünden geliyor. Değer 3 saniyelik kayan ortalamayla gösteriliyor, inişte ve boşta 0 W.

Nabız ve kadans Bluetooth Low Energy sensörlerinden okunuyor. Eşleştirilen sensörler hatırlanıyor ve sürüş başında kendiliğinden bağlanıyor. Profil ve ayarlar veritabanı olmadan küçük JSON dosyalarında, yalnız telefonda duruyor.

### Platformlar

Başta yalnız Android'i hedefliyordum ve Kotlin önerilmişti, ama ileride iOS'u mümkün kıldığı için Flutter'ı seçtim. Bedeli, foreground service, barometre ve harita gibi platform özelliklerine paketler üzerinden erişmek. Bu karar sonradan işe yaradı: iOS desteği eklemek istendiğinde sürüş motoru, rota analizi ve arayüz saf Dart olduğu için aynen çalıştı. Değişen tek şey platforma dokunan ince katmandı. Android'de elle yazdığım Kotlin kanallarının çoğunu iki platformda da çalışan paketlerle değiştirdim. Paketle yapılamayan tek yer (Dosyalar uygulamasından açılan bir GPX'e erişim) için Swift'te 4 satır kod yetti.

Platformu `Platform.isAndroid` yerine Flutter'ın `defaultTargetPlatform` değeriyle seçiyorum. `Platform.isAndroid` testi çalıştıran bilgisayara göre değişiyor: macOS'ta `false` döndüğünde bir test sonsuza kadar bekledi.

### Arayüz

Arayüz bir kez baştan yenilendi. İlk hali işlevseldi ama ham duruyordu: düz kutular, gruplama yok, aynı bilgi iki yerde. Birkaç bisikletçi de kullanmak isteyince ekranları baştan tasarladım. Önce beş görsel stil arasından birini, sonra işlevsel yerleşimler arasından parçaları seçip harmanladım. Hedef, hiçbir özelliği kaybetmeden sürüşte bir bakışta daha kolay okunan ekranlardı. Sürerken bakılan değerler (hız, eğim) en büyük; tuşlar en altta, başparmağın ulaştığı yerde. "Sürüşü bitir" tuşu yanlışlıkla dokunulmasın diye uzun basmayla çalışıyor.

### Test

Test sınırı iki saf modül: rota analizi (GPX ve sahte yükseklik kaynağı → rota profili) ve sürüş motoru (örnek akışı → anlık durum dizisi). Testler iç yapıyı değil davranışı sınıyor ve gerçek senaryolar gibi okunuyor: "dolambaçtan sonra rotaya ileriden katılınca kalan mesafe güncellenir".

Testlerin gerçekten bir şey yakalayıp yakalamadığını mutasyon testiyle ölçtüm. Bir taramada yakalanmayan 178 mutantı tek tek inceledim: 94'ü testlerde gerçek bir eksikti ve yeni test yazıldı, 50'si eşdeğerdi (davranışı değiştirmiyordu), 27'si yalnız sürekli bir ölçümün eşiğe tam eşit geldiği anda fark eden `<` ile `<=` farkıydı. Eşitliğin olağan olduğu yerlerde ise test yazdım: saniyede bir gelen GPS örnekleriyle tam 10 saniye, 25 metrenin katı olan rota mesafeleri, kullanıcının girdiği tam sayılar. Arayüz yenilemesinden sonra aynı işlemi arayüz koduna da uyguladım; yakalanmayan mutant 164'ten 17'ye indi.
