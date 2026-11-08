---
title: rl-finetune-lab
summary: Fine-tune nasıl çalışıyor diye küçük bir modelle yaptığım denemeler.
lead: Lokal modelleri denemek ve fine-tune'un gerçekte nasıl çalıştığını anlamak için SFT, DPO ve GRPO'yu kendi bilgisayarımda küçük bir modelle denediğim bir öğrenme projesi.
year: 2026
stack: [sft, dpo, grpo, transformers]
order: 5
flow: ["base model", "SFT", "DPO", "*GRPO"]
flowCaption: aynı testte önce eğitilmemiş model, sonra her yöntemden geçmiş model ölçülüyor
---

## Neden

Belirli bir ürün yapmak yerine zanaatın kendisini öğrenmek istedim. Hedef basitti: eğitilmemiş modelle eğitilmiş modeli aynı testte karşılaştırmak ve SFT, DPO gibi yöntemlerin ne işe yaradığını ve verinin modele nasıl verildiğini görmek.

## Görevi seçmek

Model bir işi zaten biliyorsa eğitimin etkisini göremezsin. Bu yüzden modelin önceden bilemeyeceği bir görev uydurdum: hayali bir hidrolik test tezgâhı. Küçük bir simülatör sensör kayıtları üretiyor, model de arızayı, ilgili parçayı ve yapılacak işlemi söylüyor. Kuralları ben uydurduğum için model bunları bilemez, ve doğru cevabı her zaman kesin olarak biliyorum.

## Öğrendiğim şey

Bir modeli eğitmek, modelden önce görevi ve doğru cevabı tasarlamakla başlıyor. Eğitimden önce yapılan bir ölçüm olmadan da "daha iyi oldu" demek mümkün değil.
