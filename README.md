# blog

Kişisel site: projeler ve yazılar. Astro ile üretilen statik site, GitHub Pages'te yayınlanır.

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:4321/
npm run build    # dist/ klasörüne üretir
```

## Yeni yazı

`src/content/yazilar/` altına bir `.md` dosyası ekle. Dosya adı URL olur (`ilk-yazi.md` → `/yazilar/ilk-yazi/`).

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

Bir projeye bağlı yazılar iki yerde görünür:

- **Proje sayfasında** tam metin olarak, eskiden yeniye art arda. Proje sayfası böylece o projenin baştan sona hikâyesi olur.
- **Proje sayfasının en altında ve `/yazilar/` sayfasında** tek tek, yenisi en üstte.

## Yeni proje

`src/content/projeler/` altına bir `.md` dosyası ekle. Alanlar `src/content.config.ts` içinde açıklanıyor.

- `diagram` (isteğe bağlı): sistem şeması. Düğümler bir ızgaraya `col`/`row` ile yerleşir, `edges` okları, `groups` kesikli çerçeveleri çizer. Alanlar `src/lib/diagram.ts` içinde. Örnek için `mevzuat-rag.md`'ye bak. Şema bir şey anlatmıyorsa koyma.
- `gallery` (isteğe bağlı): yana kayan ekran görüntüleri. `src` yolu `public/` klasörüne göredir, örneğin `img/cyclar/harita.png`.

## Görseller

Dosyayı `public/img/` altına koy, Markdown'da `![açıklama](/img/dosya.png)` diye kullan.
