import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch } from "@nestjs/common";
import { dto } from "../common/dto";
import { AuthService } from "../auth/auth";
import { SchedulingService } from "./scheduling";
import { SaveScheduleDto } from "./scheduling.dto";

@Controller("accounts/:accountId/schedule")
export class SchedulingController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SchedulingService) private readonly scheduling: SchedulingService,
  ) {}

  @Get()
  async get(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.scheduling.get(await this.auth.authenticate(bearer), accountId);
  }

  @Patch()
  @HttpCode(204)
  async save(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body(dto(SaveScheduleDto)) body: SaveScheduleDto): Promise<void> {
    await this.scheduling.save(await this.auth.authenticate(bearer), accountId, body);
  }
}
