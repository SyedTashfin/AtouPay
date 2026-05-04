# Remove Rent Commission And Add Owner Billing

## Summary

ATouPay no longer treats agency revenue as a commission deducted from tenant rent. Tenant rent payments and owner account access fees are separate financial objects.

## New Rent Payment Rule

For every new rent payment:

- `rentAmount` equals the rent due
- `grossAmount` equals the rent due
- `tenantFeeAmount` is `0`
- `platformRentFeeAmount` is `0`
- `agencyFeeAmount` is `0`
- `commissionRate` is `0`
- `ownerNetAmount` equals the rent due
- `ownerReceivableAmount` equals the rent due

The legacy fields stay in documents for compatibility with existing screens, receipts, and historical data, but they are no longer business inputs for new rent payments.

## Owner Billing Records

Owner account access is stored separately:

- `ownerBillingAccounts/{ownerId}`
- `ownerBillingInvoices/{invoiceId}`
- `ownerBillingPayments/{billingPaymentId}`

The owner account fee is:

- amount: `10`
- currency: `EUR`
- interval: `42` days
- grace period: `7` days

Owner billing status controls owner management access. It must not block existing tenant access to rent payment, receipts, rental details, or support.

Real owner-fee payment provider integration is not enabled yet. The current MVP only supports simulated owner payment and agency manual mark-paid records. If a Mauritanian provider is selected later and it only supports MRU, the `10 EUR` owner fee may need to be charged as an approved MRU equivalent unless EUR support is confirmed.

## Backward Compatibility

Existing old simulated rent records may still contain non-zero `agencyFeeAmount`, `commissionRate`, and reduced `ownerNetAmount`. No destructive migration is required for the current MVP.

New records must set the legacy commission fields to zero. Historical records can remain as historical evidence unless a later reporting migration explicitly normalizes them.

## Migration Steps

1. Deploy the backend with owner billing collections and routes.
2. Deploy the app with owner billing UI and tenant rent fee wording.
3. Leave existing rent payment documents untouched.
4. Create `ownerBillingAccounts/{ownerId}` lazily when an owner activates access, opens billing, or performs a guarded owner operation.
5. Verify new tenant invite redemption creates zero-commission rent payments.
6. Verify owner account fee payments create owner billing invoices/payments, not rent payments or rent receipts.

## Rollback Note

Rollback should disable owner billing routes/UI and restore the previous build. Do not rewrite historical rent payment documents unless a separate reviewed migration plan exists.
