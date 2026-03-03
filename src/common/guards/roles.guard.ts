import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Role } from "../enums/role.enum";

interface RequestUser {
  id: string;
  email: string;
  role: Role;
}

interface RequestWithUser extends Request {
  user?: RequestUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new ForbiddenException("Authenticated user context is missing.");
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException("Insufficient role for this endpoint.");
    }

    return true;
  }
}
