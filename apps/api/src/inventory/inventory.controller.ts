import { Controller, Headers, Inject, Param, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth";
import { InventoryService } from "./inventory";

@Controller()
export class InventoryController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @Post("accounts/:accountId/inventory")
  async start(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.inventory.start(await this.auth.authenticate(bearer), accountId);
  }

  @Post("inventory")
  async startAll(@Headers("authorization") bearer: string) {
    return this.inventory.startAll(await this.auth.authenticate(bearer));
  }

  @Post("accounts/:accountId/runs/:runId/resume")
  async resume(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("runId") runId: string) {
    return this.inventory.resume(await this.auth.authenticate(bearer), accountId, runId);
  }
}
