// quick Fig 2 preview without the slow Fig 1 settle: node preview2.mjs [--light] [--audit2]
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const SKILL = "C:/Users/janse/.claude/skills/anatomy/";
const u = (p) => pathToFileURL(SKILL + p).href;
const k = await import(u("kit/iso-kit.mjs")), G = await import(u("kit/lathe.mjs")), A = await import(u("kit/audit.mjs"));
const { tubePieces, tubeSvg } = await import(u("kit/tube.mjs"));
const { boards } = await import("./boards.mjs");
const F = boards({ k, G, A, tubePieces, tubeSvg });
const css = readFileSync("chamber.css", "utf8");
const on = `for(const el of document.querySelectorAll("[data-relay],[data-relay-tag]")){const id=el.dataset.relay??el.dataset.relayTag;const v=["3K1","1K4","1K15","1K9"].includes(id)?"cold":["2K2","2K4","2K6","2K7","2K8","2K9","2K18","1K7","1K8","1K10","3K3"].includes(id)?"on":null;if(v)el.setAttribute("data-on",v)}`;
writeFileSync("fig2-preview.html", k.pageHtml({ title: "Fig 2", theme: process.argv.includes("--light") ? "light" : "dark", body: `<style>${css}</style>` + k.plateHtml({ fig: "Fig 2", title: "preview", body: `<div class="iso-stage">${F.svg}</div>` }), script: on, width: 680 }));
console.log("items", F.R.items.length);
A.auditOrExit(F.R, F.P, { flag: "--audit2" });
