# Tax Rates

Adds simple CRUD for tax rates at:

```text
/backoffice/tax-rates
```

Rates are entered as percentages in the UI. Example: enter `7.75` for 7.75%.

The database stores rates as decimals. Example: `0.0775`.

Current scope:

- state
- county
- optional city
- optional postal code
- rate
- effective start/end dates
- active flag

The migration seeds a default GA rate of 0% so invoice code has a safe fallback until real rates are entered.

Future invoice calculation should copy the chosen rate onto the invoice record so historical invoices do not change when tax rates change.
