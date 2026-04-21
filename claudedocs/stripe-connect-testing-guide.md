# Stripe Connect Testing Guide

## Overview

Dyia uses **Stripe Express** connected accounts for the payments feature. The onboarding flow works differently from standard Stripe accounts — this guide explains exactly how to test it correctly.

---

## How the Flow Works

1. User clicks **"Connect Stripe"** in the Dyia Payments section
2. The app creates a new Express connected account via the Stripe API
3. The app generates an **Account Link** and redirects the user to `connect.stripe.com/setup/e/acct_...`
4. The user fills in their business/personal information on the Stripe-hosted form
5. After completing the form, Stripe redirects back to Dyia with a confirmation

> **Important**: `connect.stripe.com/setup/e/acct_...` is **not a login page**. It is an onboarding form for the newly created account. Do not attempt to sign in with an existing Stripe account — fill in the form fields as prompted.

---

## Test Data for Stripe Express Onboarding (Test Mode)

Use the following values when filling in the Stripe Express onboarding form:

| Field | Test Value | Notes |
|-------|-----------|-------|
| Email | Any email address | Does not need to be a real Stripe account |
| **Phone number** | `+1 (000) 000-0000` | Must use this exact number to receive test code |
| **SMS verification code** | `000 000` | Only works with the test phone above |
| First / Last name | Any name | |
| Date of birth | Any past date | e.g. `01/01/1990` |
| Home address | Any valid US address | e.g. `address_full_match` or any real-format address |
| SSN last 4 digits | `0000` | |
| **Bank routing number** | `110000000` | Stripe's test routing number |
| **Bank account number** | `000123456789` | Stripe's test account number |

### Common Mistakes

- **Using a real phone number** — Stripe will send a real SMS and `000 000` will not work as the code. You must use `+1 (000) 000-0000`.
- **Using real bank details** — Test mode will not accept real bank account numbers. Use `110000000` / `000123456789`.
- **Trying to log in** — The `connect.stripe.com/setup/e/acct_...` URL is a form, not a login screen. Entering credentials for an existing Stripe account will not work here.

---

## Dashboard Access (After Onboarding)

Once onboarding is complete, the user can access their Stripe Express dashboard via the **"Open Dashboard"** button in Dyia.

> **Note**: In test mode, direct login to the Stripe Express dashboard is not supported by Stripe. Dashboard access from Dyia works correctly because it uses **login links** (generated server-side via the Stripe API), not direct login.

---

## Expected Test Results

| Action | Expected Result |
|--------|----------------|
| Click "Connect Stripe" | Redirected to `connect.stripe.com/setup/e/acct_...` |
| Complete onboarding form with test data above | Redirected back to Dyia Payments page with success confirmation |
| Check account status in Dyia | Shows "Connected", charges enabled, payouts enabled |
| Click "Open Dashboard" | Opens Stripe Express dashboard in new tab |
| Create a payment request on a quote or job | Generates a shareable payment link |
| Open the payment link as a customer | Shows payment details page |
| Complete checkout with Stripe test card `4242 4242 4242 4242` | Payment recorded as paid in Dyia |

---

## Stripe Test Card for Payments

After onboarding, use this card to test the payment checkout flow:

| Field | Value |
|-------|-------|
| Card number | `4242 4242 4242 4242` |
| Expiry | Any future date |
| CVC | Any 3 digits |
| ZIP | Any 5 digits |

---

## Architecture Notes

- Stripe Express accounts are created server-side before the user sees the onboarding form
- Account links expire after a short period — if the tester navigates away and returns, a new link must be generated (click "Connect Stripe" again)
- Test mode and live mode are separate environments; test accounts cannot be used in live mode and vice versa
