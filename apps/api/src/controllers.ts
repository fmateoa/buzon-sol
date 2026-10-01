import { Body, Controller, Get, Headers, HttpCode, HttpException, Inject, Param, Patch, Post, Query, Res, UseFilters } from "@nestjs/common";
import { Catch, ExceptionFilter, ArgumentsHost } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { QueryFailedError } from "typeorm";
import { AppError, logEvent } from "@buzon-sol/domain";
import { AuthService } from "./auth";
import { IdentityService } from "./identity";
import { AccountsService } from "./accounts";
import { SchedulingService } from "./scheduling";
import { ReadingService } from "./reading";
import { OperationsService } from "./operations";
import { FilesService } from "./files";
import { InventoryService } from "./inventory";
import { ConnectionService } from "./connection";
import { MailboxService } from "./mailbox";
import { ArchiveService } from "./archive";
import { SettingsService } from "./settings";
import { clearSessionCookies, COOKIE_MODE_HEADER, setSessionCookies } from "./session-cookie";

@Catch()
export class SafeErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const status: Record<string, number> = {
      unauthenticated: 401, forbidden: 403, not_found: 404, validation: 400,
      conflict_running: 409, needs_credential: 409, invalid_credential: 409,
      paused: 409, incomplete_inventory: 409, remote_session_expired: 502,
      remote_disabled: 503, remote_unavailable: 502, schema_changed: 502, storage_unavailable: 503,
    };
    if (error instanceof AppError) {
      reply.status(status[error.code] ?? 500).send({ code: error.code });
    } else if (error instanceof HttpException) {
      reply.status(error.getStatus()).send({ code: error.getStatus() < 500 ? "validation" : "internal" });
    } else if (error instanceof QueryFailedError && (error.driverError as { errno?: number }).errno === 1062) {
      reply.status(400).send({ code: "validation" });
    } else {
      // Never log SQL, request bodies, headers or remote URLs from unexpected errors.
      logEvent("error", "api_unexpected_error");
      reply.status(500).send({ code: "internal" });
    }
  }
}

type BodyObject = Record<string, unknown>;

