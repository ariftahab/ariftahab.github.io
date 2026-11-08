---
title: mevzuat-rag
summary: Üniversite yönetmeliklerinden soru cevaplayan, madde numarasıyla kaynak gösteren chatbot.
lead: Bolu Abant İzzet Baysal Üniversitesi mevzuatı üzerinden soru cevaplayan ve her bilginin yanında belge ve madde numarasını gösteren bir RAG chatbot.
year: 2025
stack: [hybrid retrieval, reranker, gemini, fastapi]
order: 1
github: https://github.com/ariftahab/mevzuat-rag
flow: ["soru", ["BM25", "bge-m3"], "RRF", "reranker", "Gemini", "*cevap + atıf"]
flowCaption: soru → hybrid retrieval → rerank → kaynaklı cevap
---

## Ne yapıyor

Öğrenciler "Kaç dersten devamsızlık hakkım var?" gibi sorular soruyor. Chatbot cevabı yönetmelik, yönerge ve akademik takvim belgelerinden buluyor ve her bilginin yanında kaynağı veriyor, örneğin `[Yatay Geçiş Yönergesi, Madde 8]`. Cevap belgelerde yoksa uydurmak yerine "Bu konuda bilgim yok." diyor.

<div class="nums mono">
  <div><b>131</b><small>belge</small></div>
  <div><b>~3.800</b><small>madde chunk'ı</small></div>
  <div><b>51</b><small>kayıtlı deney</small></div>
  <div><b>0,88</b><small>cevap doğruluğu</small></div>
</div>

## Nasıl çalışıyor

- Mevzuat madde madde chunk'lanıyor, böylece her parça tek bir maddeye denk geliyor.
- Soru hem BM25 hem bge-m3 vektör aramasıyla aranıyor, sonuçlar RRF ile birleştiriliyor.
- Cross-encoder reranker en alakalı maddeleri seçiyor, Gemini bunlardan atıflı cevabı yazıyor.
- FastAPI backend'i, atıflara tıklanınca ilgili maddeyi açan bir web arayüzü sunuyor.

## Deney yaklaşımı

Her tasarım kararı tek bir parametreyi değiştiren bir deney olarak kaydediliyor. Hipotez deney koşmadan önce yazılıyor, sonuç commit hash'iyle saklanıyor ve fark eşleştirilmiş testlerle (McNemar, Wilcoxon) sınanıyor.

Doğruluk, sistem ayarlanırken hiç kullanılmayan ve öğrenci diliyle yazılmış bir validation setinde ölçülüyor. Yanlış cevaplar soru türüne ve hatanın oluştuğu katmana göre ayrıca analiz ediliyor.
