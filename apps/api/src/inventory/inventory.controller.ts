import { Body, Controller, Headers, Inject, Param, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth";
import { dto } from "../common/dto";
import { InventoryService } from "./inventory";
import { StartInventoryDto } from "./inventory.dto";

@Controller()
export class InventoryController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @Post("accounts/:accountId/inventory")
  async start(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Body(dto(StartInventoryDto)) body: StartInventoryDto) {
    return this.inventory.start(await this.auth.authenticate(bearer), accountId, { full: body?.full === true });
  }

  @Post("inventory")
  async startAll(@Headers("authorization") bearer: string, @Body(dto(StartInventoryDto)) body: StartInventoryDto) {
    return this.inventory.startAll(await this.auth.authenticate(bearer), { full: body?.full === true });
  }

  @Post("accounts/:accountId/runs/:runId/resume")
  async resume(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("runId") runId: string) {
    return this.inventory.resume(await this.auth.authenticate(bearer), accountId, runId);
  }
}
