/**
 * M-Pesa Integration Module
 * 
 * This module handles M-Pesa payment integration for CoreShare,
 * allowing payments for GPU rentals using Safaricom's M-Pesa mobile money service.
 */
import axios from 'axios';
import { z } from 'zod';

// M-Pesa API URLs - use sandbox for testing, switch to production for live
// Documentation: https://developer.safaricom.co.ke/apis-explorer
const MPESA_AUTH_URL = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const MPESA_STK_PUSH_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
const MPESA_TRANSACTION_STATUS_URL = 'https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query';

// Check for required configuration
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '174379'; // Default sandbox shortcode
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;

// Get the current Replit domain for callback URL
const REPLIT_DOMAIN = process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(',')[0] : 'localhost:5000';
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || `https://${REPLIT_DOMAIN}/api/callback/mpesa`;

// Test mode for development - set to false to send real payment requests
const TEST_MODE = process.env.NODE_ENV !== 'production';
// const TEST_MODE = false; // Only use in production with valid M-Pesa credentials

// Input validation schemas
export const stkPushRequestSchema = z.object({
  phoneNumber: z.string().min(10).max(12), // Format: 254XXXXXXXXX (without + sign)
  amount: z.number().min(1),
  accountReference: z.string(), // Usually the rental ID or order ID
  transactionDesc: z.string().optional().default('GPU Rental Payment')
});

export type StkPushRequest = z.infer<typeof stkPushRequestSchema>;

// Error handling
class MPesaError extends Error {
  code: string;
  
  constructor(message: string, code: string = 'MPESA_ERROR') {
    super(message);
    this.name = 'MPesaError';
    this.code = code;
  }
}

/**
 * Get M-Pesa API access token
 * Access tokens are valid for 1 hour, so this should be cached
 */
export async function getMPesaAccessToken(): Promise<string> {
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    throw new MPesaError('M-Pesa API credentials not configured', 'CONFIG_ERROR');
  }
  
  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    
    const response = await axios.get(MPESA_AUTH_URL, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    if (response.data && response.data.access_token) {
      return response.data.access_token;
    } else {
      throw new MPesaError('Failed to obtain access token');
    }
  } catch (error: any) {
    console.error('M-Pesa auth error:', error.response?.data || error.message);
    throw new MPesaError('Authentication failed: ' + (error.response?.data?.errorMessage || error.message));
  }
}

/**
 * Generate timestamp for M-Pesa API
 * Format: YYYYMMDDHHmmss
 */
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Generate the password for M-Pesa API
 * Format: Shortcode + Passkey + Timestamp
 */
function generatePassword(timestamp: string): string {
  if (!MPESA_SHORTCODE || !MPESA_PASSKEY) {
    throw new MPesaError('M-Pesa shortcode or passkey not configured', 'CONFIG_ERROR');
  }
  
  const data = `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`;
  return Buffer.from(data).toString('base64');
}

/**
 * Initiate STK Push to customer's phone
 * This sends a payment prompt to the customer's phone
 */
export async function initiateSTKPush(data: StkPushRequest): Promise<any> {
  try {
    const validation = stkPushRequestSchema.safeParse(data);
    if (!validation.success) {
      throw new MPesaError('Invalid payment data: ' + JSON.stringify(validation.error.format()));
    }
    
    // If in test mode, return mock successful response
    if (TEST_MODE) {
      console.log('M-Pesa TEST MODE - Simulating successful payment initiation');
      return {
        CheckoutRequestID: `test-${Date.now()}`,
        MerchantRequestID: `test-${Math.random().toString(36).substring(2, 15)}`,
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        CustomerMessage: 'Success. Request accepted for processing'
      };
    }
    
    // Real M-Pesa integration
    const accessToken = await getMPesaAccessToken();
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);
    
    const requestBody = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(data.amount), // M-Pesa requires integer amounts
      PartyA: data.phoneNumber,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: data.phoneNumber,
      CallBackURL: CALLBACK_URL,
      AccountReference: data.accountReference,
      TransactionDesc: data.transactionDesc
    };
    
    const response = await axios.post(MPESA_STK_PUSH_URL, requestBody, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('M-Pesa STK push error:', error.response?.data || error.message);
    throw new MPesaError('Payment initiation failed: ' + (error.response?.data?.errorMessage || error.message));
  }
}

