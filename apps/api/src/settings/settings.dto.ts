import { IsObject } from "class-validator";

/** Claves y rangos de `values` los valida `SettingsService.save` contra su catálogo. */
export class SaveSettingsDto {
  @IsObject() values!: Record<string, unknown>;
}
