import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Query } from "@nestjs/common";
import { dto } from "../common/dto";
import { AuthService } from "../auth/auth";
import { MailboxService } from "./mailbox";
import { MailListQuery, ReviewDto } from "./mailbox.dto";

@Controller("accounts/:accountId")
export class MailboxController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(MailboxService) private readonly mailbox: MailboxService,
  ) {}

  @Get("mail")
  async mail(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Query(dto(MailListQuery)) query: MailListQuery) {
    return this.mailbox.list(await this.auth.authenticate(bearer), accountId, query);
  }

  @Get("items/:itemId")
  async item(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("itemId") itemId: string) {
    return this.mailbox.item(await this.auth.authenticate(bearer), accountId, itemId);
  }

  @Patch("items/:itemId/review")
  @HttpCode(204)
  async setReviewed(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("itemId") itemId: string,
    @Body(dto(ReviewDto)) body: ReviewDto): Promise<void> {
    await this.mailbox.setReviewed(await this.auth.authenticate(bearer), accountId, itemId, body.reviewed);
  }

  @Get("folders")
  async folders(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.mailbox.catalog(await this.auth.authenticate(bearer), accountId, "folders");
  }

  @Get("labels")
  async labels(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.mailbox.catalog(await this.auth.authenticate(bearer), accountId, "labels");
  }
}