/**
 * Check transaction status
 * Use this to verify if a transaction was completed
 */
export async function checkTransactionStatus(checkoutRequestId: string): Promise<any> {
  try {
    // If in test mode, check if it's a test checkout ID and return a mock response
    if (TEST_MODE && checkoutRequestId.startsWith('test-')) {
      console.log('M-Pesa TEST MODE - Simulating successful payment status check');
      // If the checkout request ID is older than 10 seconds, consider it "paid"
      const timestamp = parseInt(checkoutRequestId.split('-')[1]);
      const tenSecondsAgo = Date.now() - 10000;
      const isPaid = timestamp < tenSecondsAgo;

      return {
        ResponseCode: '0',
        ResponseDescription: 'Success',
        MerchantRequestID: `test-${Math.random().toString(36).substring(2, 15)}`,
        CheckoutRequestID: checkoutRequestId,
        ResultCode: isPaid ? '0' : '1',
        ResultDesc: isPaid ? 'The transaction is completed successfully' : 'Transaction is in progress'
      };
    }
    
    // Real M-Pesa integration
    const accessToken = await getMPesaAccessToken();
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);
    
    const requestBody = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    };
    
    const response = await axios.post(MPESA_TRANSACTION_STATUS_URL, requestBody, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('M-Pesa transaction status error:', error.response?.data || error.message);
    throw new MPesaError('Transaction status check failed: ' + (error.response?.data?.errorMessage || error.message));
  }
}

/**
 * Process M-Pesa callback
 * This handles the callback from M-Pesa after a payment is completed or fails
 */
export function processMPesaCallback(callbackData: any): {
  success: boolean;
  transactionId?: string;
  amount?: number;
  phoneNumber?: string;
  resultDesc?: string;
} {
  try {
    // Handle test mode callbacks (usually triggered manually)
    if (TEST_MODE && callbackData.testMode === true) {
      console.log('M-Pesa TEST MODE - Processing manual callback');
      return {
        success: true,
        transactionId: `TEST-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        amount: callbackData.amount || 100,
        phoneNumber: callbackData.phoneNumber || '254712345678',
        resultDesc: 'Test transaction completed successfully'
      };
    }
    
    // Regular callback handling
    const body = callbackData.Body;
    
    if (!body || !body.stkCallback) {
      return { success: false, resultDesc: 'Invalid callback data' };
    }
    
    const { ResultCode, ResultDesc, CallbackMetadata } = body.stkCallback;
    
    // Special handling for test checkout IDs
    if (TEST_MODE && body.stkCallback.CheckoutRequestID?.startsWith('test-')) {
      console.log('M-Pesa TEST MODE - Processing automated callback for test request');
      const checkoutRequestId = body.stkCallback.CheckoutRequestID;
      const timestamp = parseInt(checkoutRequestId.split('-')[1]);
      const tenSecondsAgo = Date.now() - 10000;
      const isPaid = timestamp < tenSecondsAgo;
      
      if (isPaid) {
        return {
          success: true,
          transactionId: `TEST-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          amount: 100,
          phoneNumber: '254712345678',
          resultDesc: 'Test transaction completed successfully'
        };
      } else {
        return {
          success: false,
          resultDesc: 'Test transaction is still pending'
        };
      }
    }
    
    if (ResultCode === 0) {
      // Transaction was successful
      let transactionId = '';
      let amount = 0;
      let phoneNumber = '';
      
      if (CallbackMetadata && CallbackMetadata.Item) {
        CallbackMetadata.Item.forEach((item: any) => {
          if (item.Name === 'MpesaReceiptNumber') transactionId = item.Value;
          if (item.Name === 'Amount') amount = item.Value;
          if (item.Name === 'PhoneNumber') phoneNumber = item.Value.toString();
        });
      }
      
      return {
        success: true,
        transactionId,
        amount,
        phoneNumber,
        resultDesc: ResultDesc
      };
    } else {
      // Transaction failed
      return {
        success: false,
        resultDesc: ResultDesc
      };
    }
  } catch (error: any) {
    console.error('Error processing M-Pesa callback:', error);
    return {
      success: false,
      resultDesc: 'Error processing callback: ' + error.message
    };
  }
}