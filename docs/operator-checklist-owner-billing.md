# Operator Checklist: Owner Billing

Use this checklist when supporting the owner account access fee model.

## Model Explanation

"Tenants pay rent only. Owners pay a separate ATouPay access fee."

The owner access fee is currently 10 EUR every 42 days with a 7-day grace period. It controls owner management access only. It does not change tenant rent obligations or tenant receipt access.

## Check Owner Billing Status

1. Open the agency owner management screen.
2. Find the owner profile.
3. Check the owner billing status, active-until date, next payment due date, and latest owner billing invoice status.
4. If needed, verify the backend summary with `GET /v1/agency/owners/billing`.

Status guide:

- `active`: owner can manage properties, units, and tenant invites.
- `grace_period`: owner access period is overdue but still inside the grace period.
- `past_due`: owner should be read-only for new property/unit/invite creation until payment is recorded.
- `suspended`: owner management actions are blocked until agency review/reactivation.

## Manually Mark Owner Fee As Paid

Use manual mark-paid only when the agency has independently confirmed the owner access fee payment.

1. Confirm the payer is the owner/landowner, not a tenant.
2. Confirm the payment is for owner account access, not rent.
3. Record the payment through the agency owner billing action.
4. Add a short note with the confirmation source.
5. Verify the owner account active-until date extended by 42 days.

## When To Suspend An Owner

Suspend an owner when:

- agency policy requires manual access blocking
- payment status is disputed or cannot be confirmed
- account ownership or authorization is under review
- the owner should not create new properties, units, or tenant invites

Suspension must not block existing tenants from paying rent, viewing receipts, or contacting support.

## When To Reactivate An Owner

Reactivate an owner when:

- the agency has resolved the suspension reason
- ownership and authorization are valid
- payment/account status has been reviewed

Reactivation must not grant free access if the paid period is expired. If the paid period is expired, the owner should return to `past_due` or `grace_period` based on dates.

## What Not To Tell Tenants

- Do not tell tenants they owe an ATouPay access fee.
- Do not tell tenants their rent includes an owner access fee.
- Do not tell tenants rent is split for agency commission.
- Do not tell tenants owner billing affects their rent receipt access.

## What Not To Write On Rent Receipts

Rent receipts must not mention:

- owner account access fee
- owner subscription
- agency commission
- agency fee
- platform fee
- owner net after commission

Rent receipts should describe rent paid for the rental period only.

## Pilot Notes

For pilot operations, agency manual confirmation is acceptable only as an internal process. Do not present manual confirmation as a live provider integration, automated debit, mobile-money charge, card charge, or settlement.
