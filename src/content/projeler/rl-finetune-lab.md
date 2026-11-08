---
title: rl-finetune-lab
summary: Fine-tune nasıl çalışıyor diye küçük bir modelle yaptığım denemeler.
lead: Lokal modelleri denemek ve fine-tune'un gerçekte nasıl çalıştığını anlamak için SFT, DPO ve GRPO'yu kendi bilgisayarımda küçük bir modelle denediğim bir öğrenme projesi.
year: 2026
stack: [sft, dpo, grpo, transformers]
order: 5
---

## Özet

rl-finetune-lab, fine-tune'un gerçekte nasıl çalıştığını anlamak için yaptığım bir dizi deney. 6 GB'lık bir laptop GPU'sunda küçük bir dil modelini (Qwen3.5-2B, 4-bit) üç yöntemle eğittim: SFT, DPO ve bir RL yöntemi olan GRPO. Hepsini aynı başlangıçtan, aynı veriyle ve modelin eğitimde hiç görmediği bir sınavla karşılaştırdım.

Kısa sonuç: doğru cevaplar elimdeyken en hızlı ve en iyi sonucu en basit yöntem olan SFT verdi. GRPO ise doğru cevabın yazılamadığı, yalnız sonucun ölçülebildiği bir görevde ilginç bir şey yaptı: kimse söylemeden, yalnız maliyetten, bozuk bir sensör yüzünden tezgâhı durdurmanın gereksiz olduğunu öğrendi.

## Ne işe yarıyor?

Bu bir ürün değil, bir öğrenme projesi. Hedefim şuydu: eğitilmemiş modelle eğitilmiş modeli aynı sınavda karşılaştırmak, SFT ve DPO gibi yöntemlerin ne işe yaradığını ve verinin modele nasıl verildiğini kendi gözümle görmek.

Bunun için önce şu sorulara cevap gerekiyordu: Modele ne öğreteceğim? Öğrendiğini nasıl anlayacağım? Bu iş bu bilgisayarda çalışır mı?

İlk görev önerisi bir takvim görevi oldu; reddettim, çünkü sıradan bir lokal model onu zaten yapabiliyordu. Model bir işi zaten biliyorsa eğitimin etkisi görünmez. Görevin üç şartı vardı: model onu önceden bilemeyecek, doğru cevabı kesin olarak bileceğim ve gerçek bir mühendislik problemine benzeyecek.

## Teknik kısım

### Görev: hayali bir hidrolik test tezgâhı

Küçük bir simülatör, hayali bir hidrolik tezgâhın sensör kaydını üretiyor: basınç, debi, sıcaklık ve titreşim, birkaç zaman adımında. Model bu kayda bakıp üç şey söylüyor:

```text
Tezgah hatti: A
t=0  | basinc 203 bar | debi 41 L/dk   | sicaklik 60 C | titresim 2.06 mm/s
...
t=25 | basinc 203 bar | debi 36.6 L/dk | sicaklik 60 C | titresim 2.28 mm/s

Beklenen: {"ariza": "kavitasyon", "bilesen": "pompa_1", "aksiyon": "izle"}
```

Debi düşüyor, titreşim artıyor. Uydurduğum kurala göre bu kavitasyon; A hattında olduğu için parça `pompa_1`; değişim küçük olduğu için karar `izle`. Kuralları ben uydurduğum için modelin onları bilmesi mümkün değil. Simülatör ürettiği her kaydı kurallarla kendisi yeniden çözerek sağlamasını yapıyor, böylece her sorunun gerçekten çözülebilir olduğu biliniyor.

### Ölçüm

Eğitimden önce 240 soruluk sabit bir sınav hazırladım: 120 temel, 120 zor. Üç alan da doğruysa cevap tam doğru sayılıyor. Sınav eğitimde hiç kullanılmıyor. Rastgele tahmin %0,3, kuralları bilen bir program %100 alıyor; model bu ikisi arasında bir yerde olmalı.

Kuralları prompt'a yazmanın yetip yetmediğini de ölçtüm, çünkü yetiyorsa eğitime gerek yok:

| Tam doğru (temel / zor) | 0.8B | 2B | 4B |
|---|---|---|---|
| Kurallar yok | %0,8 / %0 | %1,7 / %3,3 | %13,3 / %8,3 |
| Kurallar prompt'ta | %12,5 / %12,5 | %5,8 / %5,8 | %19,2 / %12,5 |

Kurallar açıkça yazılsa bile küçük modeller çözemiyor. 0.8B'nin %12,5'i de yanıltıcı: model neredeyse her soruya "normal" diyordu ve sekiz durumdan biri normal olduğu için bu %12,5 ediyor. Ortalama skora bakıp geçmemek, modelin ne yaptığına da bakmak gerekiyor.

### Donanım

Elimde 6 GB'lık bir RTX 4050 var. 0.8B hızlı ama çok zayıftı, 4B en iyisiydi ama eğitime sığmayacak gibiydi. Ortadaki 2B'yi 4-bit quantization ile kullandım.

