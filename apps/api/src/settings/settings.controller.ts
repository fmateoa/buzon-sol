import { Body, Controller, Get, Headers, HttpCode, Inject, Patch } from "@nestjs/common";
import { dto } from "../common/dto";
import { AuthService } from "../auth/auth";
import { SettingsService } from "./settings";
import { SaveSettingsDto } from "./settings.dto";

@Controller("admin/settings")
export class SettingsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  @Get()
  async list(@Headers("authorization") bearer: string) {
    return this.settings.list(await this.auth.authenticate(bearer));
  }

  @Patch()
  @HttpCode(204)
  async save(@Headers("authorization") bearer: string, @Body(dto(SaveSettingsDto)) body: SaveSettingsDto): Promise<void> {
    await this.settings.save(await this.auth.authenticate(bearer), body);
  }
}
