// Draws a simple left-to-right workflow diagram into every [data-flow] element.
// data-flow is a JSON array; each item is a step label, or an array of labels drawn stacked (parallel steps).
// A label starting with "*" is highlighted.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  // Thumbnails use a narrower canvas so labels stay readable when scaled down.
  const SIZES = { full: { W: 640, BOX_H: 40, GAP: 28, VGAP: 14 }, thumb: { W: 340, BOX_H: 30, GAP: 16, VGAP: 10 } };
  let W, BOX_H, GAP, VGAP;

  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  }

  function draw(host) {
    const isThumb = host.classList.contains("thumb");
    ({ W, BOX_H, GAP, VGAP } = isThumb ? SIZES.thumb : SIZES.full);
    const steps = JSON.parse(host.dataset.flow).map(s => (Array.isArray(s) ? s : [s]));
    const maxStack = Math.max(...steps.map(s => s.length));
    const H = maxStack * BOX_H + (maxStack - 1) * VGAP + 20;
    const n = steps.length;
    const boxW = (W - 20 - GAP * (n - 1)) / n;
    const mid = H / 2;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: isThumb ? "flow small" : "flow" }, host);
    let prev = null; // {x, ys}

    steps.forEach((col, i) => {
      const x = 10 + i * (boxW + GAP);
      const colH = col.length * BOX_H + (col.length - 1) * VGAP;
      const ys = col.map((_, j) => mid - colH / 2 + j * (BOX_H + VGAP) + BOX_H / 2);

      if (prev) {
        prev.ys.forEach(py => ys.forEach(cy => {
          const x1 = prev.x + boxW, x2 = x, mx = (x1 + x2) / 2;
          el("path", { d: `M${x1} ${py} C${mx} ${py} ${mx} ${cy} ${x2} ${cy}` }, svg);
        }));
      }

      col.forEach((label, j) => {
        const hl = label.startsWith("*");
        const text = hl ? label.slice(1) : label;
        el("rect", { x, y: ys[j] - BOX_H / 2, width: boxW, height: BOX_H, rx: 6, class: hl ? "hl" : "" }, svg);
        const t = el("text", { x: x + boxW / 2, y: ys[j] }, svg);
        t.textContent = text;
        // shrink long labels to fit the box
        const len = t.getComputedTextLength();
        if (len > boxW - 12) t.setAttribute("textLength", boxW - 12), t.setAttribute("lengthAdjust", "spacingAndGlyphs");
      });

      prev = { x, ys };
    });
  }

  document.querySelectorAll("[data-flow]").forEach(draw);
})();
