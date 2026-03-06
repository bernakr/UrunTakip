import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { Role } from "../common/enums/role.enum";
import { PrismaService } from "../common/prisma/prisma.service";
import { durationToMilliseconds } from "./auth-duration.util";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AuthJwtPayload } from "./interfaces/auth-jwt-payload.interface";
import * as bcrypt from "bcrypt";

interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

interface DbUser {
  id: string;
  email: string;
  role: string;
}

interface TokenConfig {
  refreshTokenDurationMs: number;
  passwordResetDurationMs: number;
}

type AuthDbClient = Pick<
  PrismaClient,
  "user" | "refreshToken" | "passwordResetToken"
>;

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
}

export interface LogoutResponse {
  success: true;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestException("Email is already in use.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const createdUser = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.CUSTOMER
      }
    });

    return this.issueAuthResponse(this.prisma, asAuthUser(createdUser));
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.issueAuthResponse(this.prisma, asAuthUser(user));
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = hashToken(refreshToken);
    const now = new Date();
    const db = this.prisma as unknown as AuthDbClient;

    const storedToken = await db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (
      !storedToken ||
      storedToken.revokedAt !== null ||
      storedToken.expiresAt.getTime() <= now.getTime()
    ) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    return this.prisma.$transaction(async (tx) => {
      const txDb = tx as unknown as AuthDbClient;

      await txDb.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: now }
      });

      return this.issueAuthResponse(txDb, asAuthUser(storedToken.user));
    });
  }

  async forgotPassword(emailInput: string): Promise<ForgotPasswordResponse> {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });

    const response: ForgotPasswordResponse = {
      message:
        "If an account exists for this email, a password reset token has been generated."
    };

    if (!user) {
      return response;
    }

    const now = new Date();
    const token = generateToken();

    await this.prisma.$transaction(async (tx) => {
      const txDb = tx as unknown as AuthDbClient;

      await txDb.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null
        },
        data: {
          usedAt: now
        }
      });

      await txDb.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(now.getTime() + this.getTokenConfig().passwordResetDurationMs)
        }
      });
    });

    if ((this.configService.get<string>("NODE_ENV") ?? "development") !== "production") {
      response.resetToken = token;
    }

    return response;
  }

  async resetPassword(token: string, newPassword: string): Promise<AuthResponse> {
    const now = new Date();
    const tokenHash = hashToken(token);
    const db = this.prisma as unknown as AuthDbClient;

    const resetToken = await db.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: now
        }
      },
      include: { user: true }
    });

    if (!resetToken) {
      throw new BadRequestException("Invalid or expired reset token.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    return this.prisma.$transaction(async (tx) => {
      const txDb = tx as unknown as AuthDbClient;

      await txDb.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      });

      await txDb.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: now }
      });

      await txDb.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null
        },
        data: { revokedAt: now }
      });

      return this.issueAuthResponse(txDb, asAuthUser(resetToken.user));
    });
  }

  async logout(refreshToken: string): Promise<LogoutResponse> {
    const db = this.prisma as unknown as AuthDbClient;
    await db.refreshToken.updateMany({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });

    return { success: true };
  }

  private async issueAuthResponse(
    db: AuthDbClient,
    user: AuthUser
  ): Promise<AuthResponse> {
    const payload: AuthJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role
    };

    const refreshToken = generateToken();
    const tokenConfig = this.getTokenConfig();

    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + tokenConfig.refreshTokenDurationMs)
      }
    });

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken,
      user
    };
  }

  private getTokenConfig(): TokenConfig {
    const refreshDuration =
      this.configService.get<string>("REFRESH_TOKEN_EXPIRES_IN") ?? "30d";
    const passwordResetDuration =
      this.configService.get<string>("PASSWORD_RESET_TOKEN_EXPIRES_IN") ?? "30m";

    return {
      refreshTokenDurationMs: durationToMilliseconds(refreshDuration, "30d"),
      passwordResetDurationMs: durationToMilliseconds(passwordResetDuration, "30m")
    };
  }
}

function asAuthUser(user: DbUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role as Role
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function generateToken(): string {
  return randomBytes(48).toString("hex");
}
