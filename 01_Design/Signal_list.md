# VMT 04/16 — Signal list for the new front board (replaces PL2 + 3N1)

Source: `00_Documentation/VMT 04-16, Betriebsanleitung d.pdf`, wiring diagrams pp. 46–60 (page numbers = PDF pages).
Status: **derived from the manual, not yet verified on the unit.** Tick the `✓` column after an ohmmeter check (power off).

## How to read the manual's numbering

| Notation in manual | Meaning |
|---|---|
| `1K…`, `1V…`, `1R…`, `1T1`, `1U1` | Part on **PL1** (base board, stays) |
| `2K…`, `2V…`, `2D…`, `2S…`, `2H…` | Part on **PL2** (front board, gets replaced) |
| `3N1`, `3K1`, `3K2`, `3R1` | Controller card RVME 2 (LP 81-102) and its socket — replaced |
| `3N2`, `3K3` | Specimen-protection card (LP 77-070-8) — **kept, plugs into new board** |
| `A1`, `A2`, `P1`, `P2`, `R1` | Front-plate parts: t1/t2 pots, time switch, display, t> pot |
| Socket symbol `⌒ n` (e.g. `13`, `23`) | **Pin n of the PL1↔PL2 ribbon cable** (assumed — verify, see V1) |
| `1.nn` (small circle) | Screw terminal on PL1 (field wiring to compressor, valves, etc.) |
| `2.nn` (small circle) | Screw terminal on PL2 (terminal strip 1–22) |
| `(nn) xx/y.z` (circled number) | Cross-reference to another sheet, not a physical pin |

## Power and rails

| Rail | What it is | Source | Note |
|---|---|---|---|
| `L+` / `L-` | 24 V DC stabilised control supply | PL1: 24 V~ → 1V1 → 1U1 | `L-` is common/ground for all 24 V logic |
| `T L+` | "Temperierung" rail: L+ after the **Temp. on** button | PL2: 2S1 → 2K2 | Off = chamber idle |
| `TE L+` | T L+ **and no fault** | PL2: fault chain → 2K4 contact | Powers all load relays; this is the master interlock |
| `1L+` / `1L-` | 9.5 V DC for the display P2 | PL1: 8 V~ → 1V3 | Not needed if new display has own supply |
| `2L1` / `2L2` | 22 V~ for 3N1 and hour counter P4 | PL1: 1T1 | 3N1 goes away; P4 stays on PL1 side |
| `4L1` / `4L2` | 24 V~ for time switch P1 and **3N2** | PL1: 1T1 | **Keep — 3N2 needs it** |

## A. Ribbon cable PL1 ↔ PL2 (the main interface)

Direction is seen from the new board: **OUT** = new board drives, **IN** = new board reads.

| Ribbon pin | Signal | Dir | Level | Function on PL1 / field | Page | ✓ |
|---|---|---|---|---|---|---|
| 1 | `L-` | PWR | 0 V | 24 V DC return, ground for all logic | 47 | |
| 2 | `L+` | PWR | +24 V DC | Stabilised 24 V from 1U1 | 47 | |
| 3, 4 | 24 V~ (`4L1`/`4L2`) | PWR | 24 V AC | Supply for 3N2 and time switch P1 | 46 | |
| 5, 6 | 22 V~ (`2L1`/`2L2`) | PWR | 22 V AC | Was 3N1 supply + hour counter via 2S1. Hour counter P4 needs this switched with Temp. on | 46 | |
| 38, 39 | `1L+` / `1L-` | PWR | 9.5 V DC | Display supply | 46 | |
| 13 | `TE L+` → 1K7, 1K8 | OUT | 24 V DC | **Load mains contactors**: L1.1/N1.1 to fan M1, compressor, valves, heater. Only when Temp. on AND no fault | 49 | |
| 23 | Cooling demand → 1K4 | OUT | 24 V DC | Was 3K1 contact (TE L+ → 3K1 → pin 23). 1K4 → 1K15 → solenoid **Y2** | 55 | |
| 8 | Heating demand → F7 → SSR 1V6 | OUT | 24 V DC | Was 3K2 contact (TE L+ → 3K2 → pin 8). Through **F7 (TW)** to heater SSR → **E2** | 56 | |
| 7 | Condenser fan → 1K9 | OUT | 24 V DC | Was 2K17 run-on timer contact. 1K9 → **M2** | 54 | |
| 12 | 1K4 NC contact → (was 2K17 coil) | IN | 24 V DC | High when **no** cooling demand; started the run-on timer | 54 | |
| 24 | → 1K10 (compressor) | OUT? | 24 V DC | Fed from TE L+ via 2V51; compressor **M3** — see V3 | 54 | |
| 22 | Light → 1K2 | OUT | 24 V DC | Was 2S2 button. 1K2 → lamp **E1** (24 V~) | 57 | |
| 20 | Y2 state (node after F15) | IN | 24 V DC | Drives the "Y2 open" LED | 55 | |
| 15 → 11 | `T L+` out to PL1 terminals 76/77, back in | OUT/IN | 24 V DC | External enable loop; jumper **1Tr.5** on PL1 terminals 76–77. Start of fault chain | 48 | |
| 37 → 35 | Fault chain out and back | OUT/IN | 24 V DC | Loop through PL1 before 2K4 coil — check what's in between | 48 | |
| 27 → 28 | Fan motor M1 thermal contact (1.54–1.55, bridged) | OUT/IN | 24 V DC | Feeds fault relay **2K7** | 50 | |
| 9 → 10 | Temperature limiter **F5 (TB)** (1.59–1.60) | OUT/IN | 24 V DC | Feeds fault relay **2K6** | 56 | |
| 31 → 32 | Compressor thermal protection (1.64–1.57) | OUT/IN | 24 V DC | Feeds fault relay **2K9** | 53 | |
| 36 → 16 | Pressure switch **F2** (1.53–1.51) | OUT/IN | 24 V DC | Feeds fault relay **2K18** | 53 | |
| 18 | External fault relay 01/K2 (PL1 1.3–1.4) | OUT | 24 V DC, ≤100 mA | Collective fault output to outside world (manual p. 17) | 49 | |

