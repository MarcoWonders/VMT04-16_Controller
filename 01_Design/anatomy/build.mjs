// Fig 1 - Heraeus-Vötsch VMT 04/16 temperature test chamber, right side and right insulation wall cut away.
// World units are millimetres (manual p. 3: housing 430 W x 485 D x 600 H, test space 310 x 230 x 200).
// node build.mjs [--light] [--audit]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL = "C:/Users/janse/.claude/skills/anatomy";
const kitUrl = (p) => pathToFileURL(join(SKILL, p)).href;
const k = await import(kitUrl("kit/iso-kit.mjs"));
const G = await import(kitUrl("kit/lathe.mjs"));
const { tubePieces, tubeSvg } = await import(kitUrl("kit/tube.mjs"));
const A = await import(kitUrl("kit/audit.mjs"));
const { boards } = await import("./boards.mjs");
const { kitScript } = await import(kitUrl("scripts/inline-kit.mjs"));

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 620;
const H = 740;

// ---------------------------------------------------------------- layout (mm)
const CAB = { x: 0, y: 0, w: 430, d: 485, r: 4 };
const TOP = 600;
const BENCH = { x: -46, y: -46, w: 522, d: 577, r: 14 };
const BENCH_Z = -22;
const DECK = 250;            // machine room 0..250, insulated box above
const TS = { x0: 60, x1: 370, y0: 195, y1: 425, z0: 318, z1: 514 };   // test space (liner inside)
const DUCT = { y0: 137, y1: 197 };                                     // air duct behind the baffle
const FRONT_INS = 470;       // front face of the insulated box (door leaf in front of it)
const CHASE_X = 380;         // pipe chase x 380..430, y < 195
const PANEL = { x0: 20, x1: 410, z0: 30, z1: 230, y: 485, t: 3 };     // control panel plate

const P = k.fitProjection(
  [...k.boxCorners(BENCH, BENCH_Z - 20, BENCH_Z), [0, 0, TOP + 250], [250, 0, TOP + 250], [430, 485, TOP + 250], [0, 485, TOP + 250], [430, 0, TOP], [10, 655, 588], [420, 655, 262], [0, 585, 30]],
  W, H, { pad: 26, azimuth: 30, elevation: 20 },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const Faded = (list, style) => k.fadedSvg(list, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const f2 = (v) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- recorder helpers (pattern from the arcade example)
// exploded view: five assemblies. "hold1/hold2" are empty slots in the stagger, so the plug door is clear of the
// insulated box before the box lifts, and the box is down again before the door slides back in.
const PIECES = {
  top: { name: "Top cover", move: [0, 0, 250] },
  door: { name: "Plug door", move: [0, 150, 0] },
  panel: { name: "Control panel", move: [0, 80, 0] },
  hold1: { name: "", move: [0, 0, 0] },
  hold2: { name: "", move: [0, 0, 0] },
  box: { name: "Insulated box with the air duct", move: [0, 0, 180] },
  base: { name: "Machine room and cabinet", move: [0, 0, 0] },
};
const STAGGER = ["top", "door", "panel", "hold1", "hold2", "box", "base"];
const SPRING = { stagger: 0.15, stiffness: 64, damping: 16, substeps: 4 };
let CUR = "base";
const asm = (id) => { CUR = id; };
const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const record = R.solid;
function put(name, ref, svg, shapes = [], { bias = 0, sys, ...rest } = {}) {
  const attrs = (sys ? ` data-sys="${sys}"` : "") + (rest.attrs ?? "");
  return R.put({ name, at: ref, bias, svg, shapes, piece: CUR, ride: CUR, move: PIECES[CUR].move, ...rest, attrs });
}
function box(name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.6, steps = 2, bevel = 0, extra = "", inner = "", bias = 0, sys, owner } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  const shape = record(A.slab(plan, z0, z1 - z0, { name, ...(owner ? { owner } : {}) }, steps));
  put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, sys });
  return shape;
}
function turned(name, F, profile, style = {}, { extra = "", inner = "", bias = 0, steps, bevel = 0, owner, sys, rims } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel, ...(steps ? { steps } : {}), ...(rims ? { rims } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = record(A.solid(F, profile, { name, ...(owner ? { owner } : {}) }));
  put(name, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style, inner }) + extra, [shape], { bias, sys });
  return shape;
}
const disc = (name, F, s0, s1, r, style = {}, options = {}) => turned(name, F, [[s0, r], [s1, r]], style, options);
const cyl = (name, cx, cy, r, z0, z1, style = {}, options = {}) => disc(name, G.frameAlong([cx, cy, z0], [0, 0, 1]), 0, z1 - z0, r, style, options);
function planeMatrix(o, ex, ey) {
  const p0 = at(o), px = at(G.add3(o, ex)), py = at(G.add3(o, ey));
  const v = (x) => x.toFixed(4);
  return `matrix(${v(px[0] - p0[0])} ${v(px[1] - p0[1])} ${v(py[0] - p0[0])} ${v(py[1] - p0[1])} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)})`;
}

// pipes and cables: fillet, gap under fittings, chunk, record
const ROUTES = {};
const FLOW = {};
function line(name, points, r, { tone = "mid", bend, gaps = [], rings, maxLength = 40, bias = 0.05, limp = false, sys, states, flow, owner, ends = [false, false] } = {}) {
  const route = G.fillet(points, Math.max(bend ?? r * 3, r * 2.6), 10, { P, tube: r });
  const total = G.pathLength(route);
  R.route(name, route, r, { gaps, limp, piece: CUR, ride: CUR, move: PIECES[CUR].move, ...(owner ? { owner } : {}) });
  ROUTES[name] = route;
  if (flow) {
    // screen samples every 2 mm for the moving refrigerant markers (drawn inside each chunk, so they sort with it)
    const pts = [];
    for (let at2 = 0; at2 <= total; at2 += 2) { const q = k.iso(G.pointAlong(route, at2), P); pts.push([f2(q[0]), f2(q[1])]); }
    FLOW[name] = { step: 2, total: f2(total), pts, ...flow };
  }
  const sysAt = (m) => (states ? (states.find(([a, b]) => m >= a && m < b) ?? [])[2] : sys);
  tubePieces(route, r, P, { maxLength, spacing: Math.max(0.8, Math.min(2.4, r)), gaps, ...(rings ? { rings } : {}) }).forEach((piece, index) => {
    const dots = flow ? `<path class="vc-flow" data-route="${name}" data-a="${f2(piece.from)}" data-b="${f2(piece.to)}" d=""/>` : "";
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone }) + dots, [A.tube(piece.points, piece.radii)], { bias, sys: sysAt((piece.from + piece.to) / 2), route: name, chunk: index });
  });
  ends.forEach((on, index) => {
    if (!on) return;
    const end = index ? route[route.length - 1] : route[0];
    const size = Math.max(0.6, r * KS * 0.9);
    put(`${name}.end${index}`, end, Dots([at(end)], { size, tone: "hi" }), [A.ball(end, size / KS, { name: `${name}.end${index}`, owner: name })], { bias: bias + 0.15 });
  });
  return { route, total };
}
// a fitting body turned on a straight stretch of a route: returns its gap
function onRoute(route, s0, s1) {
  const p0 = G.pointAlong(route, s0), t = G.tangentAlong(route, (s0 + s1) / 2);
  return { F: G.frameAlong(p0, t), len: s1 - s0 };
}

