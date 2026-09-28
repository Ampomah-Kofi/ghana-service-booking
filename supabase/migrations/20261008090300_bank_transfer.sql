-- Customers can also pay by bank transfer where the provider offers it (checkout: Mobile Money ·
-- card · bank transfer · or just book and pay at the visit).
alter type public.payment_method add value if not exists 'bank_transfer';
