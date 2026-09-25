import { EvaluationStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(EvaluationStatus)
  status!: EvaluationStatus;
}
