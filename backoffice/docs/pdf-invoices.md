# PDF Invoice Generation

Customer invoice emails now include an attached PDF invoice. The public payment landing page can stay stylized for web payment conversion, but the PDF is generated separately so it can match the printed/emailed invoice expectations.

## Routes

- Backoffice PDF: `/backoffice/billing/invoices/:id/pdf`
- Public PDF: `/pay/i/:token/pdf`

## Email behavior

When an invoice is submitted, the customer notification email includes:

- the secure payment link
- a PDF invoice attachment

The attachment is generated at send time from the current invoice snapshot.

## Theme selection

Theme is selected from the invoice work order service line:

- `pools` -> Spring Water-style pool invoice
- anything else / `garage_doors` -> Alliance Garage Doors invoice

## Implementation notes

- PDF rendering lives in `modules/invoices/pdf.js`.
- Billing calls the PDF renderer from `modules/billing/service.js`.
- `modules/notifications/service.js` now supports nodemailer attachments.
- The payment portal view remains web-styled and points to the downloadable PDF.

## Dependency

PDF creation uses `pdfkit`.

Run:

```bash
npm install
```

before starting the app after pulling this update.
