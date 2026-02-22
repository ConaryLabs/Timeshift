# VCCEA Letters of Understanding — Current (2025)

**Source:** Peter's Documents folder (PDFs from PowerDMS, VCCEA Employees → Current Agreements)
**Extracted:** Feb 2026 via Tesseract OCR

---

## VCCEA 25-06: Comp Accruals / LWOP Fix

**Status:** Active (no expiration date listed; appears unsigned on document — may be pending or ongoing practice)

### Summary
Changes how the "Comp first – Vac second" (`C/V`) leave combination is processed in ADP to eliminate LWOP gaps caused by 15-minute rounding rules.

**Old behavior (caused LWOP):**
- Comp: 4.13 hrs, Vacation: 5.9 hrs → Total actual: 10.03 hrs
- ADP entry: comp 4 + vacation 5.75 = 9.75 hrs → **0.25 hrs LWOP**

**New process:**
- Same balances → ADP entry: comp 4.13 + vacation 5.87 = 10.00 hrs → **No LWOP**
- Comp is **fully depleted** before vacation backfills any shortage

### Rule
When an employee submits time off using comp and vacation:
1. Comp accruals are applied first
2. If employee is at risk of LWOP due to rounding: **comp bank is completely depleted** before backfilling with vacation

### Timeshift Implications
- The `Comp first – Vac second` leave type must deplete comp fully before drawing vacation
- 15-minute rounding must be handled at the payroll export layer — don't round down comp and leave a gap; instead, bleed remaining fractions into vacation
- This confirms `C/V` = "Comp first, Vacation second" (resolves the `C/V` dashboard code question from earlier research)

---

## VCCEA 25-08: vCAD Non-Disciplinary Period

**Effective:** November 19, 2025
**Expired:** February 17, 2026
**Status:** EXPIRED (possible extension pending)

### Summary
90-day non-disciplinary period for issues or errors attributable to the new vCAD system (Versaterm). Mirrors VCSG 2025-04 exactly — both bargaining units got identical terms.

- Does not cover NDA violations
- Both sides reserved right to revisit for extension

---

## VCCEA 25-09: Electronic Device Restriction (vCAD Go-Live)

**Effective:** November 19, 2025 (80-hour / ~2 week window post go-live)
**Status:** Almost certainly expired given it covered the first 80 hours post-launch

### Summary
Temporary restriction on personal electronic device use in the com room for 80 hours (8 full 10-hour shifts) after Versaterm CAD go-live.

**Allowed:**
- Physical books, Kindle (no internet)
- Coloring, crossword/word search puzzles (paper-based)
- Crocheting

**Not allowed:**
- Internet/social media on personal devices
- Video games
- Physical puzzles, card games
- Non-work apps on the Thin Client

Honor system — supervisors not tracking hours. Any dishonesty may result in an inquiry. Both sides reserved right to extend.

### Timeshift Relevance
None directly. Confirms Versaterm go-live was November 19, 2025, and that the center runs on "Thin Client" workstations.

---

## VCCEA 25-10: Supervisor OT Eligibility (Window Extension)

**Expires:** February 28, 2026 (9 days from today)
**Status:** ACTIVE

### Summary
**Amends VCCEA CBA §4.4.1 (Voluntary Overtime)** — extends the window before OT can cross classifications.

| | Old Rule (CBA §4.4.1) | New Rule (this LOU) |
|---|---|---|
| COI OT cross-eligibility | 5 days | **10 days** |
| COII OT cross-eligibility | 5 days | **10 days** |

**New §4.4.1 language:**
- COI OT not signed up for within **10 days** → may be worked by employees in other classifications
- COII OT not signed up for within **10 days** → may be worked by a Supervisor

**Additional new language:**
> Supervisors may also receive an OT page when there is uncoverable COI/COII OT that may end up in exigent circumstances.

This formalizes supervisor paging for urgent uncoverable OT even outside the normal step process.

### Timeshift Implications
**This directly changes a number in the OT system.** The VCCEA contract says 5 days — this LOU changes it to **10 days** (at least through Feb 28, 2026; likely to be renewed or made permanent).

- The OT slot "cross-classification eligible" timer should use **10 days** as the current threshold
- The system should support this being configurable, since it may revert to 5 days or be set permanently to 10
- Supervisors can be included in OT pages for exigent/uncoverable COI/COII OT — this is a new channel to model in the callout flow

---

## Summary Table

| LOU | Subject | Expires | Status | Timeshift Impact |
|-----|---------|---------|--------|-----------------|
| 25-06 | Comp+Vac LWOP fix (rounding) | None listed | Active | Comp fully depleted before vacation draws; confirms `C/V` code |
| 25-08 | vCAD non-discipline (Versaterm) | Feb 17, 2026 | Expired | None |
| 25-09 | Electronic device restriction (go-live) | ~Dec 2025 | Expired | None |
| 25-10 | Supervisor OT eligibility window 5→10 days | Feb 28, 2026 | Active | OT cross-class threshold = 10 days (not 5) |
