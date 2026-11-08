---
title: mevzuat-rag
summary: Üniversite yönetmeliklerinden soru cevaplayan, madde numarasıyla kaynak gösteren chatbot.
lead: Bolu Abant İzzet Baysal Üniversitesi mevzuatı üzerinden soru cevaplayan ve her bilginin yanında belge ve madde numarasını gösteren bir RAG chatbot.
year: 2025
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
