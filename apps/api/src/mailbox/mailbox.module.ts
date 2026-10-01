import { Module } from "@nestjs/common";
import { MailboxService } from "./mailbox";
import { MailboxController } from "./mailbox.controller";

@Module({ controllers: [MailboxController], providers: [MailboxService] })
export class MailboxModule {}
