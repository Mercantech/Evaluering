import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTeacher } from '../auth/current-teacher.decorator';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { UpsertStructureDto } from './dto/upsert-questions.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('evaluations')
@UseGuards(JwtAuthGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get()
  list(@CurrentTeacher() teacher: { id: string }) {
    return this.evaluationsService.list(teacher.id);
  }

  @Post()
  create(
    @CurrentTeacher() teacher: { id: string },
    @Body() dto: CreateEvaluationDto,
  ) {
    return this.evaluationsService.create(teacher.id, dto);
  }

  @Get(':id/results/summary')
  summary(
    @CurrentTeacher() teacher: { id: string },
    @Param('id') id: string,
  ) {
    return this.evaluationsService.summary(teacher.id, id);
  }

  @Get(':id/results/responses')
  listResponses(
    @CurrentTeacher() teacher: { id: string },
    @Param('id') id: string,
  ) {
    return this.evaluationsService.listResponses(teacher.id, id);
  }

  @Post(':id/ai/texts')
  aiTextsRecap(
    @CurrentTeacher() teacher: { id: string },
    @Param('id') id: string,
  ) {
    return this.evaluationsService.aiTextsRecap(teacher.id, id);
  }

  @Post(':id/ai/report')
  aiFullReport(
    @CurrentTeacher() teacher: { id: string },
    @Param('id') id: string,
  ) {
    return this.evaluationsService.aiFullReport(teacher.id, id);
  }

  @Get(':id')
  getOne(
    @CurrentTeacher() teacher: { id: string },
    @Param('id') id: string,
  ) {
    return this.evaluationsService.getOne(teacher.id, id);
  }

  @Patch(':id')
  update(
    @CurrentTeacher() teacher: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationDto,
  ) {
    return this.evaluationsService.update(teacher.id, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentTeacher() teacher: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.evaluationsService.updateStatus(teacher.id, id, dto);
  }

  @Put(':id/structure')
  upsertStructure(
    @CurrentTeacher() teacher: { id: string },
    @Param('id') id: string,
    @Body() dto: UpsertStructureDto,
  ) {
    return this.evaluationsService.upsertStructure(teacher.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentTeacher() teacher: { id: string },
    @Param('id') id: string,
  ) {
    return this.evaluationsService.remove(teacher.id, id);
  }
}
