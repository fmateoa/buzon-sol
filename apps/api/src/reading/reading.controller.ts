import { Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth";
import { ReadingService } from "./reading";

@Controller("accounts/:accountId/items/:itemId")
export class ReadingController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ReadingService) private readonly reading: ReadingService,
  ) {}

  @Get("reads/:eventId")
  async readStatus(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("itemId") itemId: string,
    @Param("eventId") eventId: string) {
    return this.reading.readStatus(await this.auth.authenticate(bearer), accountId, itemId, eventId);
  }

  @Post("read")
  async requestRead(@Headers("authorization") bearer: string, @Headers("idempotency-key") key: string,
    @Param("accountId") accountId: string, @Param("itemId") itemId: string) {
    return this.reading.requestRead(await this.auth.authenticate(bearer), accountId, itemId, key);
  }

  @Get("detail")
  async detail(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("itemId") itemId: string) {
    return this.reading.getDetail(await this.auth.authenticate(bearer), accountId, itemId);
  }
}
