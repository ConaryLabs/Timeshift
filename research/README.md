# Timeshift Research

This folder contains research gathered to inform the design and implementation
of Timeshift — a scheduling system being built to replace ScheduleExpress,
starting with Valley Communications (Valleycom) in Kent, WA.

## Documents

| File | Contents |
|------|----------|
| [schedule-express-ux.md](./schedule-express-ux.md) | Feature map of ScheduleExpress from an employee-level account (Peter's login at Valleycom) |
| [valleycom-leave-types.md](./valleycom-leave-types.md) | Complete leave/absence codes from SE dropdown, two-flow model, schema implications |
| [valleycom-job-classifications.md](./valleycom-job-classifications.md) | Job categories (A/B/C), coverage requirements, SA/TG codes |
| [valleycom-ot-reasons-and-forms.md](./valleycom-ot-reasons-and-forms.md) | OT reason codes, OT request form, absence create step 1 + step 2 form fields, volunteered OT flow |
| [valleycom-trade-form.md](./valleycom-trade-form.md) | Trade create form fields and trade workflow |
| [vccea-contract-2025-2027.md](./vccea-contract-2025-2027.md) | **VCCEA Working Agreement 2025-2027** — job classifications, seniority rules, full OT callout process, trade rules, leave accrual |
| [vcsg-contract-2025-2026.md](./vcsg-contract-2025-2026.md) | **VCSG Working Agreement 2025-2026** — Supervisor Guild contract, supervisor roles, OT rules, wages/premiums, leave accrual, key diffs vs VCCEA |
| [vcsg-lous-2025.md](./vcsg-lous-2025.md) | **VCSG Letters of Understanding (2025)** — 3 current LOUs: 2nd supervisor OT posting, vCAD non-discipline period (expired), supervisor skill maintenance hours |
| [vccea-lous-2025.md](./vccea-lous-2025.md) | **VCCEA Letters of Understanding (2025)** — 4 current LOUs: comp accrual LWOP fix, vCAD non-discipline (expired), device restriction (expired), supervisor OT eligibility window 5→10 days |
| [valleycom-shift-patterns.md](./valleycom-shift-patterns.md) | **March 2026 Shift Bid** — 10-team structure, all shift time/day patterns, bid process mechanics, seniority order for COII+COI, 90-slot model, Timeshift data model implications |
| [valleycom-vacation-bid.md](./valleycom-vacation-bid.md) | **2026 Vacation Bid** — email-based process (not SE), combined all-employee seniority, 2 rounds, bid schedule Jan 16–31, allowance tiers, Google Calendar integration, March–Aug vs Sept–Feb hour rules |
| [valleycom-sops-scheduling.md](./valleycom-sops-scheduling.md) | **SOPs 100, 114, 116, 120, 122, 129, 129A, 211-12, 300** — org structure/chain of command, OT/comp procedures, trade workflow, work schedules, time off, leaves (FMLA/FCL/PFML/admin/LOA/LWOP), temp employees, attendance/notification rules |

## What We Know

### Leave / Absences
- 26 leave type codes confirmed from SE dropdown
- Two flows: Reported (sick/no-show, auto-status) vs Prior-Approval (planned, needs approval)
- Up to 5 leave type/hours pairs per absence day (split absences supported)
- Absences can be linked to trades (`tradeRecordPk`)
- FCL = **Family Care Leave** (Washington State) — prefix on Comp, Vacation, Sick, Holiday variants
- `C/V` in dashboard likely = "Comp first - Vac second"

### OT
- 29 OT reason codes confirmed from SE dropdown
- Two OT workflows:
  1. **Supervisor-initiated callout** (`overtimeUserRequest.do`) — creates an open OT slot
  2. **Employee volunteer** — employee clicks "Volunteer" on Available OT list
- Volunteered OT managed at `overtimeVolunteered.do` (list + delete only, no create form)
- Positions for OT: B Dispatcher, C Call Receiver
- Locations: Communications, OT - out of Com Room

### Trades
- Trade creates a shift offer: date + time slot + note + anyUser/groupId targeting
- Can be linked to an absence (`absenceRecordPk` on trade form)
- `(TR)` badge appears on schedule when a trade is active
- Workflow: create → available list → other employee accepts → supervisor approval (likely)

### Job Classifications
- A Supervisor (Min 1, Max 4), B Dispatcher (Min 10, Max 13), C Call Receiver (Min 8, Max 11)
- Max values likely per-shift-slot, not per-day total
- `Exclude` and `Other` categories not counted in coverage

---

## Research Still Needed

- [x] Union contract rules governing OT callout order — queue-based (moves to back after OT), not pure seniority or inverse hours
- [x] Union contract rules on trade requests — same classification only, 1-month deadline, no double trades
- [x] FCL = Family Care Leave (Washington State) — confirmed
- [x] Full shift patterns / rotation schedules — 10 teams, 10-hr COII/COI shifts, 12-hr supervisor shifts, 3/4-day consecutive day patterns, all 90 slots documented
- [x] Leave accrual rules — vacation by years of service (108–228 hrs/yr), sick 8 hrs/month, holiday 96 hrs/yr
- [x] Shift bid process — seniority-ordered, 1-hr windows, supervisor approval unlocks next bidder, ~4.5 days for full cohort; two cycles/year (Jan + July)
- [x] Vacation bid process — email-based (not SE), combined all-staff seniority, 2 rounds, 107+ employees, Jan 16–31; SE vacation entry unused at Valleycom in practice
- [x] `overtimeUserRequest.do` is employee-self-request (title: "Create User Requested Overtime")
- [ ] Absence step 2 with plain "Continue" (no RDO) — does `absType` change?
- [ ] Supervisor-level SE views (schedule management, admin config, OT callout initiation)
- [x] OT callout list order: queue system per classification (COI list separate from COII list)
- [ ] Coverage min/max per-shift vs per-day confirmation
- [ ] What "Valid Period" means on volunteered OT entries
- [x] `C/V` dashboard code = "Comp first – Vac second" — confirmed via VCCEA 25-06 LOU
