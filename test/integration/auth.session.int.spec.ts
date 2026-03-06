import request from "supertest";
import {
  closeIntegrationContext,
  createIntegrationContext,
  IntegrationContext
} from "./bootstrap";
import { resetDatabase } from "./db";

describe("Auth session integration", () => {
  let context: IntegrationContext;

  beforeAll(async () => {
    context = await createIntegrationContext();
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
  });

  afterAll(async () => {
    await closeIntegrationContext(context);
  });

  it("rotates refresh token and rejects the previous token", async () => {
    const email = `refresh-${Date.now()}@example.com`;
    const password = "Test1234!";

    await request(context.app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password })
      .expect(201);

    const loginResponse = await request(context.app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password })
      .expect(201);

    const loginBody = loginResponse.body as {
      accessToken: string;
      refreshToken: string;
      user: { email: string };
    };

    expect(loginBody.refreshToken).toBeTruthy();

    const refreshResponse = await request(context.app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: loginBody.refreshToken })
      .expect(201);

    const refreshBody = refreshResponse.body as {
      accessToken: string;
      refreshToken: string;
      user: { email: string };
    };

    expect(refreshBody.accessToken).toBeTruthy();
    expect(refreshBody.refreshToken).toBeTruthy();
    expect(refreshBody.refreshToken).not.toBe(loginBody.refreshToken);
    expect(refreshBody.user.email).toBe(email);

    await request(context.app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: loginBody.refreshToken })
      .expect(401);

    await request(context.app.getHttpServer())
      .get("/api/auth/me")
      .set("authorization", `Bearer ${refreshBody.accessToken}`)
      .expect(200);
  });

  it("resets password and revokes existing refresh tokens", async () => {
    const email = `reset-${Date.now()}@example.com`;
    const oldPassword = "OldPass123!";
    const newPassword = "NewPass123!";

    const registerResponse = await request(context.app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password: oldPassword })
      .expect(201);

    const registerBody = registerResponse.body as {
      refreshToken: string;
    };

    const forgotResponse = await request(context.app.getHttpServer())
      .post("/api/auth/forgot-password")
      .send({ email })
      .expect(201);

    const forgotBody = forgotResponse.body as {
      message: string;
      resetToken?: string;
    };

    expect(forgotBody.message).toContain("If an account exists");
    expect(forgotBody.resetToken).toBeTruthy();

    await request(context.app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({
        token: forgotBody.resetToken,
        newPassword
      })
      .expect(201);

    await request(context.app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: oldPassword })
      .expect(401);

    await request(context.app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: newPassword })
      .expect(201);

    await request(context.app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: registerBody.refreshToken })
      .expect(401);
  });

  it("revokes refresh token on logout", async () => {
    const email = `logout-${Date.now()}@example.com`;
    const password = "Test1234!";

    const registerResponse = await request(context.app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password })
      .expect(201);

    const registerBody = registerResponse.body as {
      refreshToken: string;
    };

    await request(context.app.getHttpServer())
      .post("/api/auth/logout")
      .send({ refreshToken: registerBody.refreshToken })
      .expect(201);

    await request(context.app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: registerBody.refreshToken })
      .expect(401);
  });
});
