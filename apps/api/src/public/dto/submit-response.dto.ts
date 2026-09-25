import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class AnswerInputDto {
  @IsString()
  questionId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  scaleValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  matrixItemIndex?: number;

  @IsOptional()
  @IsString()
  textValue?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  choiceIndexes?: number[];
}

export class SubmitResponseDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  answers!: AnswerInputDto[];
}
