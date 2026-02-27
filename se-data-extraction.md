# ScheduleExpress Data Extraction

**Site:** https://schedulexpress.com (SSO login via Valleycom)
**Purpose:** Extract exact coverage minimum values for hours 18:00-23:30 that were cut off in our previous screenshot, plus any other reference data we need.

---

## Task 1: Coverage Day View — Full Min Values (18:00-23:30)

1. Navigate to the **Coverage Grid Day View** (`coverageGridView.do?view=day`)
2. Select date: **Tuesday, February 24, 2026** (or any Tuesday — the min requirements should be the same across Tuesdays)
3. The page shows half-hour columns from 00 through 23:30. We already have 00:00-17:30 from a previous screenshot. **Scroll right** to see hours 18-23.
4. For each of the three job categories below, read the **Min** row values for every half-hour slot from **18:00 through 23:30** (12 slots):

### C Call Receiver (= our COI)

Record the Min value for each slot:
| 18:00 | 18:30 | 19:00 | 19:30 | 20:00 | 20:30 | 21:00 | 21:30 | 22:00 | 22:30 | 23:00 | 23:30 |
|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |

Also record the **Max** row for the same slots:
| 18:00 | 18:30 | 19:00 | 19:30 | 20:00 | 20:30 | 21:00 | 21:30 | 22:00 | 22:30 | 23:00 | 23:30 |
|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |

### B Dispatcher (= our COII)

Record Min:
| 18:00 | 18:30 | 19:00 | 19:30 | 20:00 | 20:30 | 21:00 | 21:30 | 22:00 | 22:30 | 23:00 | 23:30 |
|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |

Also record Max:
| 18:00 | 18:30 | 19:00 | 19:30 | 20:00 | 20:30 | 21:00 | 21:30 | 22:00 | 22:30 | 23:00 | 23:30 |
|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |

### A Supervisor (= our SUP)

Record Min:
| 18:00 | 18:30 | 19:00 | 19:30 | 20:00 | 20:30 | 21:00 | 21:30 | 22:00 | 22:30 | 23:00 | 23:30 |
|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |

Also record Max:
| 18:00 | 18:30 | 19:00 | 19:30 | 20:00 | 20:30 | 21:00 | 21:30 | 22:00 | 22:30 | 23:00 | 23:30 |
|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |

---

## Task 2: Verify the 00:00-17:30 Values We Already Have

While you're there, also confirm the **Min** values for 00:00-17:30 match what we recorded. Here's what we have — flag any that are wrong:

### C Call Receiver Min (00:00-17:30):
| 00 | 30 | 01 | 30 | 02 | 30 | 03 | 30 | 04 | 30 | 05 | 30 | 06 | 30 | 07 | 30 | 08 | 30 | 09 | 30 | 10 | 30 | 11 | 30 | 12 | 30 | 13 | 30 | 14 | 30 | 15 | 30 | 16 | 30 | 17 | 30 |
|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|-----|
| 7  | 7  | 7  | 7  | 6  | 6  | 6  | 5  | 5  | 5  | 5  | 6  | 6  | 6  | 6  | 6  | 8  | 8  | 8  | 8  | 8  | 8  | 8  | 8  | 11 | 11 | 11 | 11 | 12 | 12 | 12 | 12 | 13 | 13 | 13 | 13 |

### B Dispatcher Min (00:00-17:30):
| 00 | 30 | 01 | 30 | 02 | 30 | 03 | 30 | 04 | 30 | 05 | 30 | 06 | 30 | 07 | 30 | 08 | 30 | 09 | 30 | 10 | 30 | 11 | 30 | 12 | 30 | 13 | 30 | 14 | 30 | 15 | 30 | 16 | 30 | 17 | 30 |
|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|-----|
| 10 | 10 | 10 | 10 | 9  | 9  | 9  | 9  | 9  | 9  | 9  | 9  | 9  | 9  | 9  | 9  | 10 | 10 | 10 | 10 | 10 | 10 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |

### A Supervisor Min (00:00-17:30):
| 00 | 30 | 01 | 30 | 02 | 30 | 03 | 30 | 04 | 30 | 05 | 30 | 06 | 30 | 07 | 30 | 08 | 30 | 09 | 30 | 10 | 30 | 11 | 30 | 12 | 30 | 13 | 30 | 14 | 30 | 15 | 30 | 16 | 30 | 17 | 30 |
|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|-----|
| 1  | 1  | 1  | 1  | 1  | 1  | 1  | 1  | 1  | 1  | 1  | 1  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  | 2  |

**Flag any corrections** — even 1 slot being off matters since these are the actual staffing minimums.

---

## Task 3: Weekend Coverage Differences

Coverage requirements often differ on weekends. While on the coverage day view:

1. Switch to **Saturday** (e.g., Feb 28, 2026) and record the **Min** row for all 48 half-hour slots for all three classifications (C Call Receiver, B Dispatcher, A Supervisor)
2. Switch to **Sunday** (e.g., Mar 1, 2026) and do the same

If Saturday and Sunday have identical Min values, just note "Sat/Sun identical" and provide one set. If they differ from weekdays, provide the full tables.

This tells us whether we need per-day-of-week coverage plans or if weekdays are all the same and weekends are all the same.

---

## Task 4: Coverage Plan Name and Date Range

On the **Coverage Exceptions** page (`scheduleCoverageList.do`):

1. Find the entry for the **current active** coverage plan (should be "Communications 2026" covering approximately 03/01/2026 - 03/06/2027)
2. Record the exact:
   - Coverage Plan name
   - Start date
   - End date
3. Are there any other active/overlapping coverage plans?

---

## What to Report Back

Please provide:
1. **Task 1:** All Min and Max values for 18:00-23:30 for each classification (filled tables)
2. **Task 2:** "Confirmed" or a list of corrections to our 00:00-17:30 values
3. **Task 3:** Weekend Min values — same as weekday or different? If different, full tables.
4. **Task 4:** Active coverage plan name, start date, end date