Üretim hızı Windows'ta düşüktü. Modelin kullandığı hızlandırıcı paket (`flash-linear-attention`) Windows'ta devreye girmiyordu; aynı kartı WSL üzerinden kullanınca 4'lü batch'te 0.8B saniyede 79-86 token'dan 125-137 token'a çıktı. Donanım aynı, değişen yalnız yazılım ortamı.

Eğitim belleği daha büyük bir sorundu. 2B'de batch 1 bile 7,81 GB istiyordu, kart 6 GB. Tahmin etmek yerine her seferinde tek bir şeyi değiştirip ölçtüm:

| Değişiklik | Adım süresi | Ayrılan bellek |
|---|---|---|
| Hiçbiri | 1,35 sn | 7,32 GB |
| 32-bit dönüşümü kapalı | 0,79 sn | 7,01 GB |
| + Görüntü işleme kısmı çıkarıldı | 0,58 sn | 6,91 GB |
| + `expandable_segments` | 0,48 sn | **3,88 GB** |

Son satır en şaşırtıcısıydı. Model gerçekten daha az bellek kullanmadı; PyTorch'un ayırıp boş bıraktığı alan azaldı. Eğitim kartın belleğine sığdı ve yaklaşık 3 kat hızlandı.

### SFT

SFT'de modele soruyu ve doğru cevabı gösteriyorsun. Veri modele token olarak giriyor ve her token için bir girdi, bir etiket hazırlanıyor. Sorunun token'larının etiketi `-100`, yani "buradan puan kesme". Böylece model soruyu ezberlemiyor, yalnız cevabı üretmeyi öğreniyor. Örnekteki kayıt 461 token soru, 29 token cevap.

