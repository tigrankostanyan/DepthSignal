// MANUAL QR PAYMENT CONFIGURATION
// Driven entirely by environment variables so the operator can point the
// payment QR at any receiving link/address without code changes.

export interface ManualPaymentConfig {
  enabled: boolean;
  method: 'qr_link' | 'static_image';
  // QR payload — a payment link or wallet address scanned on the phone.
  qrValue: string;
  // Optional static QR image override (falls back to generating from qrValue).
  qrImageUrl?: string;
  // Display helpers shown next to the QR / in the transfer instructions.
  recipientName?: string;
  network?: string;
  currency: string;
  instructions: string[];
}

// Build the manual payment config from environment.
export function getManualPaymentConfig(): ManualPaymentConfig {
  const qrValue = (process.env.MANUAL_PAYMENT_QR_VALUE || '').trim();
  const qrImageUrl = (process.env.MANUAL_PAYMENT_QR_IMAGE_URL || '').trim() || undefined;
  const instructionsRaw = (process.env.MANUAL_PAYMENT_INSTRUCTIONS || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    enabled: Boolean(qrValue || qrImageUrl),
    method: qrImageUrl ? 'static_image' : 'qr_link',
    qrValue,
    qrImageUrl,
    recipientName: process.env.MANUAL_PAYMENT_RECIPIENT || undefined,
    network: process.env.MANUAL_PAYMENT_NETWORK || undefined,
    currency: 'USD',
    instructions:
      instructionsRaw.length > 0
        ? instructionsRaw
        : [
            'Scan the QR code with your banking / crypto app.',
            'Transfer the exact plan amount shown above.',
            'Take a clear screenshot of the successful transfer.',
            'Attach it below so our team can verify and activate your plan.',
          ],
  };
}
