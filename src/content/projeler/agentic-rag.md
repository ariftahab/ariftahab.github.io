---
title: agentic-rag
summary: Aynı mimarinin, aramayı ne zaman yapacağına kendisi karar veren agent sürümü.
lead: Mühendislik Fakültesi öğrencilerinin danışmanlık sorularına odaklanan, mevzuat-rag mimarisinden türetilmiş agentic bir RAG chatbot.
year: 2026
stack: [agent, claude haiku, code execution, mutation testing]
order: 2
github: https://github.com/ariftahab/agentic-rag

diagram:
  cols: 5
  caption: karar LLM'de, hesap kodda; agent 15 tool'dan hangisini çağıracağını seçer, sayıları tool'lar hesaplar, hiçbiri yetmezse sandbox'ta kod yazar
  groups:
    - { label: tool'lardan bazıları, cols: [3, 4], rows: [0, 2] }
  nodes:
    - { id: q, label: soru, sub: + transkript, col: 0, row: 1 }
    - { id: agent, label: agent, sub: Claude Haiku · tool seçer, col: 1, row: 1, hl: true }
    - { id: ans, label: cevap, sub: kaynaklı, col: 1, row: 2 }
    - { id: regs, label: search_regulations, sub: mevzuat-rag araması, col: 3, row: 0, span: 2 }
    - { id: trans, label: analyze_transcript, sub: eksik dersler · AKTS · GNO, col: 3, row: 1, span: 2 }
    - { id: sim, label: code_execution, sub: izole sandbox, col: 3, row: 2, span: 2 }
  edges:
    - { from: q, to: agent }
    - { from: agent, to: regs, both: true }
    - { from: agent, to: trans, both: true, label: çağrı / sonuç }
    - { from: agent, to: sim, both: true }
    - { from: agent, to: ans }
---

## Özet

agentic-rag, Mühendislik Fakültesi öğrencileri ve danışman hocalar için tool çağıran bir LLM agent. Mevzuatı arıyor, öğrencinin transkriptini okuyor, mezuniyet ve not hesaplarını kodla yapıyor, ders programından şube çakışmalarına bakıyor ve her bilginin kaynağını gösteriyor. [mevzuat-rag](/projeler/mevzuat-rag/)'in retrieval hattını tool'lardan biri olarak kullanıyor.

Agent döngüsünü Anthropic SDK ile elle yazdım, framework kullanmadım. Model Claude Haiku; 15 tool'u var, hiçbir tool'un çözemediği hesaplarda Python yazıp Anthropic'in izole sandbox'ında çalıştırıyor. Ayarlamada hiç kullanmadığım 110 soruluk validation setinde 107 cevap anlamca doğru, prompt injection denemelerinin 10'unda da yönergeye uydu.

## Ne işe yarıyor?

mevzuat-rag'i geliştirirken bazı soruların retrieval problemi olmadığını gördüm. "Mezun olmak için neyim eksik?" sorusunun cevabı hiçbir maddede yazmıyor. Öğrencinin transkripti, bölümün öğretim planı ve yönetmeliğin mezuniyet kuralı yan yana konup hesaplanması gerekiyor. Klasik RAG'de her soru aynı yoldan geçer: ara, ilk 5 chunk'ı modele ver, cevap üret. Bu tür sorular o yoldan çözülmez.

Agent'a sorulan sorular şöyle:

- "Staj başvurusunu ne zamana kadar yapmam gerekiyor?" Mevzuattan, madde atıfıyla.
- "Mezun olmak için neyim eksik?" Yüklenen transkript, öğretim planı ve yönetmelik kurallarıyla hesaplanıyor.
- "Bu dönem bu üç dersten 70 alırsam ortalamam kaça çıkar?" Not simülasyonu.
- "B şubesinden alırsam neyle çakışır, Cuma boş kalabilir mi?" Ders programı ve şube planı.
- "Bilgisayar Donanımı ana bilim dalı başkanı kim?" Akademik personel verisi.
- "Bu hafta bölümden bir duyuru var mı?" Her gece taranan duyuru deposu.

Öğrenci üniversitenin sisteminden indirdiği transkript PDF'ini sohbete yükleyebiliyor. Arayüzde agent'ın hangi tool'ları çağırdığı ve cevabın kaynakları görünüyor; bir atfa tıklayınca ilgili madde açılıyor. Sistem kural ve "şunu yaparsam ne olur" hesabı veriyor, kararı danışmana bırakıyor.

## Teknik kısım

### Belgeler

Proje mevzuat-rag'in bir snapshot'ından türedi, ama hedef farklıydı: soru-cevap botu yerine bir danışman hocanın işini yapan bir agent. Corpus'u iki turda daralttım. Önce Mühendislik öğrencisine uygulanmayan belgeler çıktı (129 → 58), sonra danışmanlıkta işe yaramayanlar (58 → 24 belge, 685 chunk). Kalanlar lisans ve lisansüstü yönetmelikleri, staj, yatay ve dikey geçiş, intibak, çift anadal, yandal, akademik takvim gibi belgeler.

Tek fakülteli corpus'ta mevzuat-rag'in fakülte sorma mekanizmaları (netleştirme tetiği, kapsam etiketleri, staj için "hangi birim?" cevabı) yalnız gereksiz soru sorduruyordu, hepsini kaldırdım. Belgelerin yanına yapılandırılmış veri geldi: Bilgisayar Mühendisliği'nin öğretim planı (40 zorunlu ders ve seçmeli yuvaları), ders programı, akademik personel listesi ve SQLite'ta duran bir duyuru deposu.

### Agent döngüsü

Döngü basit: model her turda ya bir tool çağırıyor ya da cevabı yazıyor. Tool sonuçları mesaj olarak geri veriliyor. Tur sayısı sınırlı, böylece model sonsuza kadar tool isteyemiyor. System prompt ve tool tanımları prompt caching ile önbellekte duruyor.

LangGraph gibi bir framework yerine döngüyü elle yazmamın nedeni ihtiyaçların küçük olması. Tek agent, tek model ve stateless bir API var. Framework'ün getirdiği sunucu tarafı durum, kesintiye uğrayıp devam eden akış ve çoklu agent burada gerekmiyor. Sunucu tarafı code execution, sandbox'a dosya yükleme ve prompt caching doğrudan SDK ile daha kolay yazıldı; her tur ve tool çağrısı kendi kodumda loglanıyor. Kararı ve hangi durumda yeniden açılacağını bir ADR'de yazdım.

### Karar modelde, hesap kodda

Tasarımın merkezindeki kural bu. AKTS toplamak, dersleri öğretim planıyla eşlemek, ortalamayı hesaplamak, şube çakışmasını bulmak deterministik Python'da yapılıyor. Model yalnız hangi tool'u çağıracağını seçiyor ve sonucu cümleye döküyor; sayıları tool çıktısından olduğu gibi aktarıyor.

15 tool'un başlıcaları:

- `search_regulations`: mevzuat-rag'in hybrid retrieval ve reranker hattı.
- `list_articles`, `get_article`: bir belgenin maddelerini gezmek, atıf yapılan maddeye gitmek.
- `analyze_transcript`: transkripti öğretim planıyla karşılaştırıp geçilen AKTS'yi, eksik zorunluları ve seçmeli açığını çıkarıyor.
- `simulate_grades`, `simulate_courses`: "bu notları alırsam" ve "bu dersleri alırsam" hesapları.
- Mezuniyet şartları, ders programı, açılan seçmeliler, duyurular ve personel için birer tool.

Mezuniyet kuralları da veri olarak duruyor ve her kural madde referansı taşıyor: 240 AKTS (Madde 22/1), GNO en az 2,00, alan dışı seçmelinin kayıt yılına göre zorunlu olup olmadığı. Kural verisine yalnız mevzuatta yazan kural giriyor. Bir ara öğretim planındaki 244 AKTS de buradaydı; yönetmelikte 240 yazdığı için çıkardım.

Tool çıktısının biçimi de önemli çıktı. `analyze_transcript` ilk başta 10.700 karakterlik tam bir JSON rapor döndürüyordu. Önemli sayı ("bu dönemki dersleri geçersen 187 AKTS olur") etiketsiz bir alanda, soruya gerekmeyen bilgilerin arasında kalıyordu; model onu 5 denemenin yalnız 1'inde söyledi. Aynı hesaptan kodla üretilen, iki senaryoyu en başa koyan kısa bir özet verince 5'te 5 söyledi, giriş token'ı da 5.939'dan 2.461'e indi.

### Kişisel veri

Transkript bir tool argümanı değil. Yüklenince sunucu belleğinde bir closure'da duruyor, `analyze_transcript` onu kendisi okuyor ve modele yalnız değerlendirme raporu gidiyor. Öğrencinin adı, numarası ve kimlik numarası parser çıktısına hiç girmiyor; LLM'e, diske, log'a ve git'e de gitmiyor. Yükleme bu yüzden multipart değil ham PDF gövdesiyle yapılıyor: FastAPI multipart'ta 1 MB'ı aşan dosyayı geçici dosyaya yazıyor, bu da "diske hiçbir şey yazılmaz" kuralını bozardı. API stateless, geçmiş ve transkript istemcide kalıyor.

### Code execution

Hiçbir tool'un kapsamadığı bir hesapta ("AA aldığım derslerin toplam AKTS'si kaç?", "3. sınıfın haftada kaç saat dersi var?") model Python yazıyor. Kod bu makinede değil, Anthropic'in sunucu tarafı sandbox'ında çalışıyor: her soru yeni bir container, internet yok, yalnız o istekte yüklenen dosyalar görünüyor. Bunu ayrıca test ettim: yedi denemede sandbox'tan internete çıkılamadı, bizim sırlarımız orada yoktu, sorular arasında dosya kalmadı, dosyaya gömülü talimatlara uyulmadı. Bu yüzden ayrıca Docker kurmadım.

İlk sürümde model her soruda önce dosyaları keşfediyordu (`ls`, `head`); dosya şemasını görevle birlikte verince keşif turları kalktı ve süre 97 saniyeden 24-30 saniyeye indi. Üretilen kodlar log'a yazılıyor. Sık tekrar edenleri log'dan bulup kalıcı tool'a çevirdim; kod çalıştırılan soru sayısı 9'dan 1'e indi, cevaplar aynı kaldı (EXP-015).

### Model

Agent önce Gemini üzerindeydi, kod yazan kısım için de ayrı bir Haiku çağrısı vardı. Model seçimi kritik çıktı: Gemini 3.5 flash-lite'tan 3.1 flash-lite'a inmek cevap doğruluğunu 0,88'den 0,68'e düşürdü (p = 0,003) ve süreyi 4 katına çıkardı. İki modelli yapıda gereksiz devirler ve ortalama hesabında kayıplar oluyordu. Tek model Claude Haiku'ya geçince bunlar kalktı (EXP-010). Prompt caching değerlendirme koşusu başına maliyeti 0,27 dolardan 0,12 dolara indirdi.

### Duyurular

Duyurular corpus'a girmiyor, ayrı bir depoda duruyor. Bir scraper üniversitenin genel, fakültenin ve bölümün duyuru sayfalarını tarıyor; her duyurunun özetini Haiku çıkarıyor, linkleri kod ekliyor, hepsi SQLite'a yazılıyor ve BM25 ile aranıyor. Ayrıştırırken küçük ama önemli hatalar çıktı: `<strong>5</strong>00 TL` gibi bir HTML parçası "5 TL" diye okunuyordu. Deneylerde canlı depo yerine sabit bir snapshot ve sabit bir "bugün" tarihi kullanılıyor, yoksa sonuçlar günden güne değişirdi.

### Değerlendirme

mevzuat-rag'deki deney altyapısı aynen geldi: her değişiklik üst deneyinden tek farkı olan bir config, önceden yazılmış hipotez, commit hash'i ve eşleştirilmiş testler. Agent için metrikler genişledi: cevabın anlamca doğruluğu, gerekli tool'un çağrılıp çağrılmadığı, hesap doğruluğu ve süre.

İlk soru setleri sistem geliştirilirken, çoğu bulunan hatalara göre yazılmıştı; oradaki %96 doğruluk kısmen "sistemi o sorulara göre düzelttim" demekti. Bu yüzden iki yeni set yazdım. Yazarken sistemi hiç koşmadım; sorular, cevaplar ve kanıtlar PDF'lerin ham metninden geldi. Transkript sayılarını sistemin kodundan bağımsız, yönetmelikteki katsayı tablosuyla ayrıca hesapladım.

| Set | Ne için | Boyut |
|---|---|---|
| Dev | Prompt ve tool denemeleri | 53 soru |
| Validation | Yalnız ölçüm | 110 soru, 8 kategori |

Validation kategorileri: tek bilgi, birim ayrımı, koşul ve istisna, çapraz atıf, birleştirme, tarih, çekimser kalma ve prompt injection (7 doğrudan, 3 dosyaya gömülü dolaylı deneme).

Neyin işe yaradığı:

- **Duyuru ve personel tool'ları.** Bu konulardaki 15 yeni sorunun 1'ini doğru cevaplıyordu; tool'lar eklenince 13-14'ünü. Toplam doğruluk 0,83 → 0,96 (p < 0,05). Doğru tool, prompt'a kural eklemekten daha etkiliydi.
- **Madde gezinme tool'ları, belge düzeyi ve çelişki kuralı.** Aynı konuda iki belge çelişirse (YÖK yönetmeliği ile üniversite yönergesi gibi) agent hangisinin geçerli olduğunu belge düzeyi ve tarihine bakarak seçiyor. Validation'da 100/110'dan 107/110'a çıktı (EXP-021); bedeli soru başına %39 daha uzun süre.
- **Mutasyon testi.** Mezuniyet hesabının testlerini cosmic-ray ile sınadım: `graduation.py`'de 658 mutanttan başta 137'si hayatta kalıyordu, yeni testlerle 55'e indi. Kalanlar eşdeğer mutantlar. Yeni testler yaz döneminin sıralanması, yuvadan büyük ya da küçük AKTS'li seçmeliler, toplam AKTS'nin sınır değeri gibi boşlukları yakaladı. Şu an 345 test var.

İşe yaramayan en öğretici deney bir reflection loop'tu (EXP-018). Her taslak cevabı ayrı bir Haiku çağrısı denetliyor, eksik bulursa agent devam ediyordu. Doğruluk 43/53'ten 41/53'e düştü, süre 3 katına çıktı. Denetleyici ilk taslağa 53 sorunun 36'sında "eksik" dedi; doğru ve kesin cevapları kararsızlaştırdı ("staj ücreti %30" cevabı "iki oran var"a döndü). Kök neden, denetleyicinin agent'ın bildiklerini görmemesiydi: bugünün tarihi, öğrencinin bölümü, transkriptin yüklü olup olmadığı. Bunları uydurulmuş saydı.

### Bilinen zayıflıklar

- **Birleştirme soruları** en zayıf tür. Soru iki kaynak gerektiriyorsa (transkript ve bir kural, ders programı ve bir yönerge) agent bazen kural tarafını hiç aramıyor. "Bu dönem aldığım derslerden hangileri ortak zorunlu?" sorusunda yalnız transkript raporuna bakıp plandaki 8 zorunlu dersi saydı; doğrusu yönetmelikteki 3 ortak zorunlu ders.
- **Gereksiz tool çağrıları.** Hata sayılmıyor ama süreyi uzatıyor; soru başına 10-15 saniye.
- **Kapsam.** 24 belge ve tek bölümün öğretim planı ile ders programı var. Ders programında hoca bilgisi olmadığı için "bu dersi kim veriyor?" sorusu cevaplanamıyor.
