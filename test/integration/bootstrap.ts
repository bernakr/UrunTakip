import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../../src/common/middleware/request-id.middleware";
import { PrismaService } from "../../src/common/prisma/prisma.service";
import { QueueService } from "../../src/queue/queue.service";
import { PaymentJobData, RefundJobData } from "../../src/queue/queue.service";

type QueueHealth = {
  paymentQueueReady: boolean;
  refundQueueReady: boolean;
};

export type QueueServiceMock = {
  enqueuePayment: jest.Mock<Promise<void>, [PaymentJobData]>;
  enqueueRefund: jest.Mock<Promise<void>, [RefundJobData]>;
  healthCheck: jest.Mock<Promise<QueueHealth>, []>;
  onModuleDestroy: jest.Mock<Promise<void>, []>;
};

export interface IntegrationContext {
  app: INestApplication;
  prisma: PrismaService;
  queueMock: QueueServiceMock;
}

export function configureIntegrationEnv(): void {
  const testDatabaseUrl = process.env.DATABASE_URL_TEST;
  if (!testDatabaseUrl) {
    throw new Error(
      "DATABASE_URL_TEST must be set for integration tests. Refusing to run without an isolated test database."
    );
  }

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "1d";
  process.env.WEBHOOK_SIGNATURE_SECRET =
    process.env.WEBHOOK_SIGNATURE_SECRET ?? "test-webhook-secret";
}

export async function createIntegrationContext(): Promise<IntegrationContext> {
  configureIntegrationEnv();

  const queueMock: QueueServiceMock = {
    enqueuePayment: jest.fn().mockResolvedValue(undefined),
    enqueueRefund: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn().mockResolvedValue({
      paymentQueueReady: true,
      refundQueueReady: true
    }),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined)
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule]
  })
    .overrideProvider(QueueService)
    .useValue(queueMock)
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(requestIdMiddleware);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma, queueMock };
}

export async function closeIntegrationContext(
  context: IntegrationContext | undefined
): Promise<void> {
  if (!context) {
    return;
  }
  await context.app.close();
}

export async function registerAndLogin(
  app: INestApplication,
  email: string,
  password: string
): Promise<{ accessToken: string; userId: string }> {
  const registerResponse = await request(app.getHttpServer())
    .post("/api/auth/register")
    .send({ email, password });
  if (registerResponse.status >= 400) {
    throw new Error(
      `register failed: status=${registerResponse.status} body=${JSON.stringify(
        registerResponse.body
      )}`
    );
  }

  const loginResponse = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password });
  if (loginResponse.status >= 400) {
    throw new Error(
      `login failed: status=${loginResponse.status} body=${JSON.stringify(loginResponse.body)}`
    );
  }

  const body = loginResponse.body as {
    accessToken?: string;
    user?: { id?: string };
  };
  if (!body.accessToken || !body.user?.id) {
    throw new Error("login response did not include accessToken and user.id");
  }

  return {
    accessToken: body.accessToken,
    userId: body.user.id
  };
}
