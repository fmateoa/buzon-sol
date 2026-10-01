import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post } from "@nestjs/common";
import { dto } from "../common/dto";
import { AuthService } from "../auth/auth";
import { AccountsService } from "./accounts";
import { ConnectionService } from "./connection";
import { AccountActiveDto, CreateAccountDto, ReplaceCredentialDto, UpdateAccountDto } from "./accounts.dto";

@Controller()
export class AccountsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(ConnectionService) private readonly connection: ConnectionService,
  ) {}

  @Get("accounts")
  async visibleAccounts(@Headers("authorization") bearer: string) {
    return this.accounts.visibleAccounts(await this.auth.authenticate(bearer));
  }

  @Get("admin/accounts")
  async list(@Headers("authorization") bearer: string) {
    return this.accounts.list(await this.auth.authenticate(bearer));
  }

  @Post("admin/accounts")
  async create(@Headers("authorization") bearer: string, @Body(dto(CreateAccountDto)) body: CreateAccountDto) {
    return this.accounts.create(await this.auth.authenticate(bearer), body);
  }

  @Patch("admin/accounts/:accountId")
  @HttpCode(204)
  async update(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body(dto(UpdateAccountDto)) body: UpdateAccountDto): Promise<void> {
    await this.accounts.update(await this.auth.authenticate(bearer), accountId, body);
  }

  @Get("admin/accounts/:accountId/users")
  async users(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.accounts.users(await this.auth.authenticate(bearer), accountId);
  }

  @Patch("admin/accounts/:accountId/active")
  @HttpCode(204)
  async setActive(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body(dto(AccountActiveDto)) body: AccountActiveDto): Promise<void> {
    await this.accounts.setActive(await this.auth.authenticate(bearer), accountId, body.active);
  }

  @Post("admin/accounts/:accountId/credential")
  @HttpCode(204)
  async replaceCredential(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Body(dto(ReplaceCredentialDto)) body: ReplaceCredentialDto): Promise<void> {
    await this.accounts.replaceCredential(await this.auth.authenticate(bearer), accountId, body.solPassword);
  }

  @Post("admin/accounts/:accountId/connection-tests")
  async testConnection(@Headers("authorization") bearer: string, @Param("accountId") accountId: string) {
    return this.connection.request(await this.auth.authenticate(bearer), accountId);
  }

  @Get("admin/accounts/:accountId/connection-tests/:testId")
  async connectionTest(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("testId") testId: string) {
    return this.connection.get(await this.auth.authenticate(bearer), accountId, testId);
  }
}
