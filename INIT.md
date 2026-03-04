# INIT.md

Bu dosya, projeyi ilk kez ayaga kaldirmak icin minimum baslangic adimlarini tanimlar.

## 0) Calisma Kurallari (Zorunlu)
- Klasor yapisi temiz, anlasilir ve domain bazli tutulacak.
- Surec boyunca duzenli ara rapor verilecek (hangi adim yapildi, sirada ne var).
- Her kod degisikliginde ilgili dosyalar ve gerekiyorsa dokumantasyon guncellenecek.
- Yapilan her adimda "neden yapildi" ve "nasil yapildi" acik ve detayli anlatilacak.
- Proje implementasyonuna, kullanici acik onay vermeden baslanmayacak.

## 0.1) Guncel Durum (2026-03-02)
- Tamamlanan: temel altyapi, Prisma veri modeli, Auth, Product, Inventory, Cart, Checkout(Order), PaymentAttempt, Webhook, Refund, Worker.
- Tamamlanan kalite kontrolleri:
  - Backend: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
  - Frontend: `cd frontend && npm run lint`, `cd frontend && npm run build`
- Canli dogrulama yapildi:
  - Health endpoint: `GET /health` (DB + Redis + queue kontrolu yesil)
  - Swagger: `http://localhost:3000/docs` ayakta
  - Uc uca akis test edildi: login -> urun -> sepet -> checkout -> payment attempt -> order status guncelleme
- Sonraki odak: backend icin ek entegrasyon testlerini yazip CI seviyesinde zorunlu hale getirmek.

## 1) Gereksinimler
- Node.js 20.19+ (Vite 7 icin)
- Docker ve Docker Compose
- npm

## 2) Proje Kurulumu
```bash
npm install
```

## 3) Ortam Degiskenleri
Kok dizinde `.env` olustur:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce?schema=public
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/ecommerce_test?schema=public

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=dev-secret
JWT_EXPIRES_IN=1d

WEBHOOK_SIGNATURE_SECRET=local-webhook-secret
API_BASE_URL=http://localhost:3000
FRONTEND_ORIGIN=http://localhost:5173
```

## 4) Altyapi Servisleri (Docker)
`docker/docker-compose.yml` dosyasini olusturup PostgreSQL + Redis calistir:

```bash
docker compose -f docker/docker-compose.yml up -d
```

## 5) Prisma
```bash
npm run prisma:generate
npm run prisma:migrate
```

## 6) Uygulamayi Calistirma
API:
```bash
npm run start:dev
```

Worker:
```bash
npm run start:worker:dev
```

## 7) Kalite Kapilari
```bash
npm run typecheck
npm run lint
npm test
npm run test:integration
```

Concurrency stress testi:
```bash
npm run test:concurrency
```

## 8) Sonraki Adim (Onay Sonrasi)
- Kullanici onay verdikten sonra `prd.md` dosyasindaki user story sirasina gore implementasyona gec.
- Her story sonunda kalite kapilarini calistir.

## 9) Full Stack Calistirma (Docker)
API + Worker + PostgreSQL + Redis tek komutta:

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

Migration:
```bash
docker compose -f docker/docker-compose.yml exec api npm run prisma:deploy
```

Seed:
```bash
docker compose -f docker/docker-compose.yml exec api npm run prisma:seed:prod
```

Dokumantasyon:
- Swagger UI: `http://localhost:3000/docs`
- Adim adim akis: `docs/backend-flow.md`

## 10) Frontend (React + Vite)
```bash
cd frontend
cp -n .env.example .env
npm install
npm run dev
```

Varsayilan adres:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

Frontend kapsami:
- Login/Register
- Product list + product detail
- Cart + checkout + payment attempt
- Orders + auto polling (pending payment durumunda)
- Refund request
- Admin product create + inventory adjust

Frontend e2e smoke:
```bash
cd frontend
npm run e2e
```
Kapsam:
- Musteri yolu: register/login -> urun -> sepet -> checkout -> deterministic webhook -> order status
- Odeme hata/tekrar yolu: payment.failed -> retry payment -> payment.succeeded
- Admin yolu: login -> urun olusturma -> stok artirma -> UI + API dogrulama
CI notu:
- Frontend smoke job'inda backend `npm run build && npm run start` ile,
  frontend ise `npm run build && npm run preview` ile calistirilir (watch/dev yerine daha stabil).
- CI hiz notu:
  - backend ve frontend-smoke job'lari paralel calisir.
  - Ayni branch'te yeni push gelirse eski CI kosusu iptal edilir.
  - Playwright browser indirimi cache ile tekrarli kosularda hizlanir.

## 11) Nerede Kaldik? (Checkpoint)
Bu bolum "projede en son nerede oldugumuzu" tek bakista anlamak icin tutulur.

- Backend durumu: Profesyonel seviyede calisir durumda (moduler yapi, transaction, concurrency kontrolu, async worker, webhook akis).
- Frontend durumu: API'ye bagli calisir durumda (kullanici ve admin akislarinin tamami mevcut).
- Guvenlik notu: Admin self-register kapatildi; register her zaman `CUSTOMER` aciyor.
- Hata yonetimi notu: Prisma hata kodlari HTTP seviyesinde anlamli kodlara maplendi (`P2002`, `P2025`, `P2003`).
- CORS notu: `FRONTEND_ORIGIN` ile frontend-backend baglantisi ortama gore kontrol edilir.
- Concurrency notu: Paralel checkout testinde oversell engeli dogrulandi (basarili checkout sayisi baslangic stokunu asmiyor).
- Docker notu:
  - Build ortami olarak BuildKit sorunu yasandiginda su alternatif calisir:
    - `DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 docker compose -f docker/docker-compose.yml up --build -d`
  - Container start komutlari `dist/src/main.js` ve `dist/src/worker.js` ile hizalandi.
  - Container icinde seed icin: `npm run prisma:seed:prod`

## 12) Sonraki Teknik Adim (Net)
- 1. Backend entegrasyon testlerini genislet: (Tamamlandi)
  - checkout + stok rezervasyonunun rollback senaryolari
  - payment webhook idempotency senaryolari
  - refund akisinin order state gecisleri
- 2. Ardindan frontend icin e2e smoke test ekle (kritik user journey): (Tamamlandi)
  - register/login
  - urun -> sepet -> checkout -> payment sonucu
  - order listesinde durumun gorunmesi
