import { Module } from "@nestjs/common";
import { SchedulingService } from "./scheduling";
import { SchedulingController } from "./scheduling.controller";

@Module({ controllers: [SchedulingController], providers: [SchedulingService] })
export class SchedulingModule {}
