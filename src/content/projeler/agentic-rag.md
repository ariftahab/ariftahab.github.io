---
title: agentic-rag
summary: Aynı mimarinin, aramayı ne zaman yapacağına kendisi karar veren agent sürümü.
lead: Mühendislik Fakültesi öğrencilerinin danışmanlık sorularına odaklanan, mevzuat-rag mimarisinden türetilmiş agentic bir RAG chatbot.
year: 2025
stack: [agent, gemini, mutation testing]
order: 2
github: https://github.com/ariftahab/agentic-rag
flow: ["soru", "*ajan", ["arama", "belge"], "cevap"]
flowCaption: ajan hangi aracı ne zaman çağıracağına kendisi karar veriyor
---

## Ne yapıyor

mevzuat-rag'in production sürümünden türetildi. Belge kümesi, bir Mühendislik Fakültesi öğrencisinin danışmanlığında ihtiyaç duyulan 24 belgeyle sınırlı. Sabit bir "ara ve cevapla" hattı yerine, aramayı ne zaman ve nasıl yapacağına ajan kendisi karar veriyor.

## Deney yaklaşımı

mevzuat-rag'deki disiplin burada da sürüyor: RAG bileşenlerindeki her değişiklik, tek parametreyi değiştiren ve tekrar üretilebilen bir deney olarak kaydediliyor. Testlerin gerçekten hata yakalayıp yakalamadığı da mutation testing ile ölçülüyor.
