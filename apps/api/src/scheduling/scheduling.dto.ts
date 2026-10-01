import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsString, MaxLength } from "class-validator";

export class SaveScheduleDto {
  @IsIn(["disabled", "paused", "active"]) state!: "disabled" | "paused" | "active";
  @IsString() @MaxLength(20) frequency!: string;
  @IsArray() @ArrayMaxSize(7) @IsString({ each: true }) days!: string[];
  @IsString() @MaxLength(10) windowStart!: string;
  @IsString() @MaxLength(10) windowEnd!: string;
  @IsArray() @ArrayMaxSize(2) @IsIn(["messages", "notifications"], { each: true }) boxes!: string[];
  @IsBoolean() downloadReadAttachments!: boolean;
  @IsBoolean() notifyInApp!: boolean;
  @IsBoolean() notifyDailyEmail!: boolean;
  @IsBoolean() remoteEffectAccepted!: boolean;
}
