import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class MailboxSettingsDto {
  @IsBoolean() archiveContent!: boolean;
  @IsBoolean() archiveFiles!: boolean;
  @IsInt() @Min(1) @Max(2000) archiveBatchSize!: number;
}

export class StartArchiveDto {
  @IsOptional() @IsBoolean() retryFailed?: boolean;
}
