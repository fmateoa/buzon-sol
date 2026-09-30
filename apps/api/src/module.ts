import { Controller, Get, Module } from "@nestjs/common";
import dataSource from "./db/data-source";
import { AuthService, DB } from "./auth";
import { IdentityService } from "./identity";
import { IdentityController } from "./controllers";
import { AccountsService } from "./accounts";
import { SchedulingService } from "./scheduling";
import { ReadingService } from "./reading";
import { OperationsService } from "./operations";
import { FilesService } from "./files";
import { InventoryService } from "./inventory";
import { ConnectionService } from "./connection";

@Controller("health")
class HealthController {
  @Get()
  health(): { status: "ok" } {
    return { status: "ok" };
  }
}

@Module({
  controllers: [HealthController, IdentityController],
  providers: [
    { provide: DB, useFactory: async () => dataSource.isInitialized ? dataSource : dataSource.initialize() },
    AuthService, IdentityService, AccountsService, SchedulingService, ReadingService, OperationsService, FilesService, InventoryService, ConnectionService,
  ],
})
export class AppModule {}
