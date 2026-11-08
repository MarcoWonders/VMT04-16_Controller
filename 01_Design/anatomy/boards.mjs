// Fig 2: the four control boards of the VMT 04/16 laid out on an ESD mat, placed from the PCB photos
// (00_Documentation/PCB). World units are mm; boards lie flat, x to the right, y towards the viewer.
// Relays carry data-relay="<designator>" so live.js lights them from the same model as Fig 1.
export function boards({ k, G, A, tubePieces, tubeSvg }) {
  const W = 620, H = 370;
  const MAT = { x: -14, y: -16, w: 580, d: 332, r: 8 };
  const P = k.fitProjection([...k.boxCorners(MAT, -6, 0), [292, 104, 62], [0, 0, 40], [550, 0, 30]], W, H, { pad: 22, azimuth: 60, elevation: 42 });
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (points, style) => k.dotsSvg(points, style);
  const f1 = (v) => Math.round(v * 10) / 10;
  const R = A.recorder(P);
  const tags = [];
  const RELAYS = {};

  function put(name, ref, svg, shapes, attrs = "") { R.put({ name, at: ref, svg, shapes, attrs }); }
  function box(name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.6, steps = 2, bevel = 0, extra = "", attrs = "" } = {}) {
    const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
    const shape = R.solid(A.slab(plan, z0, z1 - z0, { name }, steps));
    put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style }) + extra, [shape], attrs);
  }
  function rod(name, F, len, r, style = {}, { extra = "" } = {}) {
    const profile = [[0, r * 0.85], [0.6, r], [len - 0.6, r], [len, r * 0.85]];
    const shape = R.solid(A.solid(F, profile, { name }));
    put(name, G.add3(F.o, G.mul3(F.a, len / 2)), S(G.solidOf(profile, F, P, {}), { tone: "mid", ...style }) + extra, [shape]);
  }
  const can = (name, x, y, z, r, h, style = {}, extra = "") => rod(name, G.frameAlong([x, y, z], [0, 0, 1]), h, r, style, { extra });
  const lying = (name, [x, y, z], axis, len, r, style) => rod(name, G.frameAlong(axis === "x" ? [x, y, z + r] : [x, y, z + r], axis === "x" ? [1, 0, 0] : [0, 1, 0]), len, r, style);

  function pcb(name, [x0, y0], [x1, y1], z, feet = true) {
    if (feet) for (const [x, y] of k.corners({ x: x0, y: y0, w: x1 - x0, d: y1 - y0 }, 6)) can(`${name}.foot.${x}.${y}`, x, y, 0, 3, z, { tone: "lo" });
    const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 1.5 };
    const screws = feet ? Dots(k.corners(plan, 6).map(([x, y]) => at([x, y, z + 1.6])), { size: 0.6, tone: "hi" }) : "";
    box(name, [x0, y0, z], [x1, y1, z + 1.6], { tone: "lo" }, { r: 1.5, extra: Ln(k.planOutline({ x: x0 + 3, y: y0 + 3, w: x1 - x0 - 6, d: y1 - y0 - 6, r: 1 }, z + 1.6, P), { tone: "faint" }) + screws });
    return z + 1.6;
  }
  // relay: clear Zettler case with the coil and contact set inside; top centre gets the designator tag
  function relay(id, [x0, y0], [x1, y1], z, h, what, { big = false } = {}) {
    const top = z + h, inset = 2.2;
    const inner = Ln(k.planOutline({ x: x0 + inset, y: y0 + inset, w: x1 - x0 - inset * 2, d: y1 - y0 - inset * 2, r: 0.8 }, top, P), { tone: "faint" });
    const long = x1 - x0 > y1 - y0;
    const coil = long ? k.lineOnTop([x0 + (x1 - x0) * 0.62, y0 + inset], [x0 + (x1 - x0) * 0.62, y1 - inset], top, P) : k.lineOnTop([x0 + inset, y0 + (y1 - y0) * 0.62], [x1 - inset, y0 + (y1 - y0) * 0.62], top, P);
    box(`relay.${id}`, [x0, y0, z], [x1, y1, top], { tone: "hi" }, { r: big ? 1.6 : 1, steps: 3, bevel: 0.5, extra: inner + Ln(coil, { tone: "lo" }), attrs: ` data-relay="${id}"` });
    RELAYS[id] = what;
    const [sx, sy] = at([(x0 + x1) / 2, (y0 + y1) / 2, top]);
    tags.push({ id, x: sx, y: sy - 9, ax: sx, ay: sy });
  }
  const onBoard = (name, svg) => { R.items.find((it) => it.name === name).svg += svg; };
  const boardTag = (text, p) => { const [x, y] = at(p); tags.push({ id: text, x, y, board: true, ax: x, ay: y }); };
  const rows = (name, z, list, axis, len = 7, r = 1.2, style = { tone: "mid" }) => list.forEach(([x, y], i) => lying(`${name}.${i}`, [x, y, z], axis, len, r, style));
  const dip = (name, x, y, z, w = 10, d = 7) => box(name, [x, y, z], [x + w, y + d, z + 3.5], { tone: "lo" }, { r: 0.4, extra: Dots([at([x + 1.6, y + 1.6, z + 3.5])], { size: 0.45, tone: "mid" }) });
  const terminals = (name, [x0, y0], [x1, y1], z, h, n, along) => {
    const pts = Array.from({ length: n }, (_, i) => along === "y" ? [(x0 + x1) / 2, y0 + (y1 - y0) * (i + 0.5) / n, z + h] : [x0 + (x1 - x0) * (i + 0.5) / n, (y0 + y1) / 2, z + h]);
    const seams = Array.from({ length: n - 1 }, (_, i) => along === "y" ? k.lineOnTop([x0, y0 + (y1 - y0) * (i + 1) / n], [x1, y0 + (y1 - y0) * (i + 1) / n], z + h, P) : k.lineOnTop([x0 + (x1 - x0) * (i + 1) / n, y0], [x0 + (x1 - x0) * (i + 1) / n, y1], z + h, P));
    box(name, [x0, y0, z], [x1, y1, z + h], { tone: "mid" }, { r: 0.6, extra: Ln(seams.join(""), { tone: "lo" }) + Dots(pts.map(at), { size: 0.75, tone: "hi" }) });
  };
  const footprint = (label, [x0, y0], [x1, y1], z) => {
    const holes = [];
    for (const fy of [0.12, 0.88]) for (const fx of [0.2, 0.8]) holes.push(at([x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy, z]));
    return Ln(k.planOutline({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.5 }, z, P), { tone: "lo" }) + Dots(holes, { size: 0.5, tone: "lo" }) +
      k.faceTextSvg(k.topMatrix([(x0 + x1) / 2, (y0 + y1) / 2 + 1.5], z, P, "y"), label, { size: 3.6, tone: "lo", anchor: "middle" });
  };
  const fins = (x0, y0, x1, y1, z, step, along) => {
    const out = [];
    if (along === "y") for (let x = x0 + step; x < x1 - 1; x += step) out.push(k.lineOnTop([x, y0 + 1], [x, y1 - 1], z, P));
    else for (let y = y0 + step; y < y1 - 1; y += step) out.push(k.lineOnTop([x0 + 1, y], [x1 - 1, y], z, P));
    return Ln(out.join(""), { tone: "lo" });
  };

  // ---------------------------------------------------------------- mat
  const back = [];
  back.push(`<path class="iso-halo" d="${k.haloOf(MAT, -6, 6, P)}"/>`);
  back.push(S(k.slabOf(MAT, -6, 6, P, 6, 0.8), { tone: "lo" }));
  R.solid(A.slab(MAT, -6, 6, { name: "mat", ground: true }, 6));
  const grid = [];
  for (let x = MAT.x + 40; x < MAT.x + MAT.w - 10; x += 40) grid.push(k.lineOnTop([x, MAT.y], [x, MAT.y + MAT.d], 0, P));
  back.push(Ln(grid.join(""), { tone: "faint" }));
  back.push(Dots([at([MAT.x + 8, MAT.y + MAT.d - 8, 0])], { size: 1.2, tone: "mid" }));    // earth stud

  // ---------------------------------------------------------------- PL1 base board 0318/784010-3 (in the base, mains side)
  {
    const z = pcb("PL1", [0, 20], [300, 186], 5);
    terminals("PL1.tb.left", [2, 36], [14, 174], z, 12, 24, "y");
    terminals("PL1.tb.top", [108, 28], [166, 42], z, 11, 9, "x");
    terminals("PL1.tb.bottom", [22, 172], [170, 184], z, 11, 16, "x");
    box("PL1.ribbon.header", [36, 23, z], [92, 33, z + 9], { tone: "lo" }, { extra: Dots(Array.from({ length: 12 }, (_, i) => at([40 + i * 4.3, 28, z + 9])), { size: 0.4, tone: "mid" }) });
    box("PL1.transformer", [180, 24, z], [292, 106, z + 56], { tone: "mid" }, { r: 3, steps: 3, bevel: 0.8, extra: Ln(k.planOutline({ x: 192, y: 34, w: 88, d: 62, r: 2 }, z + 56, P), { tone: "lo" }) + Dots([[186, 30], [286, 30], [186, 100], [286, 100]].map(([x, y]) => at([x, y, z + 56])), { size: 0.55 }) });
    box("PL1.heatsink.a", [124, 114, z], [168, 172, z + 30], { tone: "mid" }, { extra: fins(124, 114, 168, 172, z + 30, 4, "y") });
    box("PL1.heatsink.b", [174, 114, z], [284, 172, z + 22], { tone: "mid" }, { extra: fins(174, 114, 284, 172, z + 22, 5, "y") });
    can("PL1.to3", 228, 143, z + 22, 11, 7, { tone: "hi" }, Dots([at([214, 143, z + 22]), at([242, 143, z + 22])], { size: 0.7, tone: "hi" }));
    can("PL1.C3", 94, 59, z, 7, 15, { tone: "hi" });
    can("PL1.C1", 146, 59, z, 7, 15, { tone: "hi" });
    can("PL1.C6", 96, 86, z, 7, 15, { tone: "hi" });
    lying("PL1.R.power", [116, 118, z], "y", 18, 2.6, { tone: "hi" });
    // relays (designators from the silkscreen; 1K7/1K8 are the two larger relays, inferred)
    relay("1K10", [50, 52], [82, 63], z, 15, "compressor M3 contactor");
    relay("1K3", [70, 68], [82, 98], z, 15, "function not traced");
    relay("1K9", [52, 106], [64, 134], z, 15, "condenser fan M2");
    relay("1K2", [70, 106], [82, 134], z, 15, "test-space lamp E1");
    relay("1K13", [20, 140], [35, 168], z, 18, "function not traced");
    relay("1K14", [38, 140], [53, 168], z, 18, "function not traced");
    relay("1K15", [56, 140], [71, 168], z, 18, "solenoid valve Y2");
    relay("1K7", [104, 76], [122, 110], z, 21, "mains to the loads (TE L+)", { big: true });
    relay("1K8", [126, 76], [144, 110], z, 21, "mains to the loads (TE L+)", { big: true });
    const silk = [footprint("K18", [20, 68], [32, 96], z), footprint("K12", [36, 68], [48, 96], z), footprint("K1", [52, 68], [64, 96], z),
      footprint("K20", [20, 104], [32, 132], z), footprint("K17", [36, 104], [48, 132], z), footprint("K5", [80, 140], [92, 168], z),
      Ln(k.planOutline({ x: 112, y: 52, w: 20, d: 14, r: 7 }, z, P), { tone: "lo" })];
    onBoard("PL1", silk.join("") + k.faceTextSvg(k.topMatrix([238, 180], z, P, "x"), "VÖTSCH 0318/784010-3", { size: 4.2, tone: "lo", anchor: "middle" }));
    boardTag("PL1", [8, 14, z]);
  }

  // ---------------------------------------------------------------- off-board: socketed relay 1K4 and the heater SSR 1V6 (under PL1)
  {
    box("K4.rail", [176, 262, 0], [296, 270, 3], { tone: "mid" }, { r: 0.4 });
    box("K4.socket", [180, 270, 0], [222, 300, 8], { tone: "mid" }, { r: 1, extra: Dots([[184, 274], [218, 274], [184, 296], [218, 296]].map(([x, y]) => at([x, y, 8])), { size: 0.7, tone: "hi" }) });
    relay("1K4", [187, 273], [215, 297], 8, 24, "cooling demand (from 3K1)", { big: true });
    box("SSR.plate", [234, 272, 0], [298, 304, 3], { tone: "mid" }, { r: 1 });
    box("SSR.1V6", [242, 276, 3], [290, 300, 22], { tone: "hi" }, { r: 1.2, steps: 3, bevel: 0.5, attrs: ` data-relay="1V6"`, extra: Dots([[248, 282], [248, 294], [284, 282], [284, 294]].map(([x, y]) => at([x, y, 22])), { size: 0.9, tone: "mid" }) });
    RELAYS["1V6"] = "heater E2 (solid-state)";
    const [sx, sy] = at([266, 288, 22]);
    tags.push({ id: "1V6", x: sx, y: sy - 9, ax: sx, ay: sy });
  }

  // ---------------------------------------------------------------- 3N1 controller card LP81-102 (two-point heat / cool relays)
  {
    const z = pcb("3N1", [0, 206], [160, 300], 0, false);
    box("3N1.connector", [0, 220, z], [10, 288, z + 10], { tone: "hi" }, { r: 0.5, extra: Dots(Array.from({ length: 16 }, (_, i) => at([5, 223 + i * 4, z + 10])), { size: 0.4, tone: "lo" }) });
    relay("3K1", [14, 209], [52, 226], z, 18, "cool contact", { big: true });
    relay("3K2", [14, 229], [52, 246], z, 18, "heat contact", { big: true });
    can("3N1.C.a", 22, 262, z, 8, 16, { tone: "hi" }); can("3N1.C.b", 42, 262, z, 8, 16, { tone: "hi" });
    can("3N1.C.c", 18, 284, z, 8, 16, { tone: "hi" }); can("3N1.C.d", 38, 284, z, 8, 16, { tone: "hi" });
    dip("3N1.U1", 84, 214, z); dip("3N1.U2", 84, 236, z); dip("3N1.U3", 82, 280, z);
    can("3N1.P1", 134, 222, z, 4, 5, { tone: "hi" }); can("3N1.P2", 134, 243, z, 4, 5, { tone: "hi" });
    box("3N1.W1", [142, 214, z], [156, 226, z + 6], { tone: "hi" }); box("3N1.W2", [142, 278, z], [156, 290, z + 6], { tone: "hi" });
    for (const [i, y] of [271, 278, 285].entries()) box(`3N1.film.${i}`, [114, y, z], [128, y + 5, z + 7], { tone: "mid" }, { r: 0.4 });
    box("3N1.blue", [70, 256, z], [80, 262, z + 6], { tone: "mid" }, { r: 1 });
    const res = [];
    for (let y = 212; y <= 292; y += 8) { if (y < 250 || y > 268) res.push([64, y]); res.push([100, y]); if (y < 266) res.push([116, y]); }
    rows("3N1.R", z, res, "x");
    boardTag("3N1", [4, 300, z]);
  }

  // ---------------------------------------------------------------- 3N2 specimen protection LP77-070-8
  {
    const z = pcb("3N2", [176, 206], [336, 248], 0, false);
    const gold = [];
    for (let i = 0; i < 8; i++) gold.push(k.lineOnTop([176.5, 210 + i * 4.6], [184, 210 + i * 4.6], z, P));
    onBoard("3N2", Ln(gold.join(""), { tone: "hi" }));
    dip("3N2.U1", 216, 224, z); dip("3N2.U2", 262, 212, z);
    can("3N2.P1", 226, 240, z, 4, 5, { tone: "hi" });
    for (const [i, x] of [246, 254, 262].entries()) box(`3N2.film.${i}`, [x, 232, z], [x + 6, 244, z + 7], { tone: "mid" }, { r: 0.4 });
    lying("3N2.C.a", [300, 210, z], "y", 16, 5.5, { tone: "hi" });
    lying("3N2.C.b", [287, 210, z], "y", 16, 5.5, { tone: "hi" });
    relay("3K3", [308, 226], [332, 246], z, 16, "specimen protection t> (keeps 2K8 in)", { big: true });
    for (const [x, y] of [[276, 236], [282, 238], [296, 234]]) can(`3N2.T.${x}`, x, y, z, 2, 4, { tone: "lo" });
    rows("3N2.R", z, [[192, 212], [192, 220], [192, 236], [202, 242], [232, 212], [242, 216], [244, 224], [272, 226], [276, 216]], "x", 6, 1.1);
    boardTag("3N2", [180, 248, z]);
  }

  // ---------------------------------------------------------------- PL2 front board 0318/784012-2 (fault logic, UI, card sockets)
  {
    const z = pcb("PL2", [350, 0], [550, 242], 5);
    box("PL2.header", [358, 10, z], [444, 26, z + 9], { tone: "lo" }, { r: 0.6, extra: Ln(k.planOutline({ x: 362, y: 14, w: 78, d: 8, r: 0.4 }, z + 9, P), { tone: "mid" }) });
    terminals("PL2.tb", [364, 80], [378, 206], z, 12, 22, "y");
    relay("2K6", [362, 31], [406, 51], z, 16, "fault watch: limiter F5 (TB)");
    relay("2K9", [462, 26], [474, 54], z, 15, "fault watch: compressor thermal");
    relay("2K18", [478, 26], [490, 54], z, 15, "fault watch: pressure switch F2");
    relay("2K7", [494, 26], [506, 54], z, 15, "fault watch: fan motor M1 thermal");
    relay("2K2", [382, 102], [424, 117], z, 16, "Temp. on (T L+)");
    relay("2K4", [382, 121], [424, 136], z, 16, "all faults clear: T L+ → TE L+");
    relay("2K8", [382, 140], [424, 155], z, 16, "fault watch: specimen protection 3N2");
    relay("2K17", [384, 208], [396, 236], z, 14, "condenser-fan run-on timer");
    relay("2K3", [400, 208], [412, 236], z, 14, "arms the fault relays at Temp. on");
    relay("2K13", [416, 208], [428, 236], z, 14, "mode (program)");
    relay("2K14", [432, 208], [444, 236], z, 14, "mode (program)");
    // diode and resistor field
    const dio = [];
    for (let x = 432; x <= 502; x += 7) { dio.push([x, 66]); dio.push([x, 80]); dio.push([x, 98]); }
    rows("PL2.D", z, dio, "y", 8, 1.1, { tone: "lo" });
    rows("PL2.R", z, [[434, 116], [448, 116], [462, 116], [476, 116], [434, 124], [448, 124], [462, 132], [476, 132], [490, 136], [434, 172], [448, 176], [462, 172], [470, 186], [490, 186], [508, 180], [454, 196], [454, 222], [470, 212], [470, 228]], "x", 7, 1.2);
    dip("PL2.U1", 488, 112, z); dip("PL2.U2", 488, 160, z);
    for (const [x, y] of [[410, 64], [418, 74], [412, 86], [440, 140], [500, 172]]) can(`PL2.T.${x}`, x, y, z, 2.2, 4.5, { tone: "lo" });
    lying("PL2.C.gold", [432, 162, z], "x", 32, 5.5, { tone: "hi" });
    // 3N1 socket with its card guides, 3N2 edge socket, Pt100 B1 terminal
    box("PL2.N1", [512, 84, z], [526, 130, z + 10], { tone: "hi" }, { r: 0.5, extra: Dots(Array.from({ length: 10 }, (_, i) => at([519, 87 + i * 4.4, z + 10])), { size: 0.4, tone: "lo" }) });
    box("PL2.guide.a", [452, 58, z], [522, 63, z + 9], { tone: "mid" }, { r: 0.6 });
    box("PL2.guide.b", [452, 146, z], [522, 151, z + 9], { tone: "mid" }, { r: 0.6 });
    box("PL2.N2", [482, 196, z], [530, 204, z + 9], { tone: "lo" }, { r: 0.5, extra: Ln(k.lineOnTop([482, 200], [530, 200], z + 9, P), { tone: "mid" }) });
    terminals("PL2.B1", [530, 84], [544, 112], z, 10, 4, "y");
    onBoard("PL2", k.faceTextSvg(k.topMatrix([454, 236], z, P, "x"), "HERAEUS VÖTSCH 0318/784012-2", { size: 4, tone: "lo", anchor: "start" }) +
      k.faceTextSvg(k.topMatrix([519, 136], z, P, "x"), "N1", { size: 4, tone: "lo", anchor: "middle" }) + k.faceTextSvg(k.topMatrix([506, 210], z, P, "x"), "N2", { size: 4, tone: "lo", anchor: "middle" }));
    boardTag("PL2", [546, 236, z]);
  }

  // ---------------------------------------------------------------- 40-way ribbon PL2 → PL1
  {
    const pts = G.fillet([[64, 28, 15.6], [64, 28, 26], [64, 6, 26], [380, 6, 26], [400, 18, 22], [400, 18, 15.6]], 8, 10, { P, tube: 2.6 });
    R.route("ribbon", pts, 2.6, { limp: true });
    tubePieces(pts, 2.6, P, { maxLength: 40, spacing: 1.6 }).forEach((piece, i) => put(`ribbon:${i}`, piece.mid, tubeSvg(piece, { tone: "lo" }), [A.tube(piece.points, piece.radii)]));
  }

  A.settle(R, P);
  R.items.sort((a, b) => a.key - b.key);
  const body = R.items.map((item) => `<g class="it" data-name="${item.name}"${item.attrs ?? ""}>${item.svg}</g>`).join("");
  // greedy declutter: lift a tag until it clears every tag placed before it, with a leader to its part
  const placed = [];
  tags.sort((a, b) => b.ay - a.ay);
  for (const t of tags) {
    t.w = t.board ? t.id.length * 6 + 8 : t.id.length * 4.6 + 6;
    const hit = () => placed.some((o) => Math.abs(o.x - t.x) < (o.w + t.w) / 2 + 1 && Math.abs(o.y - t.y) < 11);
    while (hit()) t.y -= 4;
    placed.push(t);
  }
  const tagSvg = tags.map((t) => {
    const w = t.w;
    if (t.board) return `<g class="vc-tag vc-board"><text x="${f1(t.x)}" y="${f1(t.y + 3)}" text-anchor="middle">${t.id}</text></g>`;
    const lead = t.ay - t.y > 12 ? `<path class="vc-lead" d="M${f1(t.x)} ${f1(t.y + 4)}V${f1(t.ay)}"/><circle class="vc-lead-dot" cx="${f1(t.x)}" cy="${f1(t.ay)}" r="1"/>` : "";
    return lead + `<g class="vc-tag" data-relay-tag="${t.id}"><title>${t.id}: ${RELAYS[t.id]}</title><rect x="${f1(t.x - w / 2)}" y="${f1(t.y - 6)}" width="${f1(w)}" height="10" rx="2"/><text x="${f1(t.x)}" y="${f1(t.y + 1.6)}" text-anchor="middle">${t.id}</text></g>`;
  }).join("");
  const label = "The control electronics of the VMT 04/16 laid out on an ESD mat, placed from photos of the real boards: the base board PL1 with its relays, transformer and heatsinks; the socketed cooling relay 1K4 and the heater solid-state relay 1V6; the controller card 3N1 with relays 3K1 and 3K2; the specimen-protection card 3N2 with relay 3K3; and the front board PL2 with the fault-watch relays, the card sockets and the 40-way ribbon to PL1.";
  const svg = k.figureSvg({ width: W, height: H, label, body: [...back, `<g class="vc-boards">${body}</g>`, `<g class="vc-tags">${tagSvg}</g>`] });
  return { svg, R, P, relays: RELAYS };
}
