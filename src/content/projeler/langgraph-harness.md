---
title: langgraph-harness
summary: Onaylı, iki katmanlı hafızası olan kişisel asistan.
lead: LangGraph üzerine kurulmuş, hafızasını kullanıcının kontrol ettiği ve her adımı izlenebilen tek kullanıcılı bir kişisel asistan.
year: 2026
stack: [langgraph, sqlite, qdrant, langfuse]
order: 3

diagram:
  cols: 6
  width: 760
  caption: cevap hemen döner; neyin hatırlanacağına arka planda ajanlar karar verir ve kalıcı hafızaya benim onayım olmadan hiçbir şey yazılmaz
  groups:
    - { label: chat graph, cols: [1, 4], rows: [0, 1] }
    - { label: arka planda · cevabı bekletmez, cols: [3, 5], rows: [2, 3] }
  nodes:
    - { id: ch, label: kanal, sub: terminal · telegram · web, col: 0, row: 0 }
    - { id: ctx, label: load_context, sub: profil + ilgili bilgiler, col: 1, row: 0 }
    - { id: agent, label: agent, sub: Haiku, col: 2, row: 0, hl: true }
    - { id: tools, label: tools, sub: hafıza · GitHub · web, col: 3, row: 0 }
    - { id: persist, label: persist_turn, sub: turu kaydet, col: 2, row: 1 }
    - { id: epi, label: epizodik hafıza, sub: SQLite + Qdrant, col: 3, row: 1, store: true }
    - { id: gate, label: memory gate, sub: hatırlanmalı mı?, col: 3, row: 2, hl: true }
    - { id: sum, label: summarizer, sub: ADD · UPDATE · DELETE, col: 5, row: 2 }
    - { id: review, label: onay kuyruğu, sub: /review, col: 4, row: 3 }
    - { id: lora, label: LoRA eğitimi, sub: küçük yerel model, col: 5, row: 3 }
    - { id: facts, label: semantik bilgiler, sub: kalıcı hafıza, col: 1, row: 3, store: true }
  edges:
    - { from: ch, to: ctx }
    - { from: ctx, to: agent }
    - { from: agent, to: tools, both: true }
    - { from: agent, to: persist }
    - { from: persist, to: epi }
    - { from: persist, to: gate }
    - { from: gate, to: sum, label: 50 tur / "kaydet" }
    - { from: sum, to: review, dir: v }
    - { from: review, to: facts, label: onaylanan }
    - { from: review, to: lora, dashed: true }
    - { from: facts, to: ctx, dashed: true, label: her turda }
---