Modelin neredeyse tamamı donduruldu; yanına LoRA adaptörleri takılıp yalnız onlar eğitildi (parametrelerin yaklaşık %0,8'i). LoRA başta hiçbir etki yapmadığı için eğitimden hemen önce sınavı tekrar koştum ve eski skoru aynen buldum. Bu, sınav düzeneğinin doğru çalıştığını gösteren iyi bir kontroldü.

1.008 örnekle eğitim 9,8 dakika sürdü ve sonuç %2,5'ten **%100**'e çıktı. Tahminim %15-30'du. %100 görünce önce hata aradım: cevap soruya sızmış mı (hayır), eğitim ve sınav kayıtları kesişiyor mu (0 ortak kayıt), model kaydedilip yeniden yüklenince de aynı skoru alıyor mu (evet), yeni 480 soruda ne yapıyor (temelde %100, zorda %98,3).

Sonra modeli eğitimden farklı verilerle sıkıştırdım. Sensörlerin taban değerleri değişince tam doğru %77,5'e düştü ve hataların çoğu aksiyon alanındaydı. Olası yorum: model değişimin yüzdesini hesaplamak yerine eğitimde gördüğü taban değerlerine göre kestirme yapıyor. Bunu ayrıca test etmedim, ama "%100" demenin aslında "bu tür veride %100" demek olduğunu gösterdi.

### Veriyi azaltmak

SFT görevi bitirince sınav tavana vurdu. Bir yöntem %100 alıyorsa ondan daha iyi bir rakibi göremezsin. Bu yüzden veriyi 208 örneğe indirdim. SFT bu kez %24,6 aldı: arıza alanında %100, bileşende %52,5, aksiyonda %38,8. Model kolay kısmı önce öğrendi; aksiyon, rastgele tahmine (%33) yakın kaldı. Diğer yöntemlere gelişme alanı bırakan yer burasıydı.

### DPO

DPO'da doğru cevap yerine "şu cevap bundan daha iyi" bilgisi veriliyor. Kötü cevabı, doğru cevabın bir alanını bozarak ürettim (`izle` yerine `hemen_durdur` gibi). Başlangıçta tercih değişmediği için DPO loss'u her zaman 0,693; kodun doğruluğunu ilk bu değerden kontrol ettim.

İlk denemede sonuç %0'dı. Model artık JSON bile yazmıyor, "Pompası Pompası Pompası..." diye tekrar ediyordu. Loss ise düşüyordu. Olasılıklara bakınca neden olduğu görüldü: iyi cevabın log-olasılığı -14'ten -160'a, kötü cevabınki -11'den -167'ye düşmüştü. İki cevap da neredeyse imkânsız hale gelmişti, ama iyisi kötüsünden biraz daha olasıydı. DPO yalnız bu farka baktığı için memnundu. Yalnız öğrenme hızını on kat düşürünce geçerli JSON %100'e döndü, tam doğru %7,1 oldu. Loss iyi görünürken model bozulabiliyor; modelin ürettiği gerçek çıktıya bakmak gerekiyor.

### Kontrol deneyi

DPO'yu sıfırdan değil, SFT modelinin üzerine eklemek yaygın bir yol. Bunu denedim ve sonuç %24,6'dan %35,0'a çıktı. Burada dursaydım "DPO işe yaradı" diyecektim. Ama model aynı soruları ikinci kez görüyordu; gelişme yalnız bundan da olabilirdi. Bu yüzden aynı modele aynı veriyle bir tur daha SFT yaptım:

| Aynı başlangıçtan (%24,6) | Tam doğru | Süre |
|---|---|---|
| Bir tur daha SFT (kontrol) | **%46,2** | 2,5 dk |
| GRPO | %37,1 | 14,6 dk |
| DPO | %35,0 | 6,0 dk |

En basit alternatif en iyisiydi. Kontrol olmasa bunu bilemezdim. Doğru soru "skor arttı mı?" değil, "en basit alternatife göre arttı mı?".

### GRPO

GRPO'da modele doğru cevap hiç gösterilmiyor. Model aynı soruya dört cevap üretiyor, bir kural her birine puan veriyor (her doğru alan için 1/3, geçersiz JSON için 0) ve model gruptaki ortalamanın üstünde puan alan cevapları daha sık yazmayı öğreniyor. Önemli olan puanın kendisi değil, gruptaki diğer cevaplara göre nerede durduğu. Dört cevap da aynı puanı alırsa o sorudan hiçbir şey öğrenilmiyor.

GRPO doğru cevabı hiç görmeden aksiyon alanında %38,8'den %67,0'a çıktı. Yöntem çalışıyor, ama doğru cevap elimdeyken SFT'nin daha iyi olması şaşırtıcı değil. GRPO ile DPO arasındaki 2 puanlık fark da tek koşuyla yorumlanamayacak kadar küçük. Bir de şunu gördüm: eğitim sırasında örneklenen cevapların puanı belirgin biçimde yükselmedi, ama sınav skoru arttı. "Puan yükselmiyorsa öğrenmiyor" kriteri yanlıştı.

### Tek doğru cevabın olmadığı görev

Buraya kadar GRPO'yu SFT'nin en güçlü olduğu yerde sınamıştım. RL'in asıl vaadi, doğru cevabı yazamadığın ama sonucu ölçebildiğin işler. Bu yüzden görevi değiştirdim. Model yalnız bir karar veriyor: `izle`, `planli_bakim` ya da `hemen_durdur`. Her kararın gizli bir formülden gelen bir maliyeti var. Bir de "operatör kuralı" koydum: yalnız değişimin büyüklüğüne bakıyor, fena değil ama kusurlu. Örneğin sensör bozulup yanlış değer gösterdiğinde de tezgâhı durduruyor. Elimde geçmiş operatör kararları ve maliyeti ölçen bir sistem var, "en iyi karar" listesi ise yok.

| Kim karar veriyor? (480 yeni kayıt) | Maliyet |
|---|---|
| Formülden hesaplanan en iyi kararlar | 2,25 |
| SFT, en iyi kararlarla (gerçekte elde olmaz) | 2,46 |
| **GRPO** | **2,55** |
| Operatör | 2,57 |
| SFT, operatör kararlarıyla | 2,58 |

GRPO ile operatör arasındaki fark 0,022 ve %95 güven aralığı sıfırı içeriyor. Yani GRPO operatörü geçti diyemiyorum. Asıl ilginç olan ortalamanın arkasındaydı:

| | Operatör | GRPO |
|---|---|---|
| Sensör arızasındaki kayıp | 1,43 | **0,00** |
| Dış kaçak kaybı | 0,02 | 0,45 |
| `planli_bakim` kullanımı | %31,2 | **%1,2** |

GRPO, sensör bozulduğunda durmanın gereksiz olduğunu hiç söylenmeden, yalnız maliyetten öğrendi. Operatörü taklit eden SFT modeli bu hatayı aynen kopyaladı. RL'in vaadi tam olarak bu. Ama model `planli_bakim` kararını neredeyse bıraktı, oysa en iyi kararların %35'i bu. Olası neden, modelin kararlarından erken emin olması: grupların %80-92'sinde dört cevap da aynı puanı aldı, yani model o sorulardan bir şey öğrenmedi. RL'de buna keşif sorunu deniyor; bunu henüz test etmedim. RL'in gücü de riski de aynı yerden geliyor: model ödülden benim söylemediğim şeyleri öğreniyor.

### Çıkardığım dersler

1. Önce ölçümü kur. Baseline ve görülmemiş bir sınav yoksa eğitim sonucu anlamsız.
2. Doğru cevaplar varsa önce SFT dene.
3. Loss'a güvenme, çıktıya bak.
4. Çok iyi bir sonuçtan da kötü bir sonuç kadar şüphelen.
5. Her zaman bir kontrol koy. En basit alternatifi geçemeyen yöntem değerini kanıtlamamış demektir.
6. Tek seferde tek şey değiştir. Bellek ve DPO sorunları böyle çözüldü.
7. RL'i doğru cevabı yazamadığın ama sonucu ölçebildiğin yerde kullan; başarısı ödülü ve keşfi ne kadar iyi kurduğuna bağlı.

Bir çekince: bu sonuçlar tek bir görevden geliyor ve deneylerin çoğu bir kez, tek bir rastgele tohumla çalıştırıldı. "SFT her zaman kazanır" gibi genel bir kurala çevrilmemeli. Sırada GRPO'yu daha fazla keşifle yeniden koşmak ve deneyleri farklı tohumlarla tekrarlamak var.
