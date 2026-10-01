import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/** Parámetros de listado: llegan como texto; los valores y rangos los resuelve `MailboxService.list`. */
export class MailListQuery {
  @IsOptional() @IsString() @MaxLength(20) offset?: string;
  @IsOptional() @IsString() @MaxLength(20) limit?: string;
  @IsOptional() @IsString() @MaxLength(40) box?: string;
  @IsOptional() @IsString() @MaxLength(40) state?: string;
  @IsOptional() @IsString() @MaxLength(40) review?: string;
  @IsOptional() @IsString() @MaxLength(40) content?: string;
  @IsOptional() @IsString() @MaxLength(40) sort?: string;
  @IsOptional() @IsString() @MaxLength(40) direction?: string;
  @IsOptional() @IsString() @MaxLength(1000) q?: string;
  @IsOptional() @IsString() @MaxLength(40) dateFrom?: string;
  @IsOptional() @IsString() @MaxLength(40) dateTo?: string;
  @IsOptional() @IsString() @MaxLength(64) seenAfter?: string;
  @IsOptional() @IsString() @MaxLength(100) folder?: string;
  @IsOptional() @IsString() @MaxLength(100) label?: string;
}

export class ReviewDto {
  @IsBoolean() reviewed!: boolean;
}
