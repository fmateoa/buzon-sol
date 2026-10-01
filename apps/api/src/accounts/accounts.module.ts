import { Module } from "@nestjs/common";
import { AccountsService } from "./accounts";
import { ConnectionService } from "./connection";
import { AccountsController } from "./accounts.controller";

@Module({ controllers: [AccountsController], providers: [AccountsService, ConnectionService] })
export class AccountsModule {}
