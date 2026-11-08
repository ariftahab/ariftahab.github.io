---
title: langgraph-harness
summary: Onaylı, iki katmanlı hafızası olan kişisel asistan.
lead: LangGraph üzerine kurulmuş, hafızasını kullanıcının kontrol ettiği ve her adımı izlenebilen tek kullanıcılı bir kişisel asistan.
year: 2026
stack: [langgraph, sqlite, qdrant, langfuse]
order: 3
flow: ["mesaj", "graph", "*memory gate", "onay kuyruğu", "hafıza"]
flowCaption: her konuşmadan sonra neyin hatırlanacağına bir ajan karar veriyor, kalıcı hafızaya yazmadan önce benim onayım gerekiyor
---

## Ne yapıyor

Asistanın iki katmanlı bir hafızası var:

- **Epizodik hafıza:** Tüm konuşmalar ham haliyle SQLite'ta tutuluyor. Hem anlamca (Qdrant) hem filtrelerle (SQL) aranabiliyor ve hiç silinmiyor.
- **Semantik hafıza:** Benim elle yazdığım bir profil ve konuşmalardan çıkarılan, kaynağı belli tekil bilgiler.

## Hafıza nasıl yazılıyor

Her konuşmadan sonra bir **Memory Gate** ajanı, bu konuşmanın hatırlanmaya değer olup olmadığına karar veriyor. Bir **Summarizer** ajanı ise yaklaşık on konuşmalık pencereleri `ADD`, `UPDATE`, `DELETE` gibi hafıza işlemlerine çeviriyor. Bu işlemler doğrudan uygulanmıyor, bir onay kuyruğuna düşüyor. Ben onaylamadan semantik hafızaya hiçbir şey yazılmıyor.

## Küçük modellere devretmek

Her adım Langfuse ile izleniyor. Onay kuyruğundaki kararlarım, küçük yerel modelleri LoRA ile eğitmek için veri oluyor. Amaç, hafıza yönetimini zamanla Claude'dan bu küçük modellere devretmek. Önce "shadow mode"da, yani Claude'la yan yana çalışıp karşılaştırılarak.

## Neden

Bu aynı zamanda bir öğrenme projesi. Graph'lar hazır agent yardımcıları yerine düğüm düğüm, açık `StateGraph` ile kuruluyor. Böylece her parçanın ne yaptığını anlamak mümkün oluyor.
