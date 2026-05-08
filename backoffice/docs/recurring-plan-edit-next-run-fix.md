# Recurring Plan Edit Next Run Fix

When a recurring service plan has already generated work orders, editing the cadence now recalculates `next_run_date` from the most recent generated run if the user did not manually change the next run date.

Example:

- Plan was weekly
- Last generated run was `2026-05-07`
- Existing next run was `2026-05-14`
- User edits frequency to monthly and leaves Next Run Date unchanged
- System updates next run to `2026-06-07`

If the user explicitly changes the Next Run Date field during edit, the system respects that manual value.