@Controller()
@UseFilters(SafeErrorFilter)
export class IdentityController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(AccountsService) private readonly accountsService: AccountsService,
    @Inject(SchedulingService) private readonly scheduling: SchedulingService,
    @Inject(ReadingService) private readonly reading: ReadingService,
    @Inject(OperationsService) private readonly operations: OperationsService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(ConnectionService) private readonly connection: ConnectionService,
    @Inject(MailboxService) private readonly mailbox: MailboxService,
    @Inject(ArchiveService) private readonly archive: ArchiveService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  @Post("auth/login")
  async login(@Body() body: BodyObject, @Headers(COOKIE_MODE_HEADER) mode: string | undefined, @Res({ passthrough: true }) reply: FastifyReply) {
    reply.header("Cache-Control", "no-store");
    const result = await this.auth.login(body?.email, body?.password);
    if (mode !== "cookie") return result;
    setSessionCookies(reply, result.token, new Date(result.expiresAt));
    return { expiresAt: result.expiresAt };
  }

  @Post("auth/logout")
  @HttpCode(204)
  async logout(@Headers("authorization") bearer: string, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.auth.logout(await this.auth.authenticate(bearer));
    clearSessionCookies(reply);
  }

  @Post("auth/activity")
  @HttpCode(204)
  async sessionActivity(@Headers("authorization") bearer: string): Promise<void> {
    await this.auth.touch(await this.auth.authenticate(bearer));
  }

  @Get("auth/me")
  async me(@Headers("authorization") bearer: string) {
    const user = await this.auth.authenticate(bearer);
    return { id: user.id, email: user.email, name: user.name, roleId: user.roleId, roleName: user.roleName,
      permissions: user.permissions, allAccounts: user.allAccounts, accountIds: user.accountIds,
      preferences: { readWarningEnabled: user.readWarningEnabled },
      policy: { passwordMinLength: await this.settings.get("security.passwordMinLength") } };
  }

  @Patch("auth/me/preferences")
  @HttpCode(204)
  async preferences(@Headers("authorization") bearer: string, @Body() body: BodyObject): Promise<void> {
    await this.identity.setReadWarning(await this.auth.authenticate(bearer), body?.readWarningEnabled);
  }

  @Get("accounts")
  async accounts(@Headers("authorization") bearer: string) {
    return this.identity.visibleAccounts(await this.auth.authenticate(bearer));
  }

  @Get("admin/accounts")
  async adminAccounts(@Headers("authorization") bearer: string) {
    return this.accountsService.list(await this.auth.authenticate(bearer));
  }

  @Get("admin/account-options")
  async accountOptions(@Headers("authorization") bearer: string) {
    return this.identity.accountOptions(await this.auth.authenticate(bearer));
  }

  @Post("admin/accounts")
  async createAccount(@Headers("authorization") bearer: string, @Body() body: BodyObject) {
    return this.accountsService.create(await this.auth.authenticate(bearer), body);
  }

  @Patch("admin/accounts/:accountId")
  @HttpCode(204)
  async updateAccount(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body() body: BodyObject): Promise<void> {
    await this.accountsService.update(await this.auth.authenticate(bearer), accountId, body);
  }

  @Get("admin/accounts/:accountId/users")
  async accountUsers(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.accountsService.users(await this.auth.authenticate(bearer), accountId);
  }

  @Patch("admin/accounts/:accountId/active")
  @HttpCode(204)
  async accountActive(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body() body: BodyObject): Promise<void> {
    await this.accountsService.setActive(await this.auth.authenticate(bearer), accountId, body?.active);
  }

  @Post("admin/accounts/:accountId/credential")
  @HttpCode(204)
  async replaceCredential(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body() body: BodyObject): Promise<void> {
    await this.accountsService.replaceCredential(await this.auth.authenticate(bearer), accountId, body?.solPassword);
  }

  @Post("admin/accounts/:accountId/connection-tests")
  async testConnection(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.connection.request(await this.auth.authenticate(bearer), accountId);
  }

  @Get("admin/accounts/:accountId/connection-tests/:testId")
  async connectionTest(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Param("testId") testId: string) {
    return this.connection.get(await this.auth.authenticate(bearer), accountId, testId);
  }

  @Get("admin/accounts/:accountId/mailbox-settings")
  async mailboxSettings(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.archive.settings(await this.auth.authenticate(bearer), accountId);
  }

  @Patch("admin/accounts/:accountId/mailbox-settings")
  @HttpCode(204)
  async saveMailboxSettings(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body() body: BodyObject): Promise<void> {
    await this.archive.saveSettings(await this.auth.authenticate(bearer), accountId, body);
  }

  @Get("accounts/:accountId/schedule")
  async getSchedule(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.scheduling.get(await this.auth.authenticate(bearer), accountId);
  }

  @Patch("accounts/:accountId/schedule")
  @HttpCode(204)
  async saveSchedule(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body() body: BodyObject): Promise<void> {
    await this.scheduling.save(await this.auth.authenticate(bearer), accountId, body);
  }

  @Get("accounts/:accountId/mail")
  async mail(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Query() query: Record<string, string | undefined>) {
    return this.mailbox.list(await this.auth.authenticate(bearer), accountId, query);
  }

  @Get("accounts/:accountId/items/:itemId")
  async item(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("itemId") itemId: string) {
    return this.mailbox.item(await this.auth.authenticate(bearer), accountId, itemId);
  }

  @Get("accounts/:accountId/items/:itemId/reads/:eventId")
  async readStatus(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Param("itemId") itemId: string, @Param("eventId") eventId: string) {
    return this.reading.readStatus(await this.auth.authenticate(bearer), accountId, itemId, eventId);
  }

  @Get("admin/runs")
  async adminRuns(@Headers("authorization") bearer: string) {
    return this.operations.runs(await this.auth.authenticate(bearer));
  }

  @Patch("accounts/:accountId/items/:itemId/review")
  @HttpCode(204)
  async setReviewed(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Param("itemId") itemId: string, @Body() body: BodyObject): Promise<void> {
    await this.identity.setReviewed(await this.auth.authenticate(bearer), accountId, itemId, body?.reviewed);
  }

  @Post("accounts/:accountId/items/:itemId/read")
  async requestRead(@Headers("authorization") bearer: string, @Headers("idempotency-key") key: string,
    @Param("accountId") accountId: string, @Param("itemId") itemId: string) {
    return this.reading.requestRead(await this.auth.authenticate(bearer), accountId, itemId, key);
  }

  @Get("accounts/:accountId/items/:itemId/detail")
  async detail(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("itemId") itemId: string) {
    return this.reading.getDetail(await this.auth.authenticate(bearer), accountId, itemId);
  }

  @Get("accounts/:accountId/files/:fileId")
  async downloadFile(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Param("fileId") fileId: string, @Res() reply: FastifyReply): Promise<void> {
    const file = await this.files.download(await this.auth.authenticate(bearer), accountId, fileId);
    reply.header("Content-Type", file.mime);
    reply.header("Content-Disposition", `attachment; filename="${file.filename}"`);
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    if (file.mime === "text/html") reply.header("Content-Security-Policy", "sandbox");
    reply.send(file.stream);
  }

  @Post("accounts/:accountId/files/:fileId/fetch")
  async fetchFile(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Param("fileId") fileId: string) {
    return this.files.requestFetch(await this.auth.authenticate(bearer), accountId, fileId);
  }

  @Get("accounts/:accountId/files/:fileId/fetches/:fetchId")
  async fileFetchStatus(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Param("fileId") fileId: string, @Param("fetchId") fetchId: string) {
    return this.files.fetchStatus(await this.auth.authenticate(bearer), accountId, fileId, fetchId);
  }

  @Get("accounts/:accountId/activity")
  async activity(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.operations.activity(await this.auth.authenticate(bearer), accountId);
  }

  @Get("accounts/:accountId/folders")
  async folders(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.mailbox.catalog(await this.auth.authenticate(bearer), accountId, "folders");
  }

  @Get("accounts/:accountId/labels")
  async labels(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.mailbox.catalog(await this.auth.authenticate(bearer), accountId, "labels");
  }

  @Get("accounts/:accountId/summary")
  async summary(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.operations.summary(await this.auth.authenticate(bearer), accountId);
  }

  @Post("accounts/:accountId/inventory")
  async startInventory(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.inventory.start(await this.auth.authenticate(bearer), accountId);
  }

  @Post("inventory")
  async startAllInventories(@Headers("authorization") bearer: string) {
    return this.inventory.startAll(await this.auth.authenticate(bearer));
  }

  @Get("accounts/:accountId/archive")
  async archiveStatus(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.archive.status(await this.auth.authenticate(bearer), accountId);
  }

  @Post("accounts/:accountId/archive")
  async startArchive(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body() body: BodyObject) {
    return this.archive.start(await this.auth.authenticate(bearer), accountId, body);
  }

  @Post("accounts/:accountId/runs/:runId/resume")
  async resumeInventory(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("runId") runId: string) {
    return this.inventory.resume(await this.auth.authenticate(bearer), accountId, runId);
  }

  @Get("admin/settings")
  async adminSettings(@Headers("authorization") bearer: string) {
    return this.settings.list(await this.auth.authenticate(bearer));
  }

  @Patch("admin/settings")
  @HttpCode(204)
  async saveAdminSettings(@Headers("authorization") bearer: string, @Body() body: BodyObject): Promise<void> {
    await this.settings.save(await this.auth.authenticate(bearer), body);
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

  @Get("users")
  async users(@Headers("authorization") bearer: string) {
    return this.identity.listUsers(await this.auth.authenticate(bearer));
  }

  @Post("users")
  async createUser(@Headers("authorization") bearer: string, @Body() body: BodyObject) {
    return this.identity.createUser(await this.auth.authenticate(bearer), body);
  }

  @Patch("users/:userId/status")
  @HttpCode(204)
  async userStatus(@Headers("authorization") bearer: string, @Param("userId") userId: string, @Body() body: BodyObject): Promise<void> {
    await this.identity.setUserStatus(await this.auth.authenticate(bearer), userId, body?.status);
  }

  @Patch("users/:userId")
  @HttpCode(204)
  async updateUser(@Headers("authorization") bearer: string, @Param("userId") userId: string, @Body() body: BodyObject): Promise<void> {
    await this.identity.updateUser(await this.auth.authenticate(bearer), userId, body);
  }

  @Get("roles")
  async roles(@Headers("authorization") bearer: string) {
    return this.identity.listRoles(await this.auth.authenticate(bearer));
  }

  @Post("roles")
  async createRole(@Headers("authorization") bearer: string, @Body() body: BodyObject) {
    return this.identity.createRole(await this.auth.authenticate(bearer), body);
  }

  @Patch("roles/:roleId")
  @HttpCode(204)
  async updateRole(@Headers("authorization") bearer: string, @Param("roleId") roleId: string, @Body() body: BodyObject): Promise<void> {
    await this.identity.updateRole(await this.auth.authenticate(bearer), roleId, body);
  }
}
