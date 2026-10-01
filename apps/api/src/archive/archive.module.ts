import { Module } from "@nestjs/common";
import { ArchiveService } from "./archive";
import { ArchiveController } from "./archive.controller";

@Module({ controllers: [ArchiveController], providers: [ArchiveService] })
export class ArchiveModule {}
