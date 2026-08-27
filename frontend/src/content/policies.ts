export const policies = {
  privacy:
    'Nexora stores account, address, and order data to fulfil purchases. We do not sell personal data. Passwords are hashed by Django. Payment confirmations are verified on the server; card numbers are never collected in this mock integration.',
  terms:
    'By creating an account you agree to provide accurate details, keep credentials private, and accept that prices, tax, and stock are determined by the Nexora backend at the time of checkout.',
  shipping:
    'Orders usually dispatch within 2 working days after payment is verified. Tracking appears on the order page. Shipping is free on every order.',
  returns:
    'Request a return from the order page within 7 days of delivery. Items must be unused and in original packing. Approved returns move the order to RETURNED and then refund processing.',
  refunds:
    'Refunds are issued to the original payment method after the warehouse confirms the return. Refund timing depends on the payment provider. In this demo, refunds are recorded as REFUNDED on the order.',
  cancellation:
    'You may cancel while the order is PENDING, CONFIRMED, PROCESSING, or PACKED. After shipment, cancellation is not available; use the return flow instead.',
}
