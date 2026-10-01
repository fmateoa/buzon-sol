import { Body, Controller, Get, Headers, HttpCode, Inject, Patch, Post, Res } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { dto } from "../common/dto";
import { IdentityService } from "../identity/identity";
import { SettingsService } from "../settings/settings";
import { AuthService } from "./auth";
import { LoginDto, PreferencesDto } from "./auth.dto";
import { clearSessionCookies, COOKIE_MODE_HEADER, setSessionCookies } from "./session-cookie";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  @Post("login")
  async login(@Body(dto(LoginDto)) body: LoginDto, @Headers(COOKIE_MODE_HEADER) mode: string | undefined, @Res({ passthrough: true }) reply: FastifyReply) {
    reply.header("Cache-Control", "no-store");
    const result = await this.auth.login(body.email, body.password);
    if (mode !== "cookie") return result;
    setSessionCookies(reply, result.token, new Date(result.expiresAt));
    return { expiresAt: result.expiresAt };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Headers("authorization") bearer: string, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.auth.logout(await this.auth.authenticate(bearer));
    clearSessionCookies(reply);
  }

  @Post("activity")
  @HttpCode(204)
  async sessionActivity(@Headers("authorization") bearer: string): Promise<void> {
    await this.auth.touch(await this.auth.authenticate(bearer));
  }

  @Get("me")
  async me(@Headers("authorization") bearer: string) {
    const user = await this.auth.authenticate(bearer);
    return { id: user.id, email: user.email, name: user.name, roleId: user.roleId, roleName: user.roleName,
      permissions: user.permissions, allAccounts: user.allAccounts, accountIds: user.accountIds,
      preferences: { readWarningEnabled: user.readWarningEnabled },
      policy: { passwordMinLength: await this.settings.get("security.passwordMinLength") } };
  }

  @Patch("me/preferences")
  @HttpCode(204)
  async preferences(@Headers("authorization") bearer: string, @Body(dto(PreferencesDto)) body: PreferencesDto): Promise<void> {
    await this.identity.setReadWarning(await this.auth.authenticate(bearer), body.readWarningEnabled);
  }
}
