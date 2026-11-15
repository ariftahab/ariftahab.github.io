---
title: cyclar
summary: An app that turns a phone into a bike computer.
lead: A personal Flutter app that turns the phone on the handlebars into a bike computer you can read at a glance, instead of buying an expensive one.
year: 2026
stack: [flutter, gpx, dem, barometer]
order: 4

gallery:
  - { src: img/cyclar/harita.png, alt: map page }
  - { src: img/cyclar/veri.png, alt: data page }
---

## Summary

cyclar is a Flutter app that turns the phone on the handlebars into a bike computer. It shows a route imported from Strava on a map, gives speed and the current gradient in large numbers, and, most importantly, tells you how much longer the current climb lasts and how many metres until the next one. It records the ride itself and uploads it to Strava. It runs on Android and iOS.

## What does it do?

What I want to know most while riding is the gradient of the road I'm climbing and how long it keeps going. Bike computers like Garmin or Wahoo show this, but they're expensive. Strava doesn't show live gradient during a ride; to see the route's elevation you have to leave the ride screen. I wanted a bike computer on my handlebar phone that I could read at a glance and switch between map and data with a single swipe.

The app has two ride pages, switched with a horizontal swipe:

- **Map page.** The route line and your position; the map rotates with your heading and shows about 400–500 metres ahead. I use a map style with contour lines and trails, because I also ride on forest and mountain roads. Speed and a next-gradient strip sit at the bottom.
- **Data page.** Speed and local gradient at the top, as the largest numbers. Below them, "Section 9% · 150 m left", or inside a climb, "Climb avg. 6% · 1.4 km · +85 m". Outside a climb, "Next gradient: in 400 m · 5.2% · 150 m". The elevation profile of the next few kilometres is drawn with my position marked. Ride distance, moving time, average speed, total elevation gain and breaks are on this page too.

Gradient numbers are colour coded (descent blue, under 3% green, 3–6% yellow, 6–9% orange, 9% and above red), so I can tell how steep it is without reading the number. If I stray more than 40 metres from the route for longer than 10 seconds, both pages show a red warning and the direction back to the route. The ride starts by itself after a few seconds above 5 km/h and pauses below 3 km/h; pauses longer than 2 minutes count as breaks, red lights don't. It uses a light theme during the day and switches to dark after sunset.

When a route is imported you get a summary: total distance, total elevation gain, a colour-coded elevation profile and a list of climbs ("Climb 1: km 12.4 · 3.4 km · avg. 6.2% · +210 m"). I check the hard parts here before the ride.

Added later: estimated power from profile data, Bluetooth heart rate and cadence sensors, an end-of-ride summary and direct upload to Strava.

## Technical details

### Two gradient sources

The most important decision in the project is where the gradient comes from. There are two sources, and each does a different job:

- **Local gradient** (the big number on screen) is always measured from the phone's barometer. The elevation change over the last few tens of metres is smoothed and divided by horizontal distance. This is the road's real gradient: independent of the route, and unaffected by places where the elevation model is wrong, like bridges and viaducts.
- **Look-ahead information** (distance left in the section, climb average, next gradient) comes from the route's elevation profile. The barometer can only measure the past; only the route profile knows what's ahead.

The route profile is downloaded once from OpenTopoData (Copernicus/SRTM, 30 m resolution DEM) when the route is imported and stored on the phone. If there's no signal during the ride, the gradient information isn't lost. This has a cost: the big number and the DEM-based section gradient below it can differ by a few percent at the same moment. I accepted that knowingly, because they answer different questions.

Elevation in the ride recording also combines both sources: at the start of the ride the barometer is calibrated to the DEM elevation of the starting point, and later changes are tracked from the barometer. That way the elevation chart on Strava is both at the right level and smooth.

### Route analysis

Route analysis takes a GPX file and an elevation source and splits the route into short **gradient sections** (roughly 100–300 m) and **climbs**. I first tuned the algorithm in a Python prototype on a real route (a 39.9 km ride in Bolu), then ported it to Dart. The sections and climbs Python produces for the same GPX and elevations are stored as a test fixture and compared with the Dart output.

The definition of a climb changed several times:

- The first definition matched Garmin ClimbPro: at least 500 m and at least 3% average. It found 3 climbs on the Bolu route, but missed a 1 km, 3.4% hill at km 5.6–6.6. A short ramp and a flat section before it pulled the average down to 2.8%, and the whole stretch was discarded.
- A 100 m and 2.5% threshold produced 12 "climbs" on the same route; most were ramps of 3–11 metres.
- The chosen rule is similar to Wahoo's: **at least 250 m, at least 3% average, and length (m) × gradient (%) ≥ 1200**. So 400 m at 3%, down to 250 m as it gets steeper. A stretch that misses the average isn't thrown away; the longest valid piece inside it that starts and ends with an uphill section becomes the climb, and the same search repeats on either side. Dips shorter than 200 metres or losing less than 10 metres don't split a climb.

