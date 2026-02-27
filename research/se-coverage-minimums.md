# se-coverage-extraction-results.md
# ScheduleExpress Coverage Data Extraction Results

Source: https://www.scheduleexpress.com/app/coverageGridView.do?view=day
Location: Communications
Date range sampled: Mon Feb 23 - Sun Mar 1, 2026
Data extracted from: JavaScript `d` array in iframe (`minReqText` values)

---

## Coverage Plan Info

From Schedule Coverage Validation Exceptions Report (`scheduleCoverageList.do`):

| Coverage Plan | Date Range | Location |
|---|---|---|
| **Communications 2026** | **03/01/2026 - 03/06/2027** | Communications |
| Communications 2025 | 03/02/2025 - 02/28/2026 | Communications |
| Communications 2024 | 03/03/2024 - 03/01/2025 | Communications |
| Communications 2023 2.0 | 03/05/2023 - 03/02/2024 | Communications |
| Communications 2023 | 01/01/2023 - 03/04/2023 | Communications |
| Communications 2022 | 01/01/2022 - 12/31/2022 | Communications |
| Communication 2020 | 09/06/2020 - 12/31/2021 | Communications |

All plans use Schedule "V2 Schedule (06/01/2020 - NoEndDate)".
The **current active plan is Communications 2025** (covers through 02/28/2026). Communications 2026 starts 03/01/2026.

---

## Minimum Staffing by 2-Hour Block (Per Day of Week)

Values are the **Min requirement** row from the SE coverage grid, NOT actual staffing counts.
Within each 2-hour block, all four 30-min slots have the same min value.
All transitions occur on even-hour boundaries only (verified across all days/classifications).

### A Supervisor (= our SUP)

**Identical all 7 days:**

| Block | Min |
|---|---|
| 00-02 | 1 |
| 02-04 | 1 |
| 04-06 | 1 |
| 06-08 | 2 |
| 08-10 | 2 |
| 10-12 | 2 |
| 12-14 | 2 |
| 14-16 | 2 |
| 16-18 | 2 |
| 18-20 | 2 |
| 20-22 | 2 |
| 22-24 | 1 |

### B Dispatcher (= our COII)

**Varies by day -- Monday and Sunday differ from the rest:**

| Block | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| 00-02 | **9** | 10 | 10 | 10 | 10 | 10 | 10 |
| 02-04 | **9** | **9** | 10 | 10 | 10 | 10 | 10 |
| 04-06 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| 06-08 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| 08-10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 |
| 10-12 | 10 | 10 | 10 | 10 | 10 | 10 | 10 |
| 12-14 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 14-16 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 16-18 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 18-20 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 20-22 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 22-24 | 11 | 11 | 11 | 11 | 11 | 11 | **10** |

Differences from the most common pattern (Tue-Sat minus Mon/Sun):
- Mon 00-01: 9 (others 10) -- overnight into Monday needs fewer dispatchers
- Tue 02-03: 9 (Wed-Sat have 10) -- early Tuesday morning lower
- Sun 22-23: 10 (others 11) -- Sunday night winding down

### C Call Receiver (= our COI)

**Most variation -- Sunday is significantly different:**

| Block | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| 00-02 | 7 | 7 | 7 | 7 | 7 | **8** | **8** |
| 02-04 | 6 | 6 | 6 | 6 | 6 | **7** | 6 |
| 04-06 | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| 06-08 | 6 | 6 | 6 | 6 | 6 | 6 | 6 |
| 08-10 | 8 | 8 | 8 | 8 | 8 | 8 | **7** |
| 10-12 | 8 | 8 | 8 | 8 | 8 | 8 | 8 |
| 12-14 | **10** | 11 | 11 | **10** | **10** | 11 | **9** |
| 14-16 | 12 | 12 | 12 | 12 | 12 | 12 | **10** |
| 16-18 | 13 | 13 | 13 | 13 | 13 | 13 | **11** |
| 18-20 | 12 | 12 | 12 | 12 | 12 | 12 | **11** |
| 20-22 | 11 | 11 | 11 | 11 | 11 | 11 | **10** |
| 22-24 | 11 | 11 | 11 | 11 | 11 | 11 | **10** |

