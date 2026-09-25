import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateEvaluationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  classLabel?: string;
}
