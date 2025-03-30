import Stripe from 'stripe';

// Initialize Stripe with the secret key
// We'll use a placeholder key for now, but this should be replaced with the real key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
export const stripe = new Stripe(stripeSecretKey);

// Calculate the amount in cents for Stripe (Stripe uses smallest currency unit)
export function calculateAmountInCents(amount: number): number {
  return Math.round(amount * 100);
}

// Create a payment intent
export async function createPaymentIntent(amount: number, metadata?: Record<string, string>): Promise<Stripe.PaymentIntent> {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: calculateAmountInCents(amount),
      currency: 'usd',
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    return paymentIntent;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}

// Confirm a payment intent
export async function confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('Error confirming payment intent:', error);
    throw error;
  }
}

// Create a customer in Stripe
export async function createCustomer(email: string, name: string): Promise<Stripe.Customer> {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
    });
    
    return customer;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
}