// ---------------------------------------------------------------- bench (static, behind everything)
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(BENCH, BENCH_Z - 20, 14, P)}"/>`);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of byDepth(k.corners(BENCH, 34))) {
  back.push(S(k.cylinder(x, y, 15, BENCH_Z - 20, 2, P, 32), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 11, BENCH_Z - 18, 4, P, 32), { tone: "mid" }));
}
back.push(S(k.slabOf(BENCH, BENCH_Z - 14, 14, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(BENCH, BENCH_Z - 6, P, 8), { tone: "faint" }) }));
back.push(Ln(k.planOutline(k.insetPlan(BENCH, 8), BENCH_Z, P), { tone: "lo" }));
const benchScrews = k.corners(BENCH, 14);
back.push(Ln(benchScrews.map(([x, y]) => k.ring(x, y, 3.4, BENCH_Z, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(benchScrews.map(([x, y]) => at([x, y, BENCH_Z])), { size: 0.5 }));
const STRIP = { x: BENCH.x + 30, y: BENCH.y + BENCH.d - 20, w: BENCH.w - 150, d: 10, r: 1.2 };
back.push(S(k.slabOf(STRIP, BENCH_Z, 0.8, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(STRIP.x + 5, STRIP.x + STRIP.w - 5, 5, 10, STRIP.y, BENCH_Z + 0.8, [2.6, 5], P);
back.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
const LABEL = { x: BENCH.x + BENCH.w - 106, y: BENCH.y + BENCH.d - 34, w: 80, d: 24, r: 1.5 };
back.push(S(k.slabOf(LABEL, BENCH_Z, 1, P, 4), { tone: "lo" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 2.4), BENCH_Z + 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + LABEL.w / 2, LABEL.y + 10], BENCH_Z + 1, P, "x"), "VMT 04/16", { size: 7.5, tone: "mid", anchor: "middle" }));
back.push(Ln([[8, 46], [8, 60], [8, 38]].map(([dx, len], i) => k.lineOnTop([LABEL.x + dx, LABEL.y + 15 + i * 2.8], [LABEL.x + dx + len, LABEL.y + 15 + i * 2.8], BENCH_Z + 1, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + 4, LABEL.y + 4, BENCH_Z + 1]), at([LABEL.x + LABEL.w - 4, LABEL.y + 4, BENCH_Z + 1])], { size: 0.45 }));
record(A.slab(BENCH, BENCH_Z - 14, 14, { name: "stand.bench", ground: true }, 8));

asm("base");
// ---------------------------------------------------------------- cabinet shell
for (const [x, y] of k.corners(CAB, 34)) {
  cyl(`foot.${x}.${y}`, x, y, 16, BENCH_Z, BENCH_Z + 4, { tone: "lo" });
  cyl(`foot.stem.${x}.${y}`, x, y, 6, BENCH_Z + 4, BENCH_Z + 14, { tone: "mid" });
  cyl(`foot.nut.${x}.${y}`, x, y, 11, BENCH_Z + 14, 0, { tone: "mid" }, { extra: Ln(G.ribsOf(G.frameAlong([x, y, BENCH_Z + 14], [0, 0, 1]), 0, -BENCH_Z - 14, 11, 6, P, { least: 0.05 }), { tone: "lo" }) });
}
box("pan", [0, 0, 0], [430, 485, 8], { tone: "lo" }, { r: 4, steps: 4, bevel: 0.6 });
box("wall.left", [0, 0, 8], [3, 485, 594], { tone: "mid" });
box("wall.back", [3, 0, 8], [430, 3, 594], { tone: "mid" });
box("wall.front", [3, 482, 8], [430, 485, DECK], { tone: "mid" });
box("deck.front", [3, 195, DECK], [372, 482, DECK + 6], { tone: "lo" });
box("deck.rear", [3, 3, DECK], [372, 195, DECK + 6], { tone: "lo" });
box("post.front", [422, 474, 8], [430, 482, 594], { tone: "mid" }, { extra: Dots([60, 200, 340, 480].map((z) => at([430, 478, z])), { size: 0.45, tone: "lo" }) });
box("post.back", [422, 3, 8], [430, 11, 594], { tone: "mid" }, { extra: Dots([60, 200, 340, 480].map((z) => at([430, 7, z])), { size: 0.45, tone: "lo" }) });
box("rail.top", [422, 11, 586], [430, 474, 594], { tone: "mid" });
box("rail.base", [422, 11, 8], [430, 474, 16], { tone: "mid" });
asm("top");
// top cover, cut back with the top-right block (x > 250, behind the door) to open the duct and the test space
const VENTS = [60,94,128,162,196,230,264,298,332,366];
box("cover.top", [0, 0, 594], [250, 485, TOP], { tone: "mid" }, {
  r: 3, steps: 4, bevel: 0.8,
  extra: Ln(VENTS.map((y) => k.planOutline({ x: 40, y, w: 150, d: 9, r: 4.5 }, TOP, P, 4)).join(""), { tone: "faint" }) + Dots([[14, 14], [14, 471], [236, 14], [236, 471]].map(([x, y]) => at([x, y, TOP])), { size: 0.5 }),
});
box("cover.front", [250, 425, 594], [430, 485, TOP], { tone: "mid" }, { r: 1, extra: Dots([at([416, 477.5, TOP])], { size: 0.5 }) });


asm("box");
// ---------------------------------------------------------------- insulated box (mineral wool, cut at x = 430) and stainless liner
box("ins.bottom.front", [3, 195, DECK + 6], [372, FRONT_INS, 316], { tone: "lo" });
box("ins.bottom.rear", [3, 75, DECK + 6], [372, 195, 316], { tone: "lo" });
box("ins.left", [3, 75, 316], [60, FRONT_INS, 516], { tone: "lo" });
box("ins.back", [60, 75, 316], [422, 135, 516], { tone: "lo" });
box("ins.top", [3, 75, 516], [250, FRONT_INS, 594], { tone: "lo" });
box("ins.top.front", [250, 425, 516], [422, FRONT_INS, 594], { tone: "lo" });
box("liner.floor", [60, 135, 316], [370, 425, 318], { tone: "mid" });
box("liner.ceiling", [60, 135, 514], [250, 425, 516], { tone: "mid" });
box("liner.left", [60, 135, 318], [62, 425, 514], { tone: "mid" });
box("liner.back", [62, 135, 318], [370, 137, 514], { tone: "mid" });

// air baffle (Luftvorsatzwand): air is drawn in through the centre grille and leaves at the top and bottom edges
const FAN = [158, 416];
{
  const grille = [];
  const M = planeMatrix([62, 199, 502], [1, 0, 0], [0, 0, -1]);
  const cx = FAN[0] - 62, cw = 502 - FAN[1];
  const holes = [];
  for (let u = -36; u <= 36; u += 8) for (let w = -36; w <= 36; w += 8) if (u * u + w * w < 34 * 34) holes.push(`M${f2(cx + u - 1.4)} ${f2(cw + w)}a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0`);
  grille.push(`<g transform="${M}"><circle class="iso-line" data-tone="lo" cx="${cx}" cy="${cw}" r="40"/><circle class="iso-line" data-tone="faint" cx="${cx}" cy="${cw}" r="44"/><path class="iso-line" data-tone="faint" d="${holes.join("")}"/></g>`);
  box("baffle", [62, 197, 330], [228, 199, 502], { tone: "mid" }, { extra: grille.join("") + Dots([[70, 495], [220, 495], [70, 337], [220, 337]].map(([x, z]) => at([x, 199, z])), { size: 0.45, tone: "lo" }) });
}

// ---------------------------------------------------------------- air handling: evaporator W3 (two finned packs), heater E2, fan M1
function pack(name, z0, z1) {
  const fins = [];
  for (let x = 70; x <= 340; x += 6) fins.push(k.lineOnTop([x, 143], [x, 180], z1, P));
  const ends = [];
  for (let z = z0 + 7; z <= z1 - 6; z += 10) for (const y of [150, 161.5, 173]) ends.push(at([345, y, z]));
  const frost = [];
  for (let x = 66; x <= 341; x += 5.5) for (const y of [147, 156, 165, 174]) frost.push(at([x + ((y * 7) % 3), y, z1]));
  for (let z = z0 + 4; z <= z1 - 3; z += 6) for (const y of [146, 152, 158, 164, 170, 176]) frost.push(at([345, y, z]));
  box(name, [62, 143, z0], [345, 180, z1], { tone: "mid" }, { extra: Ln(fins.join(""), { tone: "faint" }) + Dots(ends, { size: 0.7, tone: "lo" }) + `<g class="vc-frost">${Dots(frost, { size: 0.55 })}</g>`, sys: "W3" });
}
pack("W3.upper", 452, 497);
pack("W3.lower", 340, 380);
// tubular heater E2: four straight rods from the terminal wall (left liner) to a support bracket at the far end
box("E2.bracket", [338, 183, 318], [344, 195, 500], { tone: "mid" }, { extra: Dots([352, 376, 466, 490].map((z) => at([344, 189, z])), { size: 0.5, tone: "lo" }) });
[490, 466, 376, 352].forEach((z, i) => line(`E2.${i}`, [[62, 189, z], [338, 189, z]], 4, { tone: "hi", sys: "E2", maxLength: 70 }));
disc("W3.in.stub", G.frameAlong([345, 175, 490], [1, 0, 0]), 0, 8, 4.5, { tone: "mid" }, { owner: "W3" });
disc("W3.out.stub", G.frameAlong([345, 150, 360], [1, 0, 0]), 0, 8, 9.5, { tone: "mid" }, { owner: "W3" });
// fan M1: hub and blade ring behind the grille, shaft through the rear insulation to the motor
disc("M1.hub", G.frameAlong([FAN[0], 137, FAN[1]], [0, 1, 0]), 0, 15, 12, { tone: "mid" }, { owner: "M1" });
disc("M1.blades", G.frameAlong([FAN[0], 152, FAN[1]], [0, 1, 0]), 0, 7, 30, { tone: "mid" }, { owner: "M1" });
disc("M1.flange", G.frameAlong([FAN[0], 75, FAN[1]], [0, -1, 0]), 0, 5, 40, { tone: "mid" }, { owner: "M1motor" });
turned("M1.motor", G.frameAlong([FAN[0], 70, FAN[1]], [0, -1, 0]), [[0, 33], [44, 33], [48, 28, 1], [50, 18, 1], [51, 0]], { tone: "mid" }, {
  owner: "M1motor",
  inner: Ln(G.arcOf(G.frameAlong([FAN[0], 70, FAN[1]], [0, -1, 0]), 8, 33, P), { tone: "faint" }),
  extra: Faded(G.ribsOf(G.frameAlong([FAN[0], 70, FAN[1]], [0, -1, 0]), 12, 40, 33, 30, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }),
});
box("M1.terminal", [FAN[0] - 12, 34, FAN[1] + 33], [FAN[0] + 12, 56, FAN[1] + 45], { tone: "mid" }, { owner: "M1motor", extra: Dots([at([FAN[0] - 8, 38, FAN[1] + 45]), at([FAN[0] + 8, 52, FAN[1] + 45])], { size: 0.45 }) });

// ---------------------------------------------------------------- test space: sensors B1/B3, lamp E1, shelf, specimen, feed-through
for (const [name, x] of [["B3", 206], ["B1", 228]]) {
  cyl(`${name}.gland`, x, 212, 7, 506, 514, { tone: "mid" });
  turned(`${name}.probe`, G.frameAlong([x, 212, 506], [0, 0, -1]), [[0, 3.2], [36, 3.2], [38, 2.4, 1], [39, 0]], { tone: "hi" }, { sys: "B1", inner: Ln(G.arcOf(G.frameAlong([x, 212, 506], [0, 0, -1]), 26, 3.2, P), { tone: "faint" }) });
}
cyl("E1.ring", 140, 330, 18, 506, 514, { tone: "mid" });
cyl("E1.glass", 140, 330, 13, 503, 506, { tone: "hi" }, { sys: "E1" });
box("shelf.ledge", [62, 222, 388], [72, 410, 396], { tone: "mid" }, { owner: "shelf" });
{
  const bars = [];
  for (let y = 226; y <= 406; y += 10) bars.push(k.lineOnTop([62, y], [358, y], 399, P));
  box("shelf", [62, 218, 396], [358, 414, 399], { tone: "mid" }, { owner: "shelf", extra: Ln(bars.join(""), { tone: "faint" }) });
}
box("specimen.pcb", [150, 268, 399], [262, 352, 401.6], { tone: "hi" }, { extra: Ln(k.planOutline({ x: 154, y: 272, w: 104, d: 76, r: 1.2 }, 401.6, P), { tone: "faint" }) });
box("specimen.ic1", [176, 290, 401.6], [206, 320, 405], { tone: "mid" });
box("specimen.ic2", [216, 296, 401.6], [236, 312, 404.4], { tone: "mid" });
box("specimen.plug", [152, 292, 401.6], [164, 308, 408], { tone: "mid" });
disc("port.boss", G.frameAlong([62, 300, 452], [1, 0, 0]), 0, 7, 13, { tone: "mid" }, { extra: Ln(G.circleOf(G.frameAlong([69, 300, 452], [1, 0, 0]), 0, 7, P), { tone: "faint" }) });
line("specimen.cable", [[158, 300, 408], [158, 300, 452], [69, 300, 452]], 1.6, { tone: "lo", bend: 8, limp: true });

asm("door");
// ---------------------------------------------------------------- door (plug door with four quick fasteners)
box("door.plug", [TS.x0, TS.y1, TS.z0], [TS.x1, FRONT_INS, TS.z1], { tone: "lo" });
box("door.leaf", [10, FRONT_INS, DECK + 12], [420, 485, 588], { tone: "mid" }, {
  r: 4, steps: 4, bevel: 1,
  extra: Ln(path3([[40, 485, 290], [390, 485, 290], [390, 485, 560], [40, 485, 560]], true), { tone: "faint" }),
});
for (const [x, z] of [[24, 330], [24, 520], [406, 330], [406, 520]]) {
  box(`latch.${x}.${z}`, [x - 7, 485, z - 14], [x + 7, 491, z + 14], { tone: "mid" });
  const LF = G.frameAlong([x, 491, z], [0, 1, 0]);
  disc(`latch.knob.${x}.${z}`, LF, 0, 8, 5.5, { tone: "hi" }, { extra: Faded(G.ribsOf(LF, 0, 8, 5.5, 18, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) });
}
for (const x of [160, 270]) box(`handle.post.${x}`, [x - 5, 485, 566], [x + 5, 497, 576], { tone: "mid" });
box("handle.bar", [150, 497, 564], [280, 505, 578], { tone: "hi" }, { r: 3, steps: 3 });

asm("base");
// ---------------------------------------------------------------- machine room: compressor M3
const MC = [140, 150];
const M3F = G.frameAlong([MC[0], MC[1], 36], [0, 0, 1]);
box("M3.rails", [60, 82, 8], [220, 205, 16], { tone: "lo" });
for (const [x, y] of [[78, 100], [202, 100], [78, 192], [202, 192]]) cyl(`M3.grommet.${x}.${y}`, x, y, 10, 16, 30, { tone: "lo" });
box("M3.foot", [66, 88, 30], [214, 204, 36], { tone: "mid" }, { r: 6, steps: 3 });
const M3_PROFILE = [[0, 0], [0, 60], [3, 63, 1], [8, 65, 1], [96, 65], [104, 65], [128, 61, 1], [148, 50, 1], [162, 32, 1], [170, 0, 1]];
turned("M3.shell", M3F, M3_PROFILE, { tone: "hi" }, {
  owner: "M3", sys: "M3",
  inner: Ln(G.arcOf(M3F, 100, 65, P), { tone: "faint" }) + Ln(G.arcOf(M3F, 12, 65, P), { tone: "faint" }),
});
disc("M3.suction.stub", G.frameAlong([MC[0] + 64.5, MC[1], 120], [1, 0, 0]), 0, 13.5, 6.5, { tone: "mid" }, { owner: "M3" });
turned("V4", G.frameAlong([MC[0] + 78, MC[1], 120], [1, 0, 0]), [[0, 7], [3, 7], [4, 10, 1], [10, 11, 1], [16, 10, 1], [17, 9], [17, 0]], { tone: "mid" }, { owner: "M3" });
disc("V4.cap", G.frameAlong([MC[0] + 86, MC[1], 130], [0, 0, 1]), 0, 9, 4.5, { tone: "mid" }, { owner: "M3" });
disc("M3.discharge.stub", G.frameAlong([MC[0], MC[1], 36 + 168.5], [0, 0, 1]), 0, 11.5, 5, { tone: "mid" }, { owner: "M3" });
disc("M3.terminal", G.frameAlong([MC[0] + 63, MC[1], 90], [1, 0, 0]), 0, 12, 16, { tone: "mid" }, { owner: "M3", extra: Ln(G.circleOf(G.frameAlong([MC[0] + 75, MC[1], 90], [1, 0, 0]), 0, 10, P), { tone: "faint" }) });

// ---------------------------------------------------------------- condenser W1 against the left wall, fan M2 blowing through it
{
  const fins = [];
  for (let y = 215; y <= 375; y += 5) fins.push(k.lineOnTop([30, y], [70, y], 210, P));
  box("W1", [30, 210, 30], [70, 380, 210], { tone: "mid" }, { extra: Ln(fins.join(""), { tone: "faint" }), sys: "HOT" });
  for (const y of [210, 370]) box(`W1.bracket.${y}`, [34, y, 8], [66, y + 10, 30], { tone: "lo" });
}
disc("W1.in.stub", G.frameAlong([50, 300, 210], [0, 0, 1]), 0, 8, 4.5, { tone: "mid" });
disc("W1.out.stub", G.frameAlong([70, 352, 55], [1, 0, 0]), 0, 8, 4.5, { tone: "mid" });
const M2C = [295, 120];
turned("M2.shroud", G.frameAlong([70, M2C[0], M2C[1]], [1, 0, 0]), [[0, 74], [18, 74], [18, 66], [0, 66]], { tone: "mid" }, { owner: "M2s" });
box("M2.pedestal", [108, 283, 8], [138, 307, 94], { tone: "lo" });
turned("M2.motor", G.frameAlong([108, M2C[0], M2C[1]], [1, 0, 0]), [[0, 26], [30, 26], [33, 20, 1], [34, 0]], { tone: "mid" }, { owner: "M2", inner: Ln(G.arcOf(G.frameAlong([108, M2C[0], M2C[1]], [1, 0, 0]), 6, 26, P), { tone: "faint" }) });
disc("M2.hub", G.frameAlong([92, M2C[0], M2C[1]], [1, 0, 0]), 0, 16, 12, { tone: "mid" }, { owner: "M2" });
// blade outlines are rebuilt each frame by the live script in the plane x = 96
put("M2.blades", [91.8, M2C[0], M2C[1]], `<path class="vc-blades" data-part="m2-blades" d=""/>`, [record(A.disc(G.frameAlong([91.6, M2C[0], M2C[1]], [1, 0, 0]), 0, 0.4, 60, { name: "M2.blades", owner: "M2" }))], { bias: 0.2, sys: "M2" });

// ---------------------------------------------------------------- receiver near the open side
const RC = [330, 352];
turned("receiver.foot", G.frameAlong([RC[0], RC[1], 8], [0, 0, 1]), [[0, 20], [4, 20]], { tone: "lo" }, { owner: "rec" });
turned("receiver", G.frameAlong([RC[0], RC[1], 12], [0, 0, 1]), [[0, 0], [0, 16, 1], [3, 22, 1], [8, 24, 1], [128, 24, 1], [133, 22, 1], [136, 16, 1], [138, 0]], { tone: "hi" }, { owner: "rec", sys: "WARM", inner: Ln(G.arcOf(G.frameAlong([RC[0], RC[1], 12], [0, 0, 1]), 68, 24, P), { tone: "faint" }) });
disc("receiver.in.stub", G.frameAlong([RC[0] - 23.6, RC[1], 55], [-1, 0, 0]), 0, 8.4, 4.5, { tone: "mid" }, { owner: "rec" });
turned("V2", G.frameAlong([RC[0], RC[1], 149.5], [0, 0, 1]), [[0, 6], [4, 6], [5, 9, 1], [14, 9.5, 1], [22, 9, 1], [23, 5], [26, 5], [26, 0]], { tone: "mid" }, { owner: "rec" });
turned("F2", G.frameAlong([RC[0] + 9.3, RC[1], 163], [1, 0, 0]), [[0, 4], [6, 4], [6, 11], [24, 11], [26, 9, 1], [27, 0]], { tone: "mid" }, { owner: "rec" });

// liquid line: V2 -> T1 -> Y2 -> chase -> flare union -> V3 -> W3 inlet (high pressure, warm liquid up to V3)
const LIQ = [[RC[0], RC[1], 175.5], [RC[0], RC[1], 202], [RC[0], 175, 202], [394, 175, 202], [394, 175, 256]];
const liqRoute = G.fillet(LIQ, 10, 10, { P, tube: 3 });
const T1 = { s0: 50, s1: 108 }, Y2 = { s0: 140, s1: 166 };
{
  line("liquid", LIQ, 3, { tone: "mid", bend: 10, gaps: [[T1.s0, T1.s1], [Y2.s0, Y2.s1]], sys: "WARM", flow: { speed: 24, kind: "liquid" } });
  const t1 = onRoute(liqRoute, T1.s0, T1.s1);
  turned("T1", t1.F, [[0, 3.6], [4, 3.6], [7, 11, 1], [10, 12, 1], [48, 12, 1], [51, 11, 1], [54, 3.6], [58, 3.6]], { tone: "hi" }, { owner: "liquid", sys: "WARM", inner: Ln(G.arcOf(t1.F, 29, 12, P), { tone: "faint" }) });
  const y2 = onRoute(liqRoute, Y2.s0, Y2.s1);
  turned("Y2.body", y2.F, [[0, 4.4], [4, 4.4], [5, 8, 1], [13, 9, 1], [21, 8, 1], [22, 4.4], [26, 4.4]], { tone: "mid" }, { owner: "liquid", sys: "WARM" });
  const yc = G.pointAlong(liqRoute, (Y2.s0 + Y2.s1) / 2);
  // state window on the coil's front face (x = +11): blue disc = open, grey disc with a bar = closed
  const fx = yc[0] + 11.05, fz = yc[2] + 21.5;
  const flag = path3(Array.from({ length: 40 }, (_, i) => [fx, yc[1] + 6.5 * Math.cos((i / 40) * 2 * Math.PI), fz + 6.5 * Math.sin((i / 40) * 2 * Math.PI)]), true);
  const bar = path3([[fx, yc[1] - 6.5, fz], [fx, yc[1] + 6.5, fz]]);
  box("Y2.coil", [yc[0] - 11, yc[1] - 10, yc[2] + 8.9], [yc[0] + 11, yc[1] + 10, yc[2] + 34], { tone: "mid" }, { owner: "liquid", sys: "Y2", extra: Dots([at([yc[0] - 8, yc[1] + 7, yc[2] + 34]), at([yc[0] + 8, yc[1] - 7, yc[2] + 34])], { size: 0.45 }) + `<path class="vc-flag" d="${flag}"/><path class="vc-flag-bar" d="${bar}"/>` });
  const c0 = [yc[0] - 11, yc[1], yc[2] + 22];
  line("cable.Y2", [c0, [210, c0[1], c0[2]], [210, c0[1], 120], [210, 400.5, 120], [210, 400.5, 31]], 1.6, { tone: "lo", bend: 14, limp: true });
}
// flare unions in the chase: the lower half stays with the machine room, the upper half lifts with the box
const union = (name, c, r, h, owner) => turned(name, G.frameAlong(c, [0, 0, 1]), [[0, r * 0.8], [1.2, r], [h - 1.2, r], [h, r * 0.8]], { tone: "mid" }, { owner, extra: Ln(G.ribsOf(G.frameAlong(c, [0, 0, 1]), 1.2, h - 1.2, r, 6, P, { least: 0.05 }), { tone: "faint" }) });
union("liquid.union.lo", [394, 175, 256], 6, 8, "liquid.union.lo");
union("suction.union.lo", [408, 150, 220], 11.5, 10, "suction.union.lo");
line("suction", [[408, 150, 220], [408, 150, 120], [MC[0] + 95, MC[1], 120]], 8, { tone: "mid", bend: 30, sys: "COLD", rings: { pitch: 6, fade: [0.1, 0.55], tone: "faint" }, flow: { speed: 150, kind: "vapour" } });
asm("box");
union("liquid.union.up", [394, 175, 264], 6, 10, "liquid.union.up");
union("suction.union.up", [408, 150, 230], 11.5, 10, "suction.union.up");
const LIQ_UP = [[394, 175, 274], [394, 175, 490], [353, 175, 490]];
const upRoute = G.fillet(LIQ_UP, 10, 10, { P, tube: 3 });
const V3 = { s0: 81, s1: 111 };
{
  line("liquid.up", LIQ_UP, 3, { tone: "mid", bend: 10, gaps: [[V3.s0, V3.s1]], states: [[0, V3.s0, "WARM"], [V3.s1, 1e9, "COLD"]], flow: { speed: 24, fast: 90, from: V3.s1, kind: "liquid" } });
  const v3 = onRoute(upRoute, V3.s0, V3.s1);
  turned("V3.body", v3.F, [[0, 4.4], [3, 4.4], [4, 9, 1], [15, 10, 1], [26, 9, 1], [27, 4.4], [30, 4.4]], { tone: "mid" }, { owner: "liquid.up", sys: "COLD" });
  const vc = G.pointAlong(upRoute, (V3.s0 + V3.s1) / 2);
  disc("V3.head", G.frameAlong([vc[0] + 9.6, vc[1], vc[2]], [1, 0, 0]), 0, 6, 12, { tone: "mid" }, { owner: "liquid.up" });
}
line("suction.up", [[353, 150, 360], [408, 150, 360], [408, 150, 240]], 8, { tone: "mid", bend: 30, sys: "COLD", rings: { pitch: 6, fade: [0.1, 0.55], tone: "faint" }, flow: { speed: 150, kind: "vapour" } });
asm("base");
// condenser -> receiver: one straight run along the floor
line("cond.out", [[78, RC[1], 55], [RC[0] - 32, RC[1], 55]], 3, { tone: "mid", sys: "WARM", flow: { speed: 24, kind: "liquid" } });
// discharge: compressor dome -> condenser top
line("discharge", [[MC[0], MC[1], 36 + 180], [MC[0], MC[1], 238], [50, MC[1], 238], [50, 300, 238], [50, 300, 218]], 3, { tone: "mid", bend: 10, sys: "HOT", flow: { speed: 150, kind: "gas" } });

// ---------------------------------------------------------------- service gauges: high side on V2, low side on V4 (face +x, bottom-connection stem)
const GAUGE_FACES = {};
function gauge(id, c, fromY, scale) {
  const [cx, cy, cz] = c;
  const GR = 22, SC = f2(GR / 16);
  const F = G.frameAlong([cx - 3, cy, cz], [1, 0, 0]);
  const stemEnd = cy - Math.sqrt(GR * GR - 2.4 * 2.4);
  disc(`${id}.stem`, G.frameAlong([cx, fromY, cz], [0, 1, 0]), 0, stemEnd - fromY, 2.4, { tone: "mid" }, { owner: id });
  const o = [cx + 3.05, cy, cz];
  const M = planeMatrix(o, [0, -SC, 0], [0, 0, -SC]);
  const t = [];
  for (let i = 0; i <= scale.major * 5; i++) {
    const a = (-135 + (270 * i) / (scale.major * 5)) * Math.PI / 180, r0 = i % 5 ? 11.8 : 10.4;
    t.push(`M${f2(Math.sin(a) * r0)} ${f2(-Math.cos(a) * r0)}L${f2(Math.sin(a) * 13)} ${f2(-Math.cos(a) * 13)}`);
  }
  const zone = scale.red ? (() => { const a0 = (-135 + 270 * scale.red) * Math.PI / 180, a1 = 135 * Math.PI / 180; return `<path class="vc-zone" d="M${f2(Math.sin(a0) * 13)} ${f2(-Math.cos(a0) * 13)}A13 13 0 0 1 ${f2(Math.sin(a1) * 13)} ${f2(-Math.cos(a1) * 13)}L${f2(Math.sin(a1) * 11.8)} ${f2(-Math.cos(a1) * 11.8)}A11.8 11.8 0 0 0 ${f2(Math.sin(a0) * 11.8)} ${f2(-Math.cos(a0) * 11.8)}Z"/>`; })() : "";
  const face = `<g transform="${M}"><circle class="vc-dial" r="13.6"/>${zone}<circle class="iso-line" data-tone="faint" r="10.4"/><circle class="iso-line" data-tone="faint" r="11.8"/><circle class="iso-line" data-tone="lo" r="13"/><path class="iso-line" data-tone="lo" d="${t.join("")}"/>` +
    `<path class="iso-line" data-tone="lit" data-free="end" data-part="needle-${id}" d="M0 0L0 -10"/><circle class="vc-hub" r="1.1"/></g>`;
  GAUGE_FACES[id] = scale;
  turned(`${id}.case`, F, [[0, GR - 1], [0.8, GR], [5.2, GR], [6, GR - 1]], { tone: "mid" }, { owner: id, extra: face, sys: id });
}
gauge("HP", [330, 395, 166], 361.1, { min: 0, max: 30, major: 6, red: 0.73 });
gauge("LP", [226, 194.4, 120], 160.5, { min: -1, max: 9, major: 5 });

// ---------------------------------------------------------------- electrical compartment: base board PL1 behind the control panel
const PL = { x: 20, y: 392, w: 250, d: 84 };
for (const [x, y] of [[28, 400], [262, 400], [28, 468], [262, 468]]) cyl(`PL1.standoff.${x}.${y}`, x, y, 4, 8, 18, { tone: "lo" });
box("PL1", [PL.x, PL.y, 18], [PL.x + PL.w, PL.y + PL.d, 20], { tone: "lo" }, { extra: Ln(k.planOutline({ x: PL.x + 4, y: PL.y + 4, w: PL.w - 8, d: PL.d - 8, r: 1 }, 20, P), { tone: "faint" }) });
box("PL1.transformer", [30, 420, 20], [80, 468, 62], { tone: "mid" }, { r: 2, steps: 3, bevel: 0.6 });
{
  const fins = [];
  for (let x = 94; x <= 128; x += 4) fins.push(k.lineOnTop([x, 442], [x, 472], 52, P));
  box("PL1.heatsink", [90, 442, 20], [132, 472, 52], { tone: "mid" }, { extra: Ln(fins.join(""), { tone: "lo" }) });
}
for (let i = 0; i < 6; i++) box(`PL1.relay.${i}`, [140 + i * 14, 430, 20], [151 + i * 14, 446, 34], { tone: "hi" }, { r: 0.8 });
box("PL1.terminals", [150, 396, 20], [264, 405, 31], { tone: "mid" }, { extra: Dots(Array.from({ length: 11 }, (_, i) => at([154 + i * 10.5, 400.5, 31])), { size: 0.5, tone: "lo" }) });
box("PL1.ribbon.plug", [180, 470, 20], [224, 476, 28], { tone: "mid" });
line("cable.M3", [[MC[0] + 75, MC[1], 90], [254, MC[1], 90], [254, MC[1], 44], [254, 400.5, 44], [254, 400.5, 31]], 2.2, { tone: "lo", bend: 18, limp: true });
line("ribbon", [[202, 473, 28], [202, 473, 110], [202, 482, 110]], 1.4, { tone: "lo", bend: 3, limp: true });

asm("panel");
// ---------------------------------------------------------------- control panel on the front (drawn in the plane of the face)
const PF = { o: [PANEL.x0, PANEL.y + PANEL.t, PANEL.z1], ex: [1, 0, 0], ey: [0, 0, -1] };
const PM = planeMatrix(G.add3(PF.o, [0, 0.05, 0]), PF.ex, PF.ey);
const pw = (u, w, dy = 0) => [PANEL.x0 + u, PANEL.y + PANEL.t + dy, PANEL.z1 - w];
const LEDS = { Y2: [64, 44], F5: [92, 44], E1: [214, 56], E2: [170, 70], M1: [214, 80], M2: [36, 98], M3: [36, 128], F2: [64, 150], TP: [170, 138] };
const face = [];
face.push(`<path class="iso-line" data-tone="lo" d="M24 44H140V150H24Z"/>`);                      // refrigeration loop
face.push(`<path class="iso-line" data-tone="lo" d="M140 30H258V156H140Z"/>`);                     // chamber
face.push(`<path class="iso-line" data-tone="faint" d="M148 38H250V148H148Z"/>`);
face.push(`<rect class="vc-window" x="174" y="94" width="70" height="28" rx="2"/>`);
face.push(`<text class="vc-digits" data-part="digits" x="240" y="115.5" text-anchor="end">+23</text>`);
face.push(`<path class="iso-line" data-tone="mid" d="M174 94H244V122H174Z"/>`);
for (const [id, [u, w]] of Object.entries(LEDS)) face.push(`<circle class="vc-led" data-led="${id}" cx="${u}" cy="${w}" r="3.2"/>`);
// timer dial (24 h) and t> scale, engraved
const TIMER = [340, 48];
const tticks = [];
for (let i = 0; i < 48; i++) {
  const a = (i / 48) * Math.PI * 2, r0 = 22.5;
  tticks.push(`M${f2(TIMER[0] + Math.sin(a) * r0)} ${f2(TIMER[1] - Math.cos(a) * r0)}L${f2(TIMER[0] + Math.sin(a) * 27)} ${f2(TIMER[1] - Math.cos(a) * 27)}`);
}
face.push(`<circle class="iso-line" data-tone="faint" cx="${TIMER[0]}" cy="${TIMER[1]}" r="22.5"/><circle class="iso-line" data-tone="lo" cx="${TIMER[0]}" cy="${TIMER[1]}" r="27"/><path class="iso-line" data-tone="lo" d="${tticks.join("")}"/>`);
const TB = [334, 132];
const sticks = [];
for (let i = 0; i <= 12; i++) {
  const a = (-120 + i * 20) * Math.PI / 180, r0 = 19.5;
  sticks.push(`M${f2(TB[0] + Math.sin(a) * r0)} ${f2(TB[1] - Math.cos(a) * r0)}L${f2(TB[0] + Math.sin(a) * 23)} ${f2(TB[1] - Math.cos(a) * 23)}`);
}
face.push(`<circle class="iso-line" data-tone="faint" cx="${TB[0]}" cy="${TB[1]}" r="19.5"/><circle class="iso-line" data-tone="faint" cx="${TB[0]}" cy="${TB[1]}" r="23"/><path class="iso-line" data-tone="lo" d="${sticks.join("")}"/>`);
face.push(`<path class="iso-line" data-tone="faint" d="M14 10H376V190H14Z"/>`);
const faceSvg = `<g transform="${PM}">${face.join("")}</g>`;
box("panel", [PANEL.x0, PANEL.y, PANEL.z0], [PANEL.x1, PANEL.y + PANEL.t, PANEL.z1], { tone: "mid" }, {
  r: 2, steps: 3, bevel: 0.6,
  extra: faceSvg + Dots([[6, 6], [384, 6], [6, 194], [384, 194]].map(([u, w]) => at(pw(u, w, 0.05))), { size: 0.55 }),
});
const knob = (name, [u, w], r, h, sys) => {
  const F = G.frameAlong(pw(u, w), [0, 1, 0]);
  disc(`${name}.skirt`, F, 0, 2, r + 3, { tone: "mid" });
  disc(name, G.frameAlong(pw(u, w, 2), [0, 1, 0]), 0, h, r, { tone: "hi" }, { sys, extra: Faded(G.ribsOf(G.frameAlong(pw(u, w, 2), [0, 1, 0]), 0, h, r, 24, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) + Ln(path3([pw(u, w, 2 + h), pw(u, w - r + 1.5, 2 + h)]), { tone: "hi", free: true }) });
};
knob("t1", [290, 52], 7, 9, "SET");
knob("t2", [290, 120], 7, 9);
knob("tlimit", [TB[0], TB[1]], 8, 10);
disc("timer", G.frameAlong(pw(TIMER[0], TIMER[1]), [0, 1, 0]), 0, 3, 20, { tone: "mid" }, { extra: Ln(G.circleOf(G.frameAlong(pw(TIMER[0], TIMER[1], 3), [0, 1, 0]), 0, 16, P), { tone: "faint" }) });
box("mains.base", [PANEL.x0 + 342, PANEL.y + PANEL.t, PANEL.z1 - 192], [PANEL.x0 + 380, PANEL.y + PANEL.t + 4, PANEL.z1 - 158], { tone: "mid" });
box("mains.handle", [PANEL.x0 + 355, PANEL.y + PANEL.t + 4, PANEL.z1 - 190], [PANEL.x0 + 367, PANEL.y + PANEL.t + 16, PANEL.z1 - 160], { tone: "hi" }, { r: 2 });
for (let i = 0; i < 7; i++) {
  const u = 50 + i * 26;
  box(`button.${i}`, pw(u - 9, 186), [PANEL.x0 + u + 9, PANEL.y + PANEL.t + (i === 6 ? 1.2 : 4), PANEL.z1 - 168], { tone: i === 6 ? "lo" : "hi" }, { r: 1 });
}

// ---------------------------------------------------------------- order, page
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move ?? [0, 0, 0];
  return `<g class="it" data-name="${item.name}" data-piece="${item.piece}" data-ride="${item.ride ?? item.piece}" data-k="${item.key.toFixed(3)}" data-m="${mx},${my},${mz}" data-i="${index}"${item.attrs ?? ""}>${item.svg}</g>`;
});

const LABEL_TEXT =
  "A Heraeus-Vötsch VMT 04/16 temperature test chamber on a bench, with its right side panel and the right insulation wall cut away. Below the deck sits the machine room: the hermetic compressor M3, the air-cooled condenser W1 with its fan M2, the receiver with service valve V2 and pressure switch F2, the filter drier T1 and the solenoid valve Y2 on the liquid line, and the base board PL1 behind the control panel. The liquid line rises through a pipe chase to the expansion valve V3 and the finned evaporator W3 in the air duct behind the baffle; the insulated suction line returns to the compressor. In the duct sit the tubular heater E2 and the fan M1, whose motor is outside the rear insulation. The test space holds a shelf with a circuit board under test and the two Pt100 probes B1 and B3.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, `<g class="vc-cab">${groups.join("")}</g>`] });

const DATA = {
  P,
  V,
  EX: k.axisVector(P, [1, 0, 0]), EY: k.axisVector(P, [0, 1, 0]), EZ: k.axisVector(P, [0, 0, 1]),
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, p]) => [id, { name: p.name, move: p.move }])),
  stagger: STAGGER,
  spring: SPRING,
  fan: { c: [91.8, M2C[0], M2C[1]], r0: 12, r1: 60 },
  flow: FLOW,
  gauges: GAUGE_FACES,
};
const CSS = readFileSync(join(HERE, "chamber.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const body =
  `<style>${CSS}</style>` +
  k.plateHtml({
    fig: "Fig 1",
    title: "Temperature test chamber VMT 04/16",
    hint: "Hover or ← → to set · E takes it apart",
    readout: "set +23 °C · air +23.0 °C · idle",
    keys: [
      { mark: "red", label: "High pressure, hot gas: compressor discharge and condenser W1 (heat leaves the chamber here); heater E2 while heating" },
      { mark: "green", label: "High pressure, warm liquid: receiver, filter drier T1, solenoid Y2 and the liquid line up to the expansion valve" },
      { mark: "blue", label: "Low pressure, cold: after expansion valve V3 the R502 boils in evaporator W3 and returns as vapour (only while Y2 is open)" },
      { mark: "dotted", label: "Moving dots: refrigerant flow, slow as liquid, fast as gas and vapour. The gauges read V2 (high side) and V4 (low side)" },
      { mark: "flat", label: "Y2 window: blue = open, grey with a bar = shut. Service valves V2 and V4 are always open" },
    ],
    caption:
      "How the cold is made: the compressor M3 squeezes R502 vapour to about 15 bar, which makes it hot (red); the condenser W1 and its fan M2 carry that heat out of the cabinet, and the R502 condenses to a warm liquid (amber) that collects in the receiver. When the controller wants cold it opens Y2; the liquid reaches the expansion valve V3, which throttles it to well under 1 bar. At that low pressure R502 boils far below the chamber temperature (−45 °C at 1 bar), so it takes heat out of the air blown through the evaporator W3, and the vapour (blue) returns to the compressor. Heating is simpler: the heater rods E2 turn electricity into heat in the same air stream. The gauge readings come from an approximate R502 saturation curve (about −45 °C at 1 bar, 0 °C at 5.6 bar, +40 °C at 16.6 bar absolute), condensing at about +38 °C and evaporating about 10 K below the air. The VMT 04/16 holds −40 to +130 °C within ±1 °C in a 310 × 230 × 200 mm stainless test space. Air is drawn through the centre of the baffle by fan M1, passes the evaporator W3 and the heater E2, and returns at the top and bottom edges. A three-point controller (3N1) reads the Pt100 probe B1 and either switches the heater (through thermostat F7 and an SSR) or opens solenoid valve Y2, which lets liquid R502 (400 g) reach the expansion valve V3 and evaporate in W3; per the wiring diagram the compressor runs whenever the chamber is on, and the condenser fan follows the cooling demand with a run-on. The time scale is one second per minute; heating follows the manual's curve (−40 to +130 °C in about 55 min) and cooling its curve (+130 to −40 °C in about 80 min). The limiter F5, pressure switch F2 and the specimen protection 3N2 work in hardware beside it.",
    body: `<div class="vc-tools"><button type="button" class="vc-btn" data-explode aria-pressed="false">Take apart</button><span class="vc-parts" data-parts></span></div>` +
      `<div class="iso-stage vc-stage" tabindex="0" role="slider" aria-label="Chamber setpoint: arrow keys change it in 5 degree steps, E takes the chamber apart" aria-valuemin="-40" aria-valuemax="130" aria-valuenow="23">${svg}</div>` +
      `<div class="vc-strip" aria-live="off">` +
      `<div><span>High side (V2)</span><b data-v="hp">–</b><i data-v="tc"></i></div>` +
      `<div><span>Low side (V4)</span><b data-v="lp">–</b><i data-v="te"></i></div>` +
      `<div><span>Solenoid Y2</span><b data-v="y2">shut</b><i data-v="flow"></i></div>` +
      `<div><span>Heater E2</span><b data-v="e2">off</b><i data-v="air"></i></div></div>`,
  });
const FIG2 = boards({ k, G, A, tubePieces, tubeSvg });
const chain = (id, label, steps) => `<div data-chain="${id}"><span>${label}</span><b>${steps}</b><i data-chain-state="${id}">off</i></div>`;
const body2 = k.plateHtml({
  fig: "Fig 2",
  title: "Control electronics, from the board photos",
  hint: "Hover a relay for its job",
  readout: "chamber on · idle",
  keys: [
    { mark: "lit", label: "Energised whenever the chamber is on and no fault is latched: Temp. on 2K2, the fault-watch relays 2K6–2K9 and 2K18, interlock 2K4, mains relays 1K7/1K8, compressor 1K10, specimen protection 3K3" },
    { mark: "blue", label: "Energised while cooling: 3K1 → 1K4 → 1K15 opens Y2; 1K9 runs the condenser fan M2 (with the 2K17 run-on after)" },
    { mark: "red", label: "Energised while heating: 3K2 → thermostat F7 → solid-state relay 1V6 → heater E2" },
    { mark: "flat", label: "Grey: de-energised, or a relay whose job is not traced yet (1K3, 1K13, 1K14, 2K3 after its arming pulse, the mode relays 2K13/2K14)" },
  ],
  caption: "Placed from the PCB photos. On PL1 the designators 1K2, 1K3, 1K9, 1K10 and 1K13–1K15 are read from the silkscreen, and the empty footprints K1, K5, K12, K17, K18 and K20 are drawn as bare outlines; 1K7 and 1K8 are taken to be the two larger relays (inferred, not traced), and 1K4 is the relay in the socket under the board. On PL2 only 2K6 and 2K9 are read from the silkscreen; the other PL2 relays are placed by function, not by position. Where the heater SSR 1V6 is mounted was not traced. The cards 3N1 and 3N2 are shown pulled from their sockets N1 and N2. The relay states follow the same model as Fig 1 and the manual's wiring diagrams (pp. 48–58); the compressor relay 1K10 staying in whenever the chamber is on is still open item V3.",
  body: `<div class="iso-stage vc-stage2">${FIG2.svg}</div>` +
    `<div class="vc-strip vc-chains">` +
    chain("cool", "Cooling", "3K1 → 1K4 → 1K15 → Y2") +
    chain("heat", "Heating", "3K2 → F7 → 1V6 → E2") +
    chain("fan", "Condenser fan", "1K9 → M2 · run-on 2K17") +
    chain("mains", "Mains to loads", "faults OK → 2K4 → 1K7/1K8") + `</div>`,
});
const page = k.pageHtml({ title: "VMT 04/16 chamber", theme: THEME, body: body + body2, script: kitScript() + LIVE, width: 680 });
const name = THEME === "light" ? "chamber-light.html" : "chamber.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `scale ${KS.toFixed(3)}`);
if (process.argv.includes("--audit2")) A.auditOrExit(FIG2.R, FIG2.P, { flag: "--audit2" });
A.auditOrExit(R, P, { crowd: [["liquid*", "W3.upper"], ["suction*", "W3.lower"]] });
