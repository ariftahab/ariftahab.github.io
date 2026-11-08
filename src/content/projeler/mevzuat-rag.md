---
title: mevzuat-rag
summary: Üniversite yönetmeliklerinden soru cevaplayan, madde numarasıyla kaynak gösteren chatbot.
lead: Bolu Abant İzzet Baysal Üniversitesi mevzuatı üzerinden soru cevaplayan ve her bilginin yanında belge ve madde numarasını gösteren bir RAG chatbot.
year: 2026
stack: [hybrid retrieval, reranker, gemini, fastapi]
order: 1
github: https://github.com/ariftahab/mevzuat-rag

diagram:
  cols: 6
  caption: belgeler bir kez madde madde bölünüp indekslenir; her soruda iki arama birleştirilir, en alakalı maddeler yeniden sıralanır ve cevap sadece bu maddelerden yazılır
  groups:
    - { label: her soruda, cols: [0, 5], rows: [0, 0] }
    - { label: indeksleme · bir kez, cols: [0, 1], rows: [2, 2] }
  nodes:
    - { id: q, label: soru, sub: öğrenci dili, col: 0, row: 0 }
    - { id: search, label: hybrid arama, sub: BM25 + bge-m3, col: 1, row: 0 }
    - { id: rrf, label: RRF, sub: listeleri birleştir, col: 2, row: 0 }
    - { id: rerank, label: reranker, sub: cross-encoder, col: 3, row: 0 }
    - { id: llm, label: Gemini, sub: sadece bu maddeler, col: 4, row: 0 }
    - { id: ans, label: cevap, sub: "[Yönerge, Madde 8]", col: 5, row: 0, hl: true }
    - { id: idx, label: indeks, sub: vektör + BM25, col: 1, row: 1, store: true }
    - { id: pdf, label: PDF'ler, sub: 131 belge, col: 0, row: 2 }
    - { id: chunk, label: madde chunk'ları, sub: ~3.800 parça, col: 1, row: 2 }
  edges:
    - { from: q, to: search }
    - { from: search, to: rrf }
    - { from: rrf, to: rerank }
    - { from: rerank, to: llm }
    - { from: llm, to: ans }
    - { from: pdf, to: chunk }
    - { from: chunk, to: idx }
    - { from: idx, to: search, dashed: true }
---

## Özet

mevzuat-rag, Bolu Abant İzzet Baysal Üniversitesi'nin yönetmelik, yönerge ve akademik takvimlerinden öğrenci sorularını cevaplayan bir RAG chatbot. Her cevabın yanında bilginin geldiği belgeyi ve madde numarasını veriyor; belgelerde olmayan bir şey sorulursa uydurmak yerine "Bu konuda bilgim yok." diyor. 131 belge, yaklaşık 3.800 chunk üzerinde çalışıyor. Öğrencinin kendi diliyle yazılmış ve sistemi ayarlarken hiç kullanmadığım 111 soruluk validation setinde cevapların %88'i anlamca doğru.

Projenin asıl ağırlığı modelde değil ölçümde. Pipeline'daki her karar (PDF okuyucu, chunking, embedding modeli, reranker, prompt, LLM) tek parametresi değişen kayıtlı bir deney olarak verildi. Şu an 52 deney var; reddedilenler de günlükte duruyor.

## Ne işe yarıyor?

Üniversite mevzuatı yüzden fazla PDF'e dağılmış durumda. "Kaç dersten devamsızlık hakkım var?", "Yatay geçiş için not ortalamam kaç olmalı?", "Bahar finalleri ne zaman?" gibi bir sorunun cevabı bunlardan birinin bir maddesinde yazıyor, ama hangisinde olduğunu bilmek gerekiyor. Üstelik aynı konu farklı fakültelerde farklı düzenlenmiş olabiliyor: devam zorunluluğu genel yönetmelikte %70, Tıp Fakültesi'nde %75.

Chatbot bu soruları öğrencinin yazdığı haliyle alıyor ve cevabı ilgili maddeden kuruyor:

- **Kaynaklı cevap.** Cevaptaki her bilginin yanında küçük bir atıf numarası var, altta numaralı bir kaynak listesi çıkıyor. Bir kaynağa tıklayınca yan panelde maddenin tam metni açılıyor; atıf fıkra numarası taşıyorsa o fıkra vurgulanıyor. Panelden PDF'in ilgili sayfasına gidilebiliyor.
- **Çekimser kalma.** Belgelerde olmayan konularda (yemekhane ücreti, kampüs adresi) "bilgim yok" diyor. Validation setinde bu türden 15 sorunun 15'inde doğru davrandı.
- **Takip soruları.** "Peki bunun son günü ne?" gibi bir soru, sohbet geçmişine bakılarak kendi başına anlamlı bir soruya çevriliyor ve öyle aranıyor.
- **Fakülteye göre değişen kurallar.** Kural fakülteye göre değişiyorsa ve öğrenci fakültesini söylemediyse genel kuralı verip "Hangi fakültedesin?" diye soruyor.

![Sohbet ekranı: cevaptaki numaralı atıflar ve tıklanınca açılan madde paneli](/img/mevzuat-rag/sohbet.png)

Sohbet ekranının yanında belgeleri ve chunk'larını gezmek için bir sayfa, kullanıcıların sorduğu soruları ve cevapları doğru/yanlış diye etiketlemek için şifreli bir yönetici paneli var. Arayüz bir süre Cloudflare Tunnel üzerinden arkadaşlarımın kullanımına açıktı; ilk hataların çoğunu bu gerçek sorular gösterdi.

## Teknik kısım

### Belgeler ve chunking

PDF'ler `pdfplumber` ile okunuyor. Mevzuatın doğal birimi madde olduğu için sabit boyutlu bölme yerine **structural chunking** kullanıyorum: her madde bir chunk. 1.500 karakteri aşan maddeler fıkra sınırından bölünüyor, akademik takvimde her tablo bir chunk oluyor. Bilgisayar Mühendisliği'nin ders programı ve personel listesi JSON olarak geliyor; orada her ders ve her kişi ayrı bir chunk. Her chunk'ın başında `BAİBÜ Yatay Geçiş Yönergesi - Madde 8 (Kurumlar arası yatay geçiş)` gibi bir etiket ve atıf için belge, madde, sayfa metadata'sı duruyor.

Bu karar ilk büyük kazançtı. Prototipteki sabit boyutlu bölme bazı maddeleri ikiye ayırıyordu; yapısal bölmeye geçince doğru chunk her soruda LLM'e ulaşmaya başladı (EXP-002: bağlam isabeti 0,78 → 1,00).

Madde regex'i zamanla genişledi, çünkü belgeler tek bir biçimde yazılmamış: `Madde 4.`, `MADDE 7 (Değişik...)`, `MADDE 17/A-`, PDF'te dipnot rakamı yapışmış `MADDE1 2-` gibi varyasyonlar var. Madde yapısı bulunamayan birkaç belge bütün metin üzerinden bölünüyor.

Chunk'lar `BAAI/bge-m3` ile embedding'e çevrilip FAISS'e yazılıyor. Index'in adı, onu etkileyen her şeyin hash'inden oluşan bir **fingerprint**: belge kümesi, chunking yöntemi, embedding modeli ve `ingest.py`'nin kendisi. Böylece her deney tam olarak kendi tanımladığı index'i kuruyor. Belge başına cache sayesinde yalnız değişen belgeler yeniden işleniyor; sıcak kurulum 316 saniyeden 0,2 saniyeye indi.

Corpus'u kurarken veri temizliği de gerekti. Aynı hash'e sahip kopyalar kolay bulunuyordu, ama metni %94-100 aynı olup hash'i farklı 8 çift daha vardı; bunlar context'te aynı maddeyi iki kez gösteriyordu. Çıkarınca context'teki kopya tekrarı 31'den 0'a indi.

### Retrieval

Soru iki yoldan aranıyor:

- **Vector search** (bge-m3, ilk 30 aday) anlam benzerliğini yakalıyor: "okuldan ayrılmak" ile "kayıt sildirme" farklı kelimeler ama vector'leri yakın.
- **BM25** (ilk 30 aday) kelime eşleşmesini yakalıyor: madde numaraları, "AKTS", "GNO" gibi terimler. Türkçe eklemeli bir dil olduğu için her kelimenin ilk 5 harfi alınıyor; "ortalamam", "ortalaması" ve "ortalamasının" hepsi `ortal` oluyor.

İki liste **Reciprocal Rank Fusion** ile birleşiyor. Her chunk, her listedeki sırası için `1 / (60 + sıra)` puan alıyor ve puanlar toplanıyor. Skorları değil sıraları toplamanın nedeni, cosine benzerliğinin 0-1 arasında, BM25 skorunun ise sınırsız olması.

Birleşen adaylar bir **cross-encoder reranker**'a (`BAAI/bge-reranker-v2-m3`) gidiyor. Embedding modeli soruyu ve chunk'ı ayrı ayrı vector'e çeviriyor; reranker ikisini birlikte okuyup bir ilgililik puanı veriyor. Daha yavaş ama çok daha hassas. En iyi 5 chunk LLM'e context olarak veriliyor.

Corpus 3 belgeden bütün mevzuata çıkınca asıl işi reranker yaptı. Diğer fakültelerin benzer yönetmelikleri distractor olarak devreye girdi ve vector search'ün MRR@10'u 0,94'ten 0,60'a düştü. RRF sonrası 0,59 olan sıralamayı reranker 0,86'ya çıkardı (EXP-015). Reranker'a giden aday sayısı da önemliydi: başta 8'di ve doğru chunk RRF'te 9. sırada kalınca reranker onu hiç görmüyordu. 30'a çıkınca bu darboğaz kalktı (EXP-021). Reranker'ı fp16'ya almak sıralamayı birebir aynı bıraktı, süresini 1.372 ms'den 363 ms'ye indirdi (EXP-022). GPU'da (RTX 4050, 6 GB) bütün retrieval yaklaşık 400 ms sürüyor; prototipte CPU'da 5,4 saniyeydi.

### Cevap üretimi

Cevabı Gemini 3.1 flash-lite yazıyor. Seçme nedenim pratik: API'de günde 500 ücretsiz istek veriyor ve her deney 100-200 istek tutuyor. Daha yeni 3.5 flash-lite'ı da ölçtüm (EXP-035); doğruluk anlamca aynı çıktı, LLM süresi 4 saniyeden 14,5 saniyeye çıktı, o yüzden 3.1 kaldı.

System prompt modele yalnız context'teki bilgiyi kullanmasını, her bilgiye `[Belge, Madde N]` biçiminde atıf vermesini ve cevap yoksa "bilgim yok" demesini söylüyor. Takip sorularında önce ayrı bir LLM çağrısı soruyu bağımsız bir soruya çeviriyor (query rewriting), retrieval bu soruyla yapılıyor.

En çok uğraştığım yer fakülteye göre değişen kurallar oldu. Fakülte belirtilmemiş bir soruda iki yol vardı: bütün fakültelerin kuralını getirip saymak ya da genel kuralı verip fakülteyi sormak. İkincisini seçtim, çünkü öğrenci fakültesini söyleyince sistem doğru maddeyi zaten iyi buluyordu (17 sorunun 16'sında). Telefondan soran biri de beş fakültenin listesini okumak istemez.

Fakülteyi sorma kararını önce prompt'la LLM'e bıraktım; model soruların %45'inde gereksiz yere fakülte sordu (EXP-025). Sonra kararı koda aldım: her belgenin kapsamı bir JSON dosyasında etiketli (genel, tıp, diş, hukuk, lisansüstü, önlisans...). Context'te en az iki farklı paralel kapsamın belgesi varsa ve soru bir fakülteyi adıyla anmıyorsa netleştirme prompt'u devreye giriyor (EXP-027). Ana prompt'u da "önce cevabı içeren belgeleri belirle; cevap hem genel belgede hem ayrı bir fakülte belgesinde varsa sor" diye yeniden yazınca gereksiz sorma oranı 0,28'e indi (EXP-037). Hâlâ gerektiğinden sık soruyor, ama bunu bilerek kabul ettim: sormamanın bedeli yanlış kurala güvenen bir öğrenci, fazla sormanın bedeli bir mesaj.

Bazı durumlar LLM'e hiç gitmiyor. Yaz öğretimi yönetmeliği yürürlükten kalkmış, ama 19 belgede eski atıfları duruyor ve model bunlardan eskimiş cevap kuruyordu. Soru yaz okulunu soruyorsa retrieval yapılmadan sabit bir cevap dönüyor. Staj sürelerinde de benzer bir kural var: birim belirtilmediyse önce birimi soruyor. Gemini bazen cevabı kaynağı kopyaladığı gerekçesiyle engelleyip boş dönüyor (RECITATION); bu durumda istek bir kez "kendi cümlelerinle yaz" notuyla tekrarlanıyor.

### Uygulama

Backend FastAPI. Katmanlar ayrı: arayüz → `api.py` → `service.py` (log, rate limit) → `rag.py` (RAG çekirdeği). API stateless; sohbet geçmişi istemcide tutuluyor ve her istekle geliyor. Modeller sunucu açılırken bir kez yükleniyor.

Önce Gradio denedim, ama atıfları tıklanabilir yapmak ve madde panelini açmak onun bileşen modeline uymadı. Arayüzü vanilla HTML, CSS ve JavaScript ile yeniden yazdım. LLM cevabı DOMPurify'dan geçiyor, PDF endpoint'i yalnız corpus'taki dosyaları veriyor (path traversal'a karşı), yönetici paneli HTTP Basic Auth ile korunuyor. Arkada günlük kotalı bir API durduğu için `/ask`'te kişi başı ve sunucu toplamı rate limit var. Sohbet kayıtları JSONL olarak yazılıyor ve repoya girmiyor.

### Değerlendirme

Her değişiklik `experiments/configs/EXP-XXX.json` dosyasında tanımlı bir deney. Üst deneyinden tek bir parametre farklı oluyor; neden, hipotez ve beklenen yön deney koşmadan önce yazılıyor. Sonuç dosyası deneyin koşulduğu commit hash'ini saklıyor. Değişimin şans eseri olup olmadığına aynı sorular üzerinde eşleştirilmiş testlerle (McNemar, Wilcoxon) bakılıyor.

Tek değişken kuralının neden önemli olduğunu ilk gün gördüm. Embedding'leri normalize etmek MiniLM'de sonucu kötüleştirdi (EXP-003), embedding modelini bge-m3'e geçirmek ise çok iyileştirdi (EXP-004, MRR@10 0,65 → 0,92). İkisini aynı anda yapsaydım toplamda iyileşme görecek, normalization'ın zararını hiç fark etmeyecektim.

Retrieval ölçümü kanıta dayalı: her sorunun yanında kaynakta birebir geçen bir kanıt cümlesi var ve bir chunk yalnız bu cümleyi içeriyorsa ilgili sayılıyor. İlk ölçütüm "doğru madde numarası geldi mi?" diye bakıyordu; prototipin chunk'larında madde numarası olmadığı için her şeyi doğru gösteriyordu. Kanıtla ölçünce prototipte 27 sorunun 5'inde doğru chunk'ın ilk 10'da bile olmadığı ortaya çıktı. Pipeline'ın her aşaması (vector, BM25, RRF, reranker) ayrı ölçülüyor; böylece bir hatanın doğru chunk'ın hiç aday listesine girmemesinden mi, yoksa listede aşağıda kalmasından mı geldiği ayrılabiliyor.

Cevap doğruluğu için anahtar kelime eşleşmesi yalnız ön tarama, çünkü Türkçede yanıltıcı: "karşılanmamaktadır" cevabı "karşılanmaz" beklentisini kaçırıyor, "kesilmez" cevabı "kesil" beklentisiyle yanlışlıkla eşleşiyor. Asıl ölçü anlamca doğruluk: cevapları soru soru okuyorum, her kararın gerekçesi repoda duruyor.

Üç soru seti var, train/validation/test ayrımı gibi:

| Set | Ne için | Boyut |
|---|---|---|
| Dev | Prompt, eşik ve retrieval kararları | 113-219 soru (sürümlü) |
| Validation | Yalnız production adayını doğrulamak | 111 soru |
| Kilitli test | En sonda bir kez | 115 soru |

Soru setleri hiç değiştirilmiyor; değişiklik gerekince yeni sürüm açılıyor, çünkü set değişince eski sonuçlarla karşılaştırma geçersiz oluyor. Her soru bir tür taşıyor (belgenin terimleriyle, öğrenci diliyle, birden fazla madde, belgede yok, konu dışı, yazım hatalı, netleştirme, takip, yanlış öncül) ve sonuçlar tür tür raporlanıyor.

Güncel sistem dev setinde %94, validation setinde %88 anlamca doğru. Aradaki fark dev setine uyumdan geliyor: kararları dev setine bakarak verdim, gerçeğe yakın sayı validation.

### Denenip alınmayanlar

Alınmayan deneyler de en az alınanlar kadar şey öğretti:

- **BM25'i çıkarmak.** BM25'in tek başına anlamlı bir katkısı gösterilemedi (EXP-007, EXP-031), ama madde numarası ve kısaltmalar için tuttum. Latency farkı yok.
- **Türkçe stemmer.** Snowball Türkçe stemmer BM25'i kötüleştirdi (EXP-049): soru kelimelerini fazla kısaltıyor, "yüzde" "yüz" oluyor.
- **Resmi belge adları.** Chunk başlığına dosya adı yerine resmi belge adını koymak MRR@10'u 0,830'dan 0,814'e düşürdü (EXP-042): fakülte adı geçen başlıklar genel sorularda fakülte yönetmeliklerini öne itti.
- **Eksik fakülteleri ayrıca aramak.** Context'te eksik kalan fakülte yönetmeliklerini ayrıca arayıp eklemek (EXP-026) soruların %43'ünde tetiklendi, context'i %21 uzattı, yalnız 2 soruyu düzeltti.
- **Query decomposition.** Çok parçalı soruları LLM'le alt sorulara bölüp ayrı aramak bağlam isabetini 0,871'den 0,903'e çıkardı, ama anlamca doğruluk 0,94'ten 0,92'ye düştü (EXP-052). Daha çok doğru chunk geldi, ama context daha gürültülü oldu.

### Bilinen zayıflıklar

Validation setindeki 21 yanlış cevabın 19'unda sorun retrieval'da, 2'sinde modelin çıkarımında.

- **Tek mesajda iki şey soran sorular** (7/12). "Staj yerimi değiştirirsem kaç gün önce söylemeliyim, raporu ne zaman teslim edeceğim?" Soru tek bir embedding'e çevrildiği için ikinci maddenin chunk'ı context'e girmiyor.
- **Fakülteye göre değişen kurallar** (9/12). Genel yönetmelik kuralı bir tabloyla ya da farklı bir terimle yazıyorsa reranker onu, aynı kuralı cümleyle yazan fakülte yönetmeliğinin altına itiyor.
- **Türkçe karakter kullanılmadan yazılan sorular** (8/10). "hazirlikta derslerin yuzde kacina" gibi sorularda doğru chunk aday listesine giremiyor. BM25'te karakter katlama (ı→i, ü→u) doğru chunk'ı RRF'te 47. sıradan 8.'ye çıkarıyor, ama reranker onu yine ilk 5'in dışına itiyor (EXP-050). Darboğaz artık reranker.
- **Örtük çıkarım.** Yönerge "uyarı cezası hariç disiplin cezası alanın bursu kesilir" diyor, öğrenci "kınama aldım, bursum kesilir mi?" diye soruyor. Doğru madde context'te olduğu halde model kınamanın bu kapsama girdiğini çıkaramıyor.

Kilitli test seti henüz koşulmadı; bütün ayarlar bitince bir kez koşulacak.

Aynı mevzuatın üstüne kurulu, araç çağıran bir sürümü ayrı bir proje olarak geliştirdim: [agentic-rag](/projeler/agentic-rag/). Orada bu pipeline, agent'ın tool'larından biri.
