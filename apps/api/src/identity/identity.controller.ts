import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post } from "@nestjs/common";
import { dto } from "../common/dto";
import { AuthService } from "../auth/auth";
import { IdentityService } from "./identity";
import { CreateUserDto, RoleDto, UpdateUserDto, UserStatusDto } from "./identity.dto";

@Controller()
export class IdentityController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Get("admin/account-options")
  async accountOptions(@Headers("authorization") bearer: string) {
    return this.identity.accountOptions(await this.auth.authenticate(bearer));
  }

  @Get("users")
  async users(@Headers("authorization") bearer: string) {
    return this.identity.listUsers(await this.auth.authenticate(bearer));
  }

  @Post("users")
  async createUser(@Headers("authorization") bearer: string, @Body(dto(CreateUserDto)) body: CreateUserDto) {
    return this.identity.createUser(await this.auth.authenticate(bearer), body);
  }

  @Patch("users/:userId/status")
  @HttpCode(204)
  async userStatus(@Headers("authorization") bearer: string, @Param("userId") userId: string, @Body(dto(UserStatusDto)) body: UserStatusDto): Promise<void> {
    await this.identity.setUserStatus(await this.auth.authenticate(bearer), userId, body.status);
  }

  @Patch("users/:userId")
  @HttpCode(204)
  async updateUser(@Headers("authorization") bearer: string, @Param("userId") userId: string, @Body(dto(UpdateUserDto)) body: UpdateUserDto): Promise<void> {
    await this.identity.updateUser(await this.auth.authenticate(bearer), userId, body);
  }

  @Get("roles")
  async roles(@Headers("authorization") bearer: string) {
    return this.identity.listRoles(await this.auth.authenticate(bearer));
  }

  @Post("roles")
  async createRole(@Headers("authorization") bearer: string, @Body(dto(RoleDto)) body: RoleDto) {
    return this.identity.createRole(await this.auth.authenticate(bearer), body);
  }

  @Patch("roles/:roleId")
  @HttpCode(204)
  async updateRole(@Headers("authorization") bearer: string, @Param("roleId") roleId: string, @Body(dto(RoleDto)) body: RoleDto): Promise<void> {
    await this.identity.updateRole(await this.auth.authenticate(bearer), roleId, body);
  }
}
