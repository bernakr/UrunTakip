import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Role } from "../common/enums/role.enum";
import { PrismaService } from "../common/prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AuthJwtPayload } from "./interfaces/auth-jwt-payload.interface";
import * as bcrypt from "bcrypt";

interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() }
    });
    if (existingUser) {
      throw new BadRequestException("Email is already in use.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const createdUser = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: Role.CUSTOMER
      }
    });

    return this.createAuthResponse({
      id: createdUser.id,
      email: createdUser.email,
      role: createdUser.role as Role
    });
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() }
    });
    if (!user) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.createAuthResponse({
      id: user.id,
      email: user.email,
      role: user.role as Role
    });
  }

  private createAuthResponse(user: AuthUser): AuthResponse {
    const payload: AuthJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user
    };
  }
}
