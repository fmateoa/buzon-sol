import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { AuthController } from "./auth.controller";

/** Rutas `/auth/*`. `AuthService` (autenticación y permisos por cuenta) lo aporta `CoreModule`. */
@Module({ imports: [IdentityModule], controllers: [AuthController] })
export class AuthModule {}
