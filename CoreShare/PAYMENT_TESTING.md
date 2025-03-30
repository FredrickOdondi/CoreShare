# CoreShare Payment Testing Guide

This guide explains how to test payment processing and income/expense reflection in the CoreShare platform.

## Overview

The CoreShare platform now has a streamlined rental process:
1. User selects a GPU to rent
2. Payment is required (status: requires_payment)
3. User makes payment through M-Pesa
4. System verifies payment
5. Rental becomes active (status: running)
6. Dashboard reflects payment for both renter and GPU owner

## Test Scripts

We have provided two test scripts to verify the payment flow:

1. `test-payment.mjs` - Tests basic payment processing
2. `test-payment-income.mjs` - Tests that payment amounts properly reflect on both renter and owner dashboards

## Running the Tests

To run the tests, make sure the CoreShare server is running, then execute:

```bash
# From the CoreShare directory
node test-payment.mjs
# or
node test-payment-income.mjs
```

## Test Expected Behavior

The tests verify:
1. Payment processing works correctly
2. Rental status changes from "requires_payment" to "running" after successful payment
3. Payment amount is properly reflected for both the renter (as an expense) and the GPU owner (as income)
4. The amounts match on both sides of the transaction

## Test Mode

The tests operate in "test mode," which means:
1. No actual M-Pesa payment is processed
2. The M-Pesa callback is simulated through `/api/test/mpesa-callback`
3. Rental status is updated just as it would be with a real payment

## Manual Testing

You can also test manually by:
1. Creating a new GPU rental
2. Using the "Force Complete Payment" button (test mode only)
3. Verifying the rental status changes to "running"
4. Checking the dashboard to ensure payment amounts appear correctly

## Troubleshooting

If tests fail, check:
1. Server logs for any errors
2. Database connection
3. Rental ID used in the test (it must exist in the database)
4. API authentication (if applicable)

## Notes for Production

In production:
1. Test mode will be disabled
2. Real M-Pesa payments will be processed
3. The M-Pesa callback URL must be publicly accessible
4. The system will verify real payment callbacks from the M-Pesa API