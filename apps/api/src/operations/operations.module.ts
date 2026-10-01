import { Module } from "@nestjs/common";
import { OperationsService } from "./operations";
import { OperationsController } from "./operations.controller";

@Module({ controllers: [OperationsController], providers: [OperationsService] })
export class OperationsModule {}
