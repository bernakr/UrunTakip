import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { StringValue } from "ms";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>("JWT_SECRET");
        const expiresIn = (configService.get<string>("JWT_EXPIRES_IN") ??
          "1d") as StringValue;
        if (!secret) {
          throw new Error("JWT_SECRET must be configured.");
        }
        return {
          secret,
          signOptions: { expiresIn }
        };
      }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, PassportModule]
})
export class AuthModule {}
