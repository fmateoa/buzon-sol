import { Controller, Get, Headers, HttpCode, Inject, Param, Post, Res } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { AuthService } from "../auth/auth";
import { OperationsService } from "./operations";

@Controller()
export class OperationsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(OperationsService) private readonly operations: OperationsService,
  ) {}

  @Get("admin/runs")
  async runs(@Headers("authorization") bearer: string) {
    return this.operations.runs(await this.auth.authenticate(bearer));
  }

  @Get("accounts/:accountId/activity")
  async activity(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.operations.activity(await this.auth.authenticate(bearer), accountId);
  }

  @Get("accounts/:accountId/summary")
  async summary(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.operations.summary(await this.auth.authenticate(bearer), accountId);
  }

  @Get("audit")
  async audit(@Headers("authorization") bearer: string) {
    return this.operations.audit(await this.auth.authenticate(bearer));
  }

  @Get("audit.csv")
  async auditCsv(@Headers("authorization") bearer: string, @Res({ passthrough: true }) reply: FastifyReply) {
    const csv = await this.operations.auditCsv(await this.auth.authenticate(bearer));
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", "attachment; filename=auditoria.csv");
    reply.header("Cache-Control", "no-store");
    return csv;
  }

  @Get("notices")
  async notices(@Headers("authorization") bearer: string) {
    return this.operations.notices(await this.auth.authenticate(bearer));
  }

  @Post("notices/:noticeId/read")
  @HttpCode(204)
  async markNotice(@Headers("authorization") bearer: string, @Param("noticeId") noticeId: string): Promise<void> {
    await this.operations.markNoticeRead(await this.auth.authenticate(bearer), noticeId);
  }
}