Key patterns:
- **Sunday is significantly lower** in afternoon/evening (9-11 vs 10-13)
- **Saturday overnight** (00-03) runs slightly higher than weekday overnights
- **Mon/Thu/Fri 12-13** = 10, but **Tue/Wed/Sat 12-13** = 11
- **04-05 is the universal low point** (5 across all days)
- **16-17 is the universal peak** (13 for Mon-Sat, 11 for Sunday)

---

## Why Per-Day Variation Exists: Console Schedules

The per-day staffing differences are driven by which consoles are open:

- **Fire 3**: closed 00:00-08:00 every night/morning (consolidates into Fire 1)
- **Data Radio**: Sun 12:00-22:00, Mon 12:00-02:00, Tue-Sat 12:00-04:00

This explains:
- **B Dispatcher Mon 00-04 = 9** (vs 10): Fire 3 closed + data radio closed (ended Sun 22:00)
- **B Dispatcher Tue 02-04 = 9** (vs Wed-Sat 10): data radio closed at Mon 02:00
- **B Dispatcher Sun 22-24 = 10** (vs 11): data radio closes at 22:00 on Sunday
- **C Call Receiver Sunday lower afternoon/evening**: fewer call receivers needed when data radio closes earlier

---

## Implications for Timeshift

1. **Coverage plans need per-day-of-week granularity** -- a single "weekday" vs "weekend" split is NOT sufficient. Sunday differs from Saturday, and Monday/Tuesday differ from Wed-Fri. The differences are driven by console open/close schedules.

2. **The 2-hour block granularity aligns** -- all half-hour slots within a 2-hour block have identical min values, confirming SE uses 2-hour blocks internally for coverage requirements. All transitions occur on even-hour boundaries.

3. **For simplicity, possible groupings:**
   - A Supervisor: same every day (no per-day needed)
   - B Dispatcher: could use 3 profiles (Mon, Tue, Wed-Sat) + Sunday exception at 22-24
   - C Call Receiver: needs full 7-day profiles due to scattered differences

4. **Alternatively, store per-day-of-week coverage requirements** in the coverage_requirements table (adding a `day_of_week` column or similar) to match SE exactly.

---

## Raw Half-Hour Data (for verification)

### Tuesday (representative weekday) - All 48 half-hour Min values

**A Supervisor:** 1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1

**B Dispatcher:** 10,10,10,10,9,9,9,9,9,9,9,9,9,9,9,9,10,10,10,10,10,10,10,10,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11

**C Call Receiver:** 7,7,7,7,6,6,6,6,5,5,5,5,6,6,6,6,8,8,8,8,8,8,8,8,11,11,11,11,12,12,12,12,13,13,13,13,12,12,12,12,11,11,11,11,11,11,11,11

### Sunday (most different day) - All 48 half-hour Min values

**A Supervisor:** 1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1

**B Dispatcher:** 10,10,10,10,10,10,10,10,9,9,9,9,9,9,9,9,10,10,10,10,10,10,10,10,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,10,10,10,10

**C Call Receiver:** 8,8,8,8,6,6,6,6,5,5,5,5,6,6,6,6,7,7,7,7,8,8,8,8,9,9,9,9,10,10,10,10,11,11,11,11,11,11,11,11,10,10,10,10,10,10,10,10

### Max values (Tuesday, for reference)

**A Supervisor Max:** 4 (all slots, all days)

**B Dispatcher Max:** 13,13,13,13,12,12,12,12,12,12,12,12,12,12,12,12,13,13,13,13,13,13,13,13,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14

**C Call Receiver Max:** 10,10,10,10,9,9,9,9,8,8,8,8,9,9,9,9,11,11,11,11,11,11,11,11,14,14,14,14,15,15,15,15,16,16,16,16,15,15,15,15,14,14,14,14,14,14,14,14
