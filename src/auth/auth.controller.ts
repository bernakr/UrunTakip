import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  AuthenticatedRequest,
  AuthenticatedUser
} from "../common/interfaces/authenticated-request.interface";
import { AuthService, AuthResponse } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("auth")
@ApiTags("Auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@Req() request: AuthenticatedRequest): AuthenticatedUser {
    return request.user;
  }
}
