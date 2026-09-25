import { QuestionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class QuestionInputDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  scaleMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  scaleMax?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scaleLabels?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  matrixItems?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  choiceOptions?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class SectionInputDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionInputDto)
  questions!: QuestionInputDto[];
}

export class UpsertStructureDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SectionInputDto)
  sections!: SectionInputDto[];
}

/** @deprecated kept for compatibility during transition */
export class UpsertQuestionsDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => QuestionInputDto)
  questions!: QuestionInputDto[];
}
