---
title: cyclar
summary: Telefonu bisiklet yol bilgisayarına çeviren uygulama.
lead: Pahalı bir yol bilgisayarı almak yerine, gidondaki telefonu tek bakışta okunabilen bir bisiklet bilgisayarına çeviren kişisel bir Flutter uygulaması.
year: 2026
stack: [flutter, gpx, dem, barometre]
order: 4

gallery:
  - { src: img/cyclar/harita.png, alt: harita sayfası }
  - { src: img/cyclar/veri.png, alt: veri sayfası }
---

## Neden

Bisiklet sürerken rotayı, hızımı ve özellikle o an tırmandığım yolun eğimini ve bu eğimin ne kadar daha süreceğini görmek istiyordum. Garmin ve Wahoo bunu yapıyor ama çok pahalı. Strava ise sürüş sırasında anlık eğimi göstermiyor.

## Nasıl çalışıyor

- Strava'dan dışa aktarılan rota (GPX) içe aktarılıyor. Rotanın yükseklik verisi DEM'den bir kez alınıyor ve rota eğim bölümlerine ve tırmanışlara ayrılıyor.
- Sürüş sırasında iki sayfa var, yatay kaydırmayla geçiliyor: harita sayfası ve veri sayfası.
- Büyük rakamla gösterilen yerel eğim barometreden ölçülüyor. "Ne kadar kaldı" ve ortalama eğim bilgileri ise rotanın işlenmiş verisinden geliyor.
- Eğim renklerle gösteriliyor, böylece rakamı okumadan dikliği anlamak mümkün.
- Sürüş belli bir hızın üzerine çıkınca kendiliğinden başlıyor, durunca sayaçlar duraklıyor.