Ribbon pins **not** found in the manual: 14, 17, 19, 21, 25, 26, 29, 30, 33, 34, 40 — probably unused or optional features (dew point, CO₂, IEEE bus). Measure them anyway.

## B. Other connections on the current PL2 that the new board must provide

| Connection | Signal | Notes | Page | ✓ |
|---|---|---|---|---|
| Orange 4-pin "4(B1) 3 2 1(B2)" | Pt100 sensor(s) from the work space | B1 (controller) and B3 (3N2) have the **same part number** "2× Pt100 DIN" → likely one dual-element probe: one element per card. 2-wire | 42, 40, 60 | |
| 3N2 socket (8-pin edge) | 1 → E/S, 8 → A+ (t> pot R1, 1 kΩ) · 2, 3 → Pt100 B3 · 4, 5 → 24 V~ (4L1/4N1) · 6, 7 → contact 3K3 | Reuse the same socket type; keep pinout identical | 58 | |
| Terminals E, S, A+, A-, I, II | t> pot R1 (MUP 4000 1 kΩ) on front plate + R5 | I/II only used on ranges below 0 °C | 58 | |
| Terminals 2.21 / 2.22 | Time switch P1 contact | Drops out — setpoint switching moves to firmware | 59 | |
| Terminals 2.31 / 2.32 (2TR1) | Jumper in Temp. on circuit | Keep as option or drop | 48 | |
| Terminals 2.15 / 2.16 | Recorder output 10 mV/°C (optional) | Not needed, firmware logs instead | 60 | |

## C. Logic that lives on PL2 today — and where it goes

**Fault logic: hardware on the new board** (your decision). Every fault relay works the same way: it's energised through its field contact and holds itself through its own 11–14 contact. If the contact opens once, the relay drops and stays off (latched) until it's re-armed. A flasher (2D1–2D8) drives the matching LED while the relay is off.

| Relay | Watches | Field contact (ribbon) | Page |
|---|---|---|---|
| 2K6 | Temp. limiter F5 (TB) | 9 → 10 | 56 |
| 2K7 | Fan motor M1 thermal | 27 → 28 | 50 |
| 2K8 | Specimen protection 3N2 (3K3) | internal | 58 |
| 2K9 | Compressor thermal | 31 → 32 | 53 |
| 2K18 | Overpressure F2 | 36 → 16 | 53 |
| 2K3 | Arms/resets all fault relays (pulse through 2C1 at Temp. on) | — | 49 |
| 2K4 | All fault relays OK → switches `T L+` to `TE L+` (pin 13); NC contact → fault output (pin 18) | 37 → 35 | 48, 49 |

Plan: copy this circuit 1:1 (relays, RC arming pulse), and feed the MCU **read-only** copies of each relay's state through optocouplers for display and logging. The MCU can never switch `TE L+` on by itself.

**Moves to firmware** (not safety-related):

| Today | Part | Firmware replacement |
|---|---|---|
| 3N1 controller | RVME 2 | Pt100 read (MAX31865) + split-range PID |
| Setpoint pots t1/t2, time switch P1, mode relays 2K13/2K14/2K15/2K19, buttons 2S3/2S4/2S7 | front plate / PL2 | Setpoint, programs, ramp/soak |
| Display P2, status LEDs | PL2 | New UI |
| Condenser-fan run-on 2K17 | timer relay (PL2) | Timer in firmware (or keep a hardware timer if you want it fail-safe) |
| Lamp test 2S9/2K1 | PL2 | UI self-test |

**The firmware's only outputs into the power side** are pin 23 (cool), pin 8 (heat), pin 7 (condenser fan) and pin 22 (light). All four only reach anything if `TE L+` is live, because 1K7/1K8 cut mains to the loads otherwise. **F7 (TW)** sits in series with the heater on PL1 regardless. These outputs should be potential-free contacts (small relays) switching `TE L+`, so the original wiring logic is kept exactly.

## Open questions — measure before designing

| # | Question | How |
|---|---|---|
| V1 | Are the `⌒ n` numbers really the ribbon pins? | Power off: continuity from ribbon pin 13 to the 1K7/1K8 coils, pin 23 to 1K4, pin 8 to PL1 terminal 1.50 |
| V2 | Is the 4-pin sensor connector one dual Pt100 (B1 + B3)? | Unplug, measure each pair: ~108 Ω at 20 °C; check for isolation between pairs |
| V3 | Does the compressor run continuously while Temp. is on, or only on cooling demand? Pin 24 / 2V51 suggests continuous | Watch the M3 LED at a heating setpoint (+80 °C) |
| V4 | What's between ribbon 37 and 35, and on PL1 terminals 76/77 (1Tr.5)? | Continuity on PL1 |
| V5 | Which unused ribbon pins carry anything? | Continuity or voltage per pin |
| V6 | Coil currents of 1K4, 1K9, 1K2, 1K7+1K8 | Measure coil resistance → size the output relays |
