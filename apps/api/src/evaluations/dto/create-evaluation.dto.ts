import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEvaluationDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  classLabel!: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  /** Valgfri egen kode (4–12 tegn, A–Z og 2–9 uden I/O/0/1) */
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  @Matches(/^[A-HJ-NP-Z2-9]+$/i, {
    message:
      'Kode må kun indeholde bogstaver og tal (uden I, O, 0, 1) – 4 til 12 tegn',
  })
  code?: string;
}
