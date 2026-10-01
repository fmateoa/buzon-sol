import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsString, MaxLength } from "class-validator";
import { PERMISSIONS } from "@buzon-sol/domain";

export class CreateUserDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(254) email!: string;
  @IsString() @MaxLength(1024) password!: string;
  @IsString() @MaxLength(64) roleId!: string;
}

export class UpdateUserDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(254) email!: string;
  @IsString() @MaxLength(64) roleId!: string;
}

export class UserStatusDto {
  @IsIn(["active", "disabled"]) status!: "active" | "disabled";
}

export class RoleDto {
  @IsString() @MaxLength(200) name!: string;
  @IsArray() @ArrayMaxSize(PERMISSIONS.length * 2) @IsIn(PERMISSIONS, { each: true }) permissions!: string[];
  @IsBoolean() allAccounts!: boolean;
  @IsArray() @ArrayMaxSize(10_000) @IsString({ each: true }) accountIds!: string[];
}
