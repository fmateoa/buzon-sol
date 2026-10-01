import { Global, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import dataSource from "../db/data-source";
import { DB } from "../common/tokens";
import { SafeErrorFilter } from "../common/safe-error.filter";
import { AuthService } from "../auth/auth";
import { SettingsService } from "../settings/settings";

/**
 * Infraestructura que todo módulo de negocio necesita: conexión MySQL, ajustes, autenticación/permisos y el
 * filtro de errores. Global para no repetir la importación en cada capacidad.
 */
@Global()
@Module({
  providers: [
    { provide: DB, useFactory: async () => dataSource.isInitialized ? dataSource : dataSource.initialize() },
    SettingsService,
    AuthService,
    { provide: APP_FILTER, useClass: SafeErrorFilter },
  ],
  exports: [DB, SettingsService, AuthService],
})
export class CoreModule {}
