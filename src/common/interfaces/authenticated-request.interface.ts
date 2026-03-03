import { Request } from "express";
import { Role } from "../enums/role.enum";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

