import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post } from "@nestjs/common";
import { dto } from "../common/dto";
import { AuthService } from "../auth/auth";
import { ArchiveService } from "./archive";
import { MailboxSettingsDto, StartArchiveDto } from "./archive.dto";

@Controller()
export class ArchiveController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ArchiveService) private readonly archive: ArchiveService,
  ) {}

  @Get("admin/accounts/:accountId/mailbox-settings")
  async settings(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.archive.settings(await this.auth.authenticate(bearer), accountId);
  }

  @Patch("admin/accounts/:accountId/mailbox-settings")
  @HttpCode(204)
  async saveSettings(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Body(dto(MailboxSettingsDto)) body: MailboxSettingsDto): Promise<void> {
    await this.archive.saveSettings(await this.auth.authenticate(bearer), accountId, body);
  }

  @Get("accounts/:accountId/archive")
  async status(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.archive.status(await this.auth.authenticate(bearer), accountId);
  }

  @Post("accounts/:accountId/archive")
  async start(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body(dto(StartArchiveDto)) body: StartArchiveDto) {
    return this.archive.start(await this.auth.authenticate(bearer), accountId, body);
  }
}
