import { IsBoolean, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @IsString() @MaxLength(254) email!: string;
  @IsString() @MaxLength(1024) password!: string;
}

export class PreferencesDto {
  @IsBoolean() readWarningEnabled!: boolean;
}
