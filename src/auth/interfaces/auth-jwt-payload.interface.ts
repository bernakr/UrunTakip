import { Role } from "../../common/enums/role.enum";

export interface AuthJwtPayload {
  sub: string;
  email: string;
  role: Role;
}

