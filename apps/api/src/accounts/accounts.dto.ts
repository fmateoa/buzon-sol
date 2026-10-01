import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAccountDto {
  @IsString() @MaxLength(200) alias!: string;
  @IsString() @MaxLength(32) ruc!: string;
  @IsString() @MaxLength(200) solUser!: string;
}

export class UpdateAccountDto {
  @IsString() @MaxLength(200) alias!: string;
  /** Solo escritura: omitirlo conserva el usuario SOL guardado. */
  @IsOptional() @IsString() @MaxLength(200) solUser?: string;
}

export class AccountActiveDto {
  @IsBoolean() active!: boolean;
}

export class ReplaceCredentialDto {
  @IsString() @MaxLength(1024) solPassword!: string;
}
