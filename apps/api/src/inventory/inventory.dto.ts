import { IsBoolean, IsOptional } from "class-validator";

/** `full: true` forces a complete pass even when a recent one allows an incremental run. */
export class StartInventoryDto {
  @IsOptional() @IsBoolean() full?: boolean;
}
