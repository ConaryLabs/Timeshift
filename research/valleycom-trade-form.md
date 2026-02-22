# Valleycom Shift Trade Form Fields

**Source:** ScheduleExpress form inspection (`tradeCreate.do`), Feb 2026

---

## Trade Create Form (`tradeCreateForm`)

POST to `tradeCreate.do`

| Field Name | Type | Notes |
|------------|------|-------|
| `tradeDate` | text | Date of the shift you want to trade away |
| `tradeTimeSlot[0].timeSlot` | text | Time slot of shift (indexed, suggesting multiple slots possible) |
| `tradeNote` | textarea | Note to potential trade partner |
| `partialRule` | hidden | Partial trade rule flag |
| `tradeShift` | hidden | Shift identifier |
| `tradeShiftVal` | hidden | Shift value |
| `tradeValidDate` | hidden | Validation date for the trade |
| `absenceRecordPk` | hidden | Linked absence record (if trade is absence-related) |
| `userIdString` | hidden | User ID |
| `groupIdString` | hidden | Group ID |
| `anyUser` | hidden | Whether any user can accept (not just specific person) |
| `locationPk` | hidden | Location PK |

---

## Key Observations

### Trade is for a specific shift slot
The employee selects a date and time slot they want to give away.
The `tradeTimeSlot[0].timeSlot` naming (indexed array) suggests you can offer multiple time slots in one trade request.

### Trade can be linked to an absence
`absenceRecordPk` field suggests trades can be initiated as part of an absence workflow —
e.g., "I need to be absent, here is my shift available for trade."

### `anyUser` flag
Suggests trades can be targeted at a specific person OR posted as open to anyone.

### `groupIdString`
Group-based targeting — trades may be limited to employees in the same work group.

---

## Trade Workflow (inferred)

1. Employee creates trade offer (this form) — specifies date, shift, note
2. Other employees see it in "View Available Trades" (`tradeAvailableList.do`)
3. Interested employee accepts
4. Supervisor approval likely required (standard for trades in dispatch centers)
5. Completed trades show in "My Trades" (`tradeView.do`) with `(TR)` badge on schedule

---

## Outstanding Questions

- [ ] Is supervisor approval required for trades at Valleycom?
- [ ] Are there deadline rules (how far in advance must a trade be posted)?
- [ ] Can you trade partial shifts?
- [ ] Is there a limit on how many open trades you can have at once?
- [ ] Do both employees need to be the same job classification for a trade to be valid?
