// Live model of the VMT 04/16: three-point control (3N1) of a lumped chamber fitted to the manual's curves,
// an R502 refrigeration circuit (pressures from a saturation fit), refrigerant flow and an exploded view.
const VC = __DATA__;
const vcStage = document.querySelector(".vc-stage");
const vcSvg = vcStage.querySelector("svg");
const vcCab = vcSvg.querySelector(".vc-cab");
const vcReadout = document.querySelector("[data-readout]");
const vcDigits = vcSvg.querySelector('[data-part="digits"]');
const vcBlades = vcSvg.querySelector('[data-part="m2-blades"]');
const vcButton = document.querySelector("[data-explode]");
const vcPartsLabel = document.querySelector("[data-parts]");
const vcStill = matchMedia("(prefers-reduced-motion: reduce)");
const vcSys = (name) => [...vcSvg.querySelectorAll(`.it[data-sys="${name}"]`)];
const vcParts = { E2: vcSys("E2"), Y2: vcSys("Y2"), W3: vcSys("W3"), COLD: vcSys("COLD"), HOT: vcSys("HOT"), WARM: vcSys("WARM"), M2: vcSys("M2") };
const vcLeds = Object.fromEntries([...vcSvg.querySelectorAll("[data-led]")].map((el) => [el.dataset.led, el]));
const vcNeedles = { HP: vcSvg.querySelector('[data-part="needle-HP"]'), LP: vcSvg.querySelector('[data-part="needle-LP"]') };
const vcValues = Object.fromEntries([...document.querySelectorAll("[data-v]")].map((el) => [el.dataset.v, el]));
const vcStage2 = document.querySelector(".vc-stage2");
const vcRelays = [...document.querySelectorAll(".vc-stage2 [data-relay], .vc-stage2 [data-relay-tag]")].map((el) => ({ el, id: el.dataset.relay ?? el.dataset.relayTag }));
const vcChains = [...document.querySelectorAll("[data-chain]")];
const vcReadout2 = document.querySelectorAll("[data-readout]")[1];
const vcFlows = [...vcSvg.querySelectorAll(".vc-flow")].map((el) => ({ el, route: el.dataset.route, a: Number(el.dataset.a), b: Number(el.dataset.b), shown: "" }));

// ---------------------------------------------------------------- chamber model (manual p. 6, 23 °C ambient)
const HEAT = { to: 180, tau: 34 }, COOL = { to: -45, tau: 17 }, IDLE = { to: 26, tau: 34 };
const BAND = 0.5, RUN_ON = 3;
const MIN_SET = -40, MAX_SET = 130, STEP = 5;
let air = 23, set = 23, mode = "hold", runOn = 0, minutes = 0, fanAngle = 0;
// R502 saturation, Clausius-Clapeyron fit through -45.4 °C / 1.013 bar and +40 °C / 16.6 bar (absolute)
const psat = (t) => Math.exp(10.262 - 2334 / (t + 273.15));
const tsat = (p) => 2334 / (10.262 - Math.log(p)) - 273.15;
const AMBIENT = 23, COND_LIFT = 15, EVAP_DT = 10;
let hp = psat(AMBIENT + 5), lp = 0.35;                         // bar absolute
const flowPhase = {};

let touring = !vcStill.matches, tourIndex = 0, tourHold = 0, idleTimer = 0, frame = 0, last = 0, visible = false;
const TOUR = [80, 130, 23, -20, -40, 23];
const vcSign = (t) => (t > 0 ? "+" : t < 0 ? "−" : "±") + Math.abs(t).toFixed(0);
const vcDisplay = (t) => { const r = Math.round(t); return (r >= 100 ? String(r) : (r < 0 ? "-" : "+") + Math.abs(r)).padStart(3, " "); };
const signed = (v, d = 1) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(d);

