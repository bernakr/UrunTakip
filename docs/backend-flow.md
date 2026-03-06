# Backend Flow Walkthrough

Bu dokuman, backend akisini adim adim test etmek ve her adimin amacini gormek icin hazirlandi.

## 0) Baslangic
Sunlari calistir:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run start:dev
```

Ayrica worker:

```bash
npm run start:worker:dev
```

## 1) Register / Login
Amaç: JWT alip korumali endpointleri test etmek.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin1234!"}'
```

Donen `accessToken` degerini `ADMIN_TOKEN` olarak sakla.

Not:
- `POST /api/auth/register` her zaman `CUSTOMER` rolunde hesap acar.
- Admin hesaplari seed veya manuel DB islemleriyle uretilir.

## 1.1) Refresh Token
Amaç: Access token yenileme ve oturum rotasyonu.

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "content-type: application/json" \
  -d '{"refreshToken":"REFRESH_TOKEN"}'
```

## 1.2) Forgot / Reset Password
Amaç: sifre unutma ve sifre yenileme akisini dogrulamak.

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "content-type: application/json" \
  -d '{"email":"customer@example.com"}'
```

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "content-type: application/json" \
  -d '{"token":"RESET_TOKEN","newPassword":"NewCustomer1234!"}'
```

## 2) Urun Olustur (Admin)
Amaç: Catalog + Inventory temel verisi olusturmak.

```bash
curl -X POST http://localhost:3000/api/products \
  -H "content-type: application/json" \
  -H "authorization: Bearer ADMIN_TOKEN" \
  -d '{"sku":"SKU-NEW-001","name":"New Product","price":15900,"initialStock":25}'
```

Urun listelemede arama/siralama/sayfalama:

```bash
curl "http://localhost:3000/api/products?q=hoodie&sort=price_desc&page=1&limit=10"
```

## 3) Musteri Login
Amaç: Customer akislarini dogru rol ile test etmek.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"customer@example.com","password":"Customer1234!"}'
```

Donen tokeni `CUSTOMER_TOKEN` olarak sakla.

## 4) Sepete Ekle
Amaç: Cart domain calisiyor mu kontrol etmek.

```bash
curl -X POST http://localhost:3000/api/cart/items \
  -H "content-type: application/json" \
  -H "authorization: Bearer CUSTOMER_TOKEN" \
  -d '{"productId":"PRODUCT_ID","quantity":2}'
```

## 5) Checkout
Amaç: Transaction + stock reservation + order creation.

```bash
curl -X POST http://localhost:3000/api/orders/checkout \
  -H "content-type: application/json" \
  -H "authorization: Bearer CUSTOMER_TOKEN" \
  -d '{}'
```

Donen `orderId` degerini not al.

## 6) Payment Attempt
Amaç: Async payment akisini queue'ya gondermek.

```bash
curl -X POST http://localhost:3000/api/payments/attempts \
  -H "content-type: application/json" \
  -H "authorization: Bearer CUSTOMER_TOKEN" \
  -d '{"orderId":"ORDER_ID","idempotencyKey":"idem-001-order-ORDER_ID"}'
```

Bu adimdan sonra worker webhook gonderir; siparis statusu `PAID` veya `PAYMENT_FAILED` olur.

## 7) Siparisi Kontrol Et
Amaç: Payment webhook sonucu order state degisimini dogrulamak.

```bash
curl -X GET http://localhost:3000/api/orders/ORDER_ID \
  -H "authorization: Bearer CUSTOMER_TOKEN"
```

## 8) Iade Baslat (PAID ise)
Amaç: Refund async akisini test etmek.

```bash
curl -X POST http://localhost:3000/api/refunds \
  -H "content-type: application/json" \
  -H "authorization: Bearer CUSTOMER_TOKEN" \
  -d '{"orderId":"ORDER_ID","amount":1000,"idempotencyKey":"refund-001-ORDER_ID"}'
```

## 8.1) Siparis Iptal + Timeline
Amaç: Odenmemis siparisi iptal etmek ve event timeline'i gormek.

```bash
curl -X POST http://localhost:3000/api/orders/ORDER_ID/cancel \
  -H "authorization: Bearer CUSTOMER_TOKEN"
```

```bash
curl -X GET http://localhost:3000/api/orders/ORDER_ID/timeline \
  -H "authorization: Bearer CUSTOMER_TOKEN"
```

## 9) Health + Docs
Amaç: Operasyonel gorunurluk ve API contract.

```bash
curl http://localhost:3000/api/health
```

Swagger:
- `http://localhost:3000/docs`

## 10) Concurrency Stress Test
Amaç: parallel checkout altinda oversell olmadigini kanitlamak.

```bash
npm run test:concurrency
```

Beklenti:
- `Checkout success <= initialStock`
- `available + reserved == initialStock`
- Fazla istekler deterministik olarak `Insufficient stock ...` hatasi alir.
