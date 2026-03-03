# PRD: Gercekci E-Ticaret Backend Cekirdegi

## 1. Overview
Bu proje, sadece urun listeleyen bir API yerine gercek dunyaya yakin bir e-ticaret backend cekirdegi uretir. Ana odak stok rezervasyonu, siparis/odeme akisi, webhook isleme, iade sureci ve concurrency guvenligidir.

## 2. Goals
- API tasarimi ve domain bazli backend mimarisi kurmak
- Oversell'i transaction + lock ile engellemek
- Async odeme/iade sureclerini queue worker ile isletmek
- Webhook idempotency ve signature dogrulama uygulamak
- Test edilebilir, genisletilebilir bir temel olusturmak

## 3. Quality Gates
Her user story icin su komutlar gecmeli:
- `npm run typecheck`
- `npm run lint`
- `npm test`

Not: Bu asama backend odaklidir; browser/UI dogrulamasi zorunlu degildir.

## 4. User Stories

### US-001: Authentication
**Description:** As a user, I want JWT-based auth so that secure endpoints can be protected.

**Acceptance Criteria:**
- [ ] `register` ve `login` endpointleri calisir
- [ ] JWT icinde `sub` ve `role` claimleri bulunur
- [ ] Admin endpointleri role guard ile korunur

### US-002: Product Catalog
**Description:** As an admin/customer, I want to create and browse products so that catalog is usable.

**Acceptance Criteria:**
- [ ] Admin urun olusturabilir
- [ ] Herkes urun listeleyebilir
- [ ] Urun detay endpointi calisir

### US-003: Inventory Core
**Description:** As a system, I want `on_hand` and `reserved` stock fields so that reservation logic is possible.

**Acceptance Criteria:**
- [ ] Inventory modelinde `on_hand` ve `reserved` alanlari vardir
- [ ] `available = on_hand - reserved` olarak hesaplanir
- [ ] Negatif stok degerleri engellenir

### US-004: Cart
**Description:** As a customer, I want to manage cart items so that checkout can start.

**Acceptance Criteria:**
- [ ] Sepete urun ekleme calisir
- [ ] Adet guncelleme calisir
- [ ] Urun sepetten silme calisir
- [ ] Sepet yalnizca sahibine aciktir

### US-005: Checkout Transaction
**Description:** As a customer, I want checkout to reserve stock atomically so that oversell does not happen.

**Acceptance Criteria:**
- [ ] Checkout tek DB transaction icinde calisir
- [ ] Stok satirlari lock edilir (`SELECT ... FOR UPDATE` stratejisi)
- [ ] Yetersiz stokta rollback olur
- [ ] Basarili checkout'ta order + order items olusur

### US-006: Payment Attempt + Queue
**Description:** As a system, I want async payment attempt processing so that payment simulation is realistic.

**Acceptance Criteria:**
- [ ] `PaymentAttempt` kaydi `PENDING` olarak olusur
- [ ] BullMQ queue'ya `payment.process` job'u eklenir
- [ ] Worker sonucu success/fail olarak uretilir

### US-007: Payment Webhook Handling
**Description:** As a system, I want secure webhook processing so that payment result updates are safe and idempotent.

**Acceptance Criteria:**
- [ ] Webhook signature dogrulanir
- [ ] Event idempotent islenir (duplicate engellenir)
- [ ] `payment.succeeded` order'i `PAID` yapar
- [ ] `payment.failed` order'i `PAYMENT_FAILED` yapar ve rezervi birakir

### US-008: Refund Flow
**Description:** As a user/system, I want refund requests to be processed asynchronously so that refund lifecycle is realistic.

**Acceptance Criteria:**
- [ ] Refund request olusturulur
- [ ] `refund.process` job'u queue'ya eklenir
- [ ] Worker sonucu ile order/refund status guncellenir

### US-009: Concurrency Tests
**Description:** As a developer, I want concurrency coverage so that stock race conditions are prevented.

**Acceptance Criteria:**
- [ ] Ayni urun icin paralel checkout testleri vardir
- [ ] Toplam satilan adet `on_hand` degerini asmaz
- [ ] Beklenen hata kodlari deterministic doner

## 5. Functional Requirements
- FR-1: Sistem JWT auth ve role-based authorization saglamalidir.
- FR-2: Checkout atomik transaction ile calismalidir.
- FR-3: Stock reservation lock mekanizmasi olmadan yapilmamalidir.
- FR-4: Payment ve refund surecleri queue worker ile async islenmelidir.
- FR-5: Webhook endpoint idempotent ve imza dogrulamali olmalidir.
- FR-6: Payment fail durumunda reserved stock release edilmelidir.

## 6. Non-Goals
- Multi-tenant marketplace
- Multi-currency
- Gelismis kampanya/kupon motoru
- ERP/muhasebe entegrasyonlari
- Gercek odeme saglayicisi ile canli entegrasyon

## 7. Technical Considerations
- Mimari: `NestJS modular monolith`
- Veritabani: `PostgreSQL + Prisma`
- Queue: `Redis + BullMQ`
- Auth: `JWT`
- Container: `Docker`
- Cekirdek tablolar: `users`, `products`, `inventory`, `carts`, `cart_items`, `orders`, `order_items`, `payment_attempts`, `refund_requests`, `webhook_events_processed`

## 8. Success Metrics
- Oversell olaylari: `0`
- Webhook duplicate side-effect: `0`
- Kritik test gecis orani: `%100`
- Checkout ve payment/refund akislari deterministic olarak tekrar edilebilir

## 9. Assumptions
- Greenfield baslangic
- Tek para birimi (`TRY`)
- Tek depo/tek stock pool
- Backend-first yaklasim

