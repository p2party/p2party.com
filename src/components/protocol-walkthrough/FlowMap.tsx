import { useEffect, useRef } from "react";
import type { Frame } from "./stories";

type Box = { x: number; y: number; w: number; h: number };
type XY = { x: number; y: number };

function boundary(box: Box, toward: XY): XY {
  const dx = toward.x - box.x,
    dy = toward.y - box.y;
  const t = Math.min(
    dx === 0 ? Infinity : (box.w / 2 + 3) / Math.abs(dx),
    dy === 0 ? Infinity : (box.h / 2 + 3) / Math.abs(dy),
  );
  return { x: box.x + t * dx, y: box.y + t * dy };
}
function between(a: XY, bend: XY, b: XY, t: number): XY {
  const s = 1 - t;
  return {
    x: s * s * a.x + 2 * s * t * bend.x + t * t * b.x,
    y: s * s * a.y + 2 * s * t * bend.y + t * t * b.y,
  };
}

export function FlowMap({ frame, still }: { frame: Frame; still: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const theme = window.matchMedia("(prefers-color-scheme: dark)");
    const start = performance.now();
    let handle = 0;
    function draw(now: number) {
      if (!ctx || !element) return;
      cancelAnimationFrame(handle);
      const { width, height } = element.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const pw = Math.round(width * dpr),
        ph = Math.round(height * dpr);
      if (element.width !== pw || element.height !== ph) {
        element.width = pw;
        element.height = ph;
      }
      ctx.setTransform(pw / width, 0, 0, ph / height, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const dark = theme.matches;
      const ink = dark ? "#fafafa" : "#18181b";
      const paper = dark ? "#18181b" : "#fff";
      const muted = dark ? "#a1a1aa" : "#52525b";
      const accent = dark ? "#ffa76d" : "#a63612";
      const bg = dark ? "#3f2216" : "#fff1e7";
      const titleSize = width < 400 ? 12 : 16;
      const subSize = width < 400 ? 10 : 12;
      const titleFont = `750 ${titleSize}px system-ui, sans-serif`;
      const subFont = `500 ${subSize}px system-ui, sans-serif`;
      const boxes = frame.nodes.map(([x, y, name, sub]) => {
        ctx.font = titleFont;
        const titleWidth = ctx.measureText(name).width;
        ctx.font = subFont;
        return {
          x: x * width,
          y: y * height,
          w: Math.max(
            33,
            Math.max(titleWidth, ctx.measureText(sub || "").width) +
              (width < 400 ? 12 : 22),
          ),
          h: sub ? 45 : 30,
        };
      });
      const elapsed = Math.max(0, now - start);
      // Each transition plays once. Pause and reduced-motion use the same static frame.
      const duration = frame.waves ? 3200 : 2050;
      const progress = still ? 1 : Math.min(1, elapsed / duration);
      const selected = new Set(frame.active);
      const focus = new Set(frame.focus);
      for (const index of frame.active) {
        const [a, b] = frame.edges[index];
        focus.add(a);
        focus.add(b);
      }
      for (const active of [false, true]) {
        frame.edges.forEach(([a, b], index) => {
          if (selected.has(index) !== active) return;
          const from = boxes[a],
            to = boxes[b];
          const dx = to.x - from.x,
            dy = to.y - from.y,
            len = Math.hypot(dx, dy);
          const reciprocal = frame.edges.some(([i, j]) => i === b && j === a);
          const offset = reciprocal ? 18 : 0;
          const mid = {
            x: (from.x + to.x) / 2 - (offset * dy) / len,
            y: (from.y + to.y) / 2 + (offset * dx) / len,
          };
          const p = boundary(from, mid),
            q = boundary(to, mid);
          ctx.strokeStyle = active ? accent : dark ? "#66666f" : "#a1a1aa";
          ctx.lineWidth = active ? 2.5 : 1;
          ctx.setLineDash(active ? [] : [3, 5]);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.quadraticCurveTo(mid.x, mid.y, q.x, q.y);
          ctx.stroke();
          ctx.setLineDash([]);
          if (!active) return;
          const angle = Math.atan2(q.y - mid.y, q.x - mid.x);
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          for (const delta of [-0.47, 0.47])
            ctx.lineTo(
              q.x - 9 * Math.cos(angle + delta),
              q.y - 9 * Math.sin(angle + delta),
            );
          ctx.closePath();
          ctx.fill();
          const wave =
            frame.waves?.findIndex((indices) => indices.includes(index)) ?? 0;
          const localProgress = progress * (frame.waves?.length ?? 1) - wave;
          if (localProgress >= 0 && localProgress < 1) {
            const point = between(p, mid, q, localProgress);
            ctx.fillStyle = dark ? "#ffaf77" : "#f37335";
            ctx.strokeStyle = ink;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4.6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          }
        });
      }
      frame.nodes.forEach(([, , title, sub], i) => {
        const { x, y, w, h } = boxes[i],
          active = focus.has(i);
        const left = x - w / 2,
          top = y - h / 2;
        if (active) {
          ctx.fillStyle = dark ? "#865030" : "#efb08d";
          ctx.fillRect(left + 3, top + 3, w, h);
        }
        ctx.fillStyle = active ? bg : paper;
        ctx.fillRect(left, top, w, h);
        ctx.lineWidth = active ? 2 : 1;
        ctx.strokeStyle = active ? accent : muted;
        ctx.strokeRect(left, top, w, h);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = ink;
        ctx.font = titleFont;
        ctx.fillText(title, x, sub ? y - 7 : y);
        if (sub) {
          ctx.fillStyle = muted;
          ctx.font = subFont;
          ctx.fillText(sub, x, y + 10);
        }
      });
      if (progress < 1) handle = requestAnimationFrame(draw);
    }
    const refresh = () => draw(performance.now());
    const resize = new ResizeObserver(refresh);
    resize.observe(element);
    theme.addEventListener("change", refresh);
    refresh();
    return () => {
      cancelAnimationFrame(handle);
      resize.disconnect();
      theme.removeEventListener("change", refresh);
    };
  }, [frame, still]);
  const paths = frame.active.map((i) =>
    frame.edges[i].map((n) => frame.nodes[n][2]).join(" → "),
  );
  return (
    <canvas
      ref={canvas}
      role='img'
      aria-label={[frame.title, ...paths].join(". ")}
    />
  );
}
