# blog

Kişisel site: projeler ve yazılar. Astro ile üretilen statik site, GitHub Pages'te yayınlanır.

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:4321/blog/
npm run build    # dist/ klasörüne üretir
```

## Yeni yazı

`src/content/yazilar/` altına bir `.md` dosyası ekle. Dosya adı URL olur (`ilk-yazi.md` → `/blog/yazilar/ilk-yazi/`).

```md
---
title: Başlık
subtitle: Listede başlığın altında görünen tek cümle.
date: 2026-11-10
proje: mevzuat-rag   # isteğe bağlı: yazı bu projenin sayfasında da listelenir
draft: true          # isteğe bağlı: sadece `npm run dev`'de görünür
---

Metin...
```

`proje` alanına `src/content/projeler/` altındaki bir dosyanın adı yazılır. Olmayan bir ad yazılırsa site derlenmez.

## Yeni proje

`src/content/projeler/` altına bir `.md` dosyası ekle. Alanlar `src/content.config.ts` içinde açıklanıyor. `flow` iş akışı diyagramını çizer: her öğe bir adım, iç içe liste paralel adımlar, `*` ile başlayan adım vurgulanır.

## Görseller

Dosyayı `public/img/` altına koy, Markdown'da `![açıklama](/blog/img/dosya.png)` diye kullan.
