import { Controller, Get, Headers, Inject, Param, Post, Res } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { AuthService } from "../auth/auth";
import { FilesService } from "./files";

@Controller("accounts/:accountId/files/:fileId")
export class FilesController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  @Get()
  async download(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Param("fileId") fileId: string, @Res() reply: FastifyReply): Promise<void> {
    const file = await this.files.download(await this.auth.authenticate(bearer), accountId, fileId);
    reply.header("Content-Type", file.mime);
    reply.header("Content-Disposition", `attachment; filename="${file.filename}"`);
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    if (file.mime === "text/html") reply.header("Content-Security-Policy", "sandbox");
    reply.send(file.stream);
  }

  @Post("fetch")
  async requestFetch(@Headers("authorization") bearer: string, @Param("accountId") accountId: string, @Param("fileId") fileId: string) {
    return this.files.requestFetch(await this.auth.authenticate(bearer), accountId, fileId);
  }

  @Get("fetches/:fetchId")
  async fetchStatus(@Headers("authorization") bearer: string, @Param("accountId") accountId: string,
    @Param("fileId") fileId: string, @Param("fetchId") fetchId: string) {
    return this.files.fetchStatus(await this.auth.authenticate(bearer), accountId, fileId, fetchId);
  }
}
