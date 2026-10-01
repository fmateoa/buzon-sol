import { ArgumentMetadata, PipeTransform, Type, ValidationPipe } from "@nestjs/common";

// Sin `transform` ni conversión implícita: un string nunca se convierte en número o booleano. Lo no declarado en
// el DTO se descarta (no se rechaza: `PATCH …/schedule` recibe hoy campos de solo lectura como `nextRuns`).
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: false });

class DtoPipe implements PipeTransform {
  constructor(private readonly metatype: Type<unknown>) {}

  /** `tsx` no emite `design:paramtypes`, así que la clase se indica explícitamente en cada ruta. */
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    return pipe.transform(value, { ...metadata, metatype: this.metatype });
  }
}

/** `@Body(dto(CreateUserDto))` / `@Query(dto(MailListQuery))`: rechaza con `{ code: "validation" }` (400). */
export const dto = (metatype: Type<unknown>): PipeTransform => new DtoPipe(metatype);