function stepModel(dt) {
  if (air < set - BAND) mode = "heat";
  else if (air > set + BAND) mode = "cool";
  else if ((mode === "heat" && air >= set) || (mode === "cool" && air <= set)) mode = "hold";
  const plant = mode === "heat" ? HEAT : mode === "cool" ? COOL : IDLE;
  air += ((plant.to - air) / plant.tau) * dt;
  runOn = mode === "cool" ? RUN_ON : Math.max(0, runOn - dt);
  minutes += dt;
  // pressures: Y2 open -> condensing ~15 K over ambient, evaporating ~10 K under the air;
  // Y2 shut -> the running compressor pumps the low side down and the high side settles toward ambient
  const open = mode === "cool";
  const hpT = open ? psat(AMBIENT + COND_LIFT) : psat(AMBIENT + 5 + (runOn > 0 ? 6 : 0));
  const lpT = open ? psat(Math.max(-55, Math.min(5, air - EVAP_DT))) : 0.35;
  hp += (hpT - hp) * (1 - Math.exp(-dt / 0.6));
  lp += (lpT - lp) * (1 - Math.exp(-dt / (open ? 0.25 : 0.5)));
}

// ---------------------------------------------------------------- explode: staggered springs, per-frame depth order
const nodes = [...vcCab.querySelectorAll(".it")].map((el) => {
  const m = el.dataset.m.split(",").map(Number);
  return { el, ride: el.dataset.ride, key: Number(el.dataset.k), m, lift: m[0] * VC.V[0] + m[1] * VC.V[1] + m[2] * VC.V[2], shown: "" };
});
let order = nodes.map((_, i) => i);
const IDS = Object.keys(VC.pieces);
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
let apart = false, clock = 0;

function setApart(on) {
  if (apart === on) return;
  apart = on;
  const goal = on ? 1 : 0;
  let index = 0;
  for (const id of on ? VC.stagger : [...VC.stagger].reverse()) {
    if (piece[id].target === goal) piece[id].pending = null;
    else piece[id].pending = { value: goal, at: clock + (vcStill.matches ? 0 : index++ * VC.spring.stagger) };
  }
  vcButton.textContent = on ? "Put together" : "Take apart";
  vcButton.setAttribute("aria-pressed", String(on));
  vcPartsLabel.textContent = on ? "top cover · plug door · control panel · insulated box with the air duct · machine room" : "";
  run();
}
function steerSpring(state, dt) {
  if (state.pending && clock >= state.pending.at) { state.target = state.pending.value; state.pending = null; }
  if (vcStill.matches) { state.x = state.target; state.v = 0; return state.pending !== null; }
  const { stiffness, damping, substeps } = VC.spring;
  for (let i = 0; i < substeps; i++) { const h = dt / substeps; state.v += ((state.target - state.x) * stiffness - state.v * damping) * h; state.x += state.v * h; }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) { state.x = state.target; state.v = 0; return state.pending !== null; }
  return true;
}
function place() {
  for (const node of nodes) {
    const share = piece[node.ride].x;
    const tx = (VC.EX[0] * node.m[0] + VC.EY[0] * node.m[1] + VC.EZ[0] * node.m[2]) * share;
    const ty = (VC.EX[1] * node.m[0] + VC.EY[1] * node.m[1] + VC.EZ[1] * node.m[2]) * share;
    const text = share === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) { node.shown = text; text ? node.el.setAttribute("transform", text) : node.el.removeAttribute("transform"); }
  }
  const next = nodes.map((_, i) => i).sort((a, b) => nodes[a].key + nodes[a].lift * piece[nodes[a].ride].x - (nodes[b].key + nodes[b].lift * piece[nodes[b].ride].x));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    vcCab.appendChild(fragment);
    order = next;
  }
}