On the Bolu route the result is 5 climbs and 7 short ramps. Sloped parts outside the climbs (above 3.1%, no length requirement) are listed separately as "short ramps", because I want to be ready for those too while riding.

### Ride engine

The ride engine is pure Dart and independent of the UI. It takes timestamped sensor samples (GPS position, speed, accuracy, barometric pressure) and an optional route profile, and produces a single **snapshot** after each sample. Every field on screen comes from this snapshot: speed, distance, gradients, climb info, route position, off-route state, breaks.

The engine never reads the wall clock; time arrives with the samples. That's why a two-hour ride scenario runs instantly in a test. The same design made a simulation mode possible: it plays back a GPX as if riding it at 1× to 10× speed, so I can try every change at my desk without getting on the bike. On real rides the sensor samples are also written to a file; afterwards I can run the same ride through the engine again and see the effect of a setting.

For route matching, the position is projected onto the route line. On out-and-back routes the same road is passed twice; when there are several candidates, the nearest one ahead of the last known route position is chosen. So on the way back it doesn't jump from km 8 to km 32 and show the wrong gradient. Short GPS jumps and riding on the opposite lane don't trigger the off-route warning, because the warning needs both 40 metres and 10 seconds.

### Recording

Instead of leaving the ride recording to Strava, the app does it itself. The recording is written to disk continuously and incrementally as GPX; even if the app crashes or the phone shuts down, the unfinished recording is found on launch and resumed. If you switch to another app during the ride, it keeps counting in the background with a persistent notification. The screen stays on throughout the ride.

Uploading to Strava needs OAuth, and the token exchange requires a client secret. Putting the secret in the app would mean anyone could extract it by unpacking the APK. So the secret lives in a stateless Cloudflare Worker. The Worker only adds the secret to token requests and refreshes and forwards them to Strava; it stores and logs nothing. Ride data doesn't pass through the Worker; the phone talks to Strava directly. If the Worker can't be reached, uploading via the web remains as a fallback.

### Estimated power and sensors

Without a power meter, power is estimated with a well-known physics model:

```
P = v · [m·g·(sin θ + Crr·cos θ) + ½·ρ·CdA·v²] / η
```

`v` is GPS speed, `θ` the local gradient from the barometer, `m` the rider and bike weight. The user isn't asked for `CdA` or `Crr`: the drag area is body surface area computed from height and weight (Du Bois formula) multiplied by a position coefficient for the bike type, and rolling resistance also comes from the bike type. The value is shown as a 3-second moving average, 0 W when descending or coasting.

Heart rate and cadence are read from Bluetooth Low Energy sensors. Paired sensors are remembered and connect automatically at the start of a ride. Profile and settings live in small JSON files, without a database, only on the phone.

### Platforms

At first I was only targeting Android and Kotlin was suggested, but I chose Flutter because it left iOS possible later. The cost is accessing platform features like the foreground service, barometer and map through packages. The decision paid off later: when iOS support was wanted, the ride engine, route analysis and UI worked unchanged because they're pure Dart. The only thing that changed was the thin layer touching the platform. I replaced most of the Kotlin channels I had written by hand on Android with packages that work on both platforms. For the one place packages couldn't handle (accessing a GPX opened from the Files app), 4 lines of Swift were enough.

I pick the platform with Flutter's `defaultTargetPlatform` rather than `Platform.isAndroid`. `Platform.isAndroid` depends on the machine running the tests: when it returned `false` on macOS, a test waited forever.

### Interface

The interface was redone once from scratch. The first version worked but looked raw: plain boxes, no grouping, the same information in two places. When a few other cyclists wanted to use it too, I redesigned the screens. First I picked one of five visual styles, then picked and blended parts from several functional layouts. The goal was screens that are easier to read at a glance while riding, without losing any feature. The values you look at while riding (speed, gradient) are the largest; buttons are at the bottom, where the thumb reaches. The "End ride" button needs a long press so it isn't tapped by accident.

### Testing

The test boundary is two pure modules: route analysis (GPX and a fake elevation source → route profile) and the ride engine (sample stream → sequence of snapshots). The tests check behaviour, not internals, and read like real scenarios: "after a detour, rejoining the route further ahead updates the remaining distance".

I measured whether the tests actually catch anything with mutation testing. In one run I went through the 178 surviving mutants one by one: 94 were real gaps in the tests and got new tests, 50 were equivalent (didn't change behaviour), and 27 were `<` vs `<=` differences that only matter at the exact moment a continuous measurement equals the threshold. Where equality is normal, I did write tests: exactly 10 seconds with GPS samples arriving once a second, route distances that are multiples of 25 metres, whole numbers entered by the user. After the interface redesign I did the same for the UI code; surviving mutants went from 164 down to 17.
