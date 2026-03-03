import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Role } from "../common/enums/role.enum";
import { AuthenticatedUser } from "../common/interfaces/authenticated-request.interface";
import { AuthJwtPayload } from "./interfaces/auth-jwt-payload.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>("JWT_SECRET");
    if (!jwtSecret) {
      throw new Error("JWT_SECRET must be provided.");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret
    });
  }

  validate(payload: AuthJwtPayload): AuthenticatedUser {
    if (!payload?.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException("Invalid token payload.");
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
  }
}