// ---------------------------------------------------------------- drawing
function bladesPath(angle) {
  const [cx, cy, cz] = VC.fan.c, out = [];
  for (let i = 0; i < 5; i++) {
    const a = angle + (i / 5) * Math.PI * 2;
    const pt = (r, da) => iso([cx, cy + Math.cos(a + da) * r, cz + Math.sin(a + da) * r], VC.P);
    const pts = [pt(VC.fan.r0, -0.32), pt(VC.fan.r1 * 0.62, -0.26), pt(VC.fan.r1, -0.1), pt(VC.fan.r1, 0.2), pt(VC.fan.r1 * 0.62, 0.22), pt(VC.fan.r0, 0.3)];
    out.push("M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z");
  }
  return out.join("");
}
function needle(el, scale, bar) {
  const share = Math.max(-0.02, Math.min(1.02, (bar - scale.min) / (scale.max - scale.min)));
  const a = (-135 + 270 * share) * Math.PI / 180;
  el.setAttribute("d", `M${(-Math.sin(a) * 2.6).toFixed(2)} ${(Math.cos(a) * 2.6).toFixed(2)}L${(Math.sin(a) * 10.6).toFixed(2)} ${(-Math.cos(a) * 10.6).toFixed(2)}`);
}
function flowDots(flowing) {
  for (const f of vcFlows) {
    const R = VC.flow[f.route];
    let d = "";
    if (flowing && R) {
      const gap = R.kind === "liquid" ? 9 : 14;
      const spans = R.fast ? [[f.a, Math.min(f.b, R.from), flowPhase[f.route]], [Math.max(f.a, R.from), f.b, flowPhase[f.route + ":fast"]]] : [[f.a, f.b, flowPhase[f.route]]];
      for (const [from, to, phase] of spans) {
        if (to <= from) continue;
        for (let s = from + ((((phase - from) % gap) + gap) % gap); s < to; s += gap) {
          const at = s / R.step, i = Math.min(R.pts.length - 2, Math.floor(at)), t = at - i;
          const x = R.pts[i][0] + (R.pts[i + 1][0] - R.pts[i][0]) * t, y = R.pts[i][1] + (R.pts[i + 1][1] - R.pts[i][1]) * t;
          d += `M${(x - 0.9).toFixed(1)} ${y.toFixed(1)}a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0`;
        }
      }
    }
    if (d !== f.shown) { f.shown = d; f.el.setAttribute("d", d); }
  }
}
const setOn = (els, value) => els.forEach((el) => (value ? el.getAttribute("data-on") !== value && el.setAttribute("data-on", value) : el.hasAttribute("data-on") && el.removeAttribute("data-on")));
const say = (key, text) => { const el = vcValues[key]; if (el && el.textContent !== text) el.textContent = text; };
// Fig 2: which relay pulls in (manual pp. 48-58). ALWAYS = chamber on and no fault latched.
const ALWAYS = ["2K2", "2K4", "2K6", "2K7", "2K8", "2K9", "2K18", "1K7", "1K8", "1K10", "3K3"];
function relayState(id, cooling, heating, fan2) {
  if (ALWAYS.includes(id)) return "on";
  if (id === "3K1" || id === "1K4" || id === "1K15") return cooling && "cold";
  if (id === "1K9") return fan2 && "cold";
  if (id === "2K17") return !cooling && runOn > 0 && "warm";
  if (id === "3K2" || id === "1V6") return heating && "hot";
  return false;
}
function drawRelays(cooling, heating, fan2) {
  for (const r of vcRelays) setOn([r.el], relayState(r.id, cooling, heating, fan2));
  const chains = { cool: cooling && "cold", heat: heating && "hot", fan: fan2 && (cooling ? "cold" : "warm"), mains: "on" };
  const words = { cool: cooling ? "Y2 open" : "off", heat: heating ? "E2 on" : "off", fan: cooling ? "M2 running" : runOn > 0 ? "run-on" : "off", mains: "energised" };
  for (const el of vcChains) {
    const id = el.dataset.chain;
    setOn([el], chains[id]);
    const out = el.querySelector("[data-chain-state]");
    if (out.textContent !== words[id]) out.textContent = words[id];
  }
  const text = heating ? "heating · 3K2, 1V6 in" : cooling ? "cooling · 3K1, 1K4, 1K15, 1K9 in" : runOn > 0 ? "holding · 2K17 run-on, 1K9 in" : "holding · only the always-on relays in";
  if (vcReadout2 && vcReadout2.textContent !== text) vcReadout2.textContent = text;
}
function draw() {
  const heating = mode === "heat", cooling = mode === "cool", fan2 = cooling || runOn > 0;
  setOn(vcParts.E2, heating && "hot");
  setOn(vcParts.HOT, "hot");
  setOn(vcParts.WARM, "warm");
  setOn([...vcParts.Y2, ...vcParts.W3, ...vcParts.COLD], cooling && "cold");
  setOn(vcParts.M2, fan2 && "on");
  vcSvg.setAttribute("data-y2", cooling ? "open" : "closed");
  const te = tsat(lp);
  if (cooling && te < -2) vcSvg.setAttribute("data-frost", ""); else vcSvg.removeAttribute("data-frost");
  const leds = { E2: heating && "hot", Y2: cooling && "cold", M1: "on", M3: "on", M2: fan2 && "on", E1: false, F5: false, F2: false, TP: false };
  for (const [id, on] of Object.entries(leds)) if (vcLeds[id]) setOn([vcLeds[id]], on);
  const shown = vcDisplay(air);
  if (vcDigits.textContent !== shown) vcDigits.textContent = shown;
  vcBlades.setAttribute("d", bladesPath(fanAngle));
  needle(vcNeedles.HP, VC.gauges.HP, hp - 1.013);
  needle(vcNeedles.LP, VC.gauges.LP, lp - 1.013);
  flowDots(cooling && !vcStill.matches);
  say("hp", `${signed(hp - 1.013).replace("+", "")} bar`);
  say("tc", `condensing ${signed(tsat(hp), 0)} °C`);
  say("lp", `${signed(lp - 1.013).replace("+", "")} bar`);
  say("te", cooling ? `evaporating ${signed(te, 0)} °C` : "pumped down, no flow");
  say("y2", cooling ? "open" : "shut");
  say("flow", cooling ? "R502 flowing to V3" : "no refrigerant to W3");
  say("e2", heating ? "on" : "off");
  say("air", `air ${signed(air)} °C · set ${vcSign(set)} °C`);
  const what = heating ? "E2 heating · Y2 shut" : cooling ? "Y2 open · E2 off" : "Y2 shut · E2 off";
  const text = `set ${vcSign(set)} · air ${signed(air)} °C · ${what}`;
  if (vcReadout.textContent !== text) vcReadout.textContent = text;
  drawRelays(cooling, heating, fan2);
  vcStage.setAttribute("aria-valuenow", String(set));
  vcStage.setAttribute("aria-valuetext", text + (apart ? " · taken apart" : ""));
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;   // one real second = one chamber minute
  last = now;
  clock += dt;
  if (touring) {
    set = TOUR[tourIndex];
    if (Math.abs(air - set) < 1) { tourHold += dt; if (tourHold > 4) { tourHold = 0; tourIndex = (tourIndex + 1) % TOUR.length; } }
  }
  for (let i = 0; i < 4; i++) stepModel(dt / 4);
  if (!vcStill.matches && (mode === "cool" || runOn > 0)) fanAngle += dt * 9;
  for (const [name, R] of Object.entries(VC.flow)) {
    flowPhase[name] = (flowPhase[name] ?? 0) + R.speed * dt;
    if (R.fast) flowPhase[name + ":fast"] = (flowPhase[name + ":fast"] ?? 0) + R.fast * dt;
  }
  for (const id of IDS) steerSpring(piece[id], dt);
  place();
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (value) => {
  touring = false;
  set = Math.max(MIN_SET, Math.min(MAX_SET, Math.round(value / STEP) * STEP));
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !vcStill.matches; tourHold = 0; }, 25000);
  draw();
  run();
};
const vcSeen = new Set();
const vcWatch = new IntersectionObserver((entries) => {
  for (const e of entries) e.isIntersecting ? vcSeen.add(e.target) : vcSeen.delete(e.target);
  visible = vcSeen.size > 0;
  if (visible) run();
}, { rootMargin: "120px 0px" });
vcWatch.observe(vcStage);
if (vcStage2) vcWatch.observe(vcStage2);
vcStage.addEventListener("pointermove", (event) => {
  const box = vcSvg.getBoundingClientRect();
  const share = Math.max(0, Math.min(1, ((event.clientX - box.left) / box.width - 0.12) / 0.76));
  steer(MIN_SET + share * (MAX_SET - MIN_SET));
});
vcStage.addEventListener("keydown", (event) => {
  if (event.key === "e" || event.key === "E") { event.preventDefault(); setApart(!apart); return; }
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = set + STEP;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = set - STEP;
  if (event.key === "Home") to = MIN_SET;
  if (event.key === "End") to = MAX_SET;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
vcButton.addEventListener("click", () => setApart(!apart));
draw();
