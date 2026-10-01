import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";

/** `SettingsService` lo aporta `CoreModule`: sesión y bloqueo de login lo leen sin importar este módulo. */
@Module({ controllers: [SettingsController] })
export class SettingsModule {}
