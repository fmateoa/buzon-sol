import { Module } from "@nestjs/common";
import { CoreModule } from "./core/core.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { IdentityModule } from "./identity/identity.module";
import { AccountsModule } from "./accounts/accounts.module";
import { MailboxModule } from "./mailbox/mailbox.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { InventoryModule } from "./inventory/inventory.module";
import { ReadingModule } from "./reading/reading.module";
import { FilesModule } from "./files/files.module";
import { ArchiveModule } from "./archive/archive.module";
import { OperationsModule } from "./operations/operations.module";
import { SettingsModule } from "./settings/settings.module";

/** Composición: infraestructura común y una capacidad por módulo (controller → servicio → MySQL/cola). */
@Module({
  imports: [
    CoreModule, HealthModule, AuthModule, IdentityModule, AccountsModule, MailboxModule, SchedulingModule,
    InventoryModule, ReadingModule, FilesModule, ArchiveModule, OperationsModule, SettingsModule,
  ],
})
export class AppModule {}
