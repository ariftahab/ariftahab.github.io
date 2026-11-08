---
title: agentic-rag
summary: Aynı mimarinin, aramayı ne zaman yapacağına kendisi karar veren agent sürümü.
lead: Mühendislik Fakültesi öğrencilerinin danışmanlık sorularına odaklanan, mevzuat-rag mimarisinden türetilmiş agentic bir RAG chatbot.
year: 2025
stack: [agent, gemini, mutation testing]
order: 2
github: https://github.com/ariftahab/agentic-rag

diagram:
  cols: 5
  caption: karar LLM'de, hesap kodda; ajan hangi aracı çağıracağını seçer, sayıları araçlar hesaplar, döngü en fazla 5 tur sürer
  groups:
    - { label: araçlar, cols: [3, 4], rows: [0, 2] }
  nodes:
    - { id: q, label: soru, sub: + transkript, col: 0, row: 1 }
    - { id: agent, label: ajan, sub: Gemini · araç seçer, col: 1, row: 1, hl: true }
    - { id: ans, label: cevap, sub: kaynaklı, col: 1, row: 2 }
    - { id: regs, label: search_regulations, sub: mevzuat-rag araması, col: 3, row: 0, span: 2 }
    - { id: trans, label: analyze_transcript, sub: eksik dersler · AKTS · GNO, col: 3, row: 1, span: 2 }
    - { id: sim, label: simulate_courses, sub: "\"bu dersleri alırsam?\"", col: 3, row: 2, span: 2 }
  edges:
    - { from: q, to: agent }
    - { from: agent, to: regs, both: true }
    - { from: agent, to: trans, both: true, label: çağrı / sonuç }
    - { from: agent, to: sim, both: true }
    - { from: agent, to: ans }
---

## Ne yapıyor

mevzuat-rag'in production sürümünden türetildi. Belge kümesi, bir Mühendislik Fakültesi öğrencisinin danışmanlığında ihtiyaç duyulan 24 belgeyle sınırlı. Sabit bir "ara ve cevapla" hattı yerine, aramayı ne zaman ve nasıl yapacağına ajan kendisi karar veriyor.

## Deney yaklaşımı

mevzuat-rag'deki disiplin burada da sürüyor: RAG bileşenlerindeki her değişiklik, tek parametreyi değiştiren ve tekrar üretilebilen bir deney olarak kaydediliyor. Testlerin gerçekten hata yakalayıp yakalamadığı da mutation testing ile ölçülüyor.
