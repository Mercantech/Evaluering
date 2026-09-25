import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTeacher } from '../auth/current-teacher.decorator';
import { TemplatesService } from './templates.service';
import {
  CreateTemplateFromEvaluationDto,
  UpsertTemplateDto,
} from './dto/upsert-template.dto';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  list() {
    return this.templatesService.list();
  }

  @Post('from-evaluation/:evaluationId')
  createFromEvaluation(
    @CurrentTeacher() teacher: { id: string },
    @Param('evaluationId') evaluationId: string,
    @Body() dto: CreateTemplateFromEvaluationDto,
  ) {
    return this.templatesService.createFromEvaluation(
      teacher.id,
      evaluationId,
      dto,
    );
  }

  @Post()
  create(
    @CurrentTeacher() teacher: { id: string },
    @Body() dto: UpsertTemplateDto,
  ) {
    return this.templatesService.create(teacher.id, dto);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.templatesService.getOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertTemplateDto) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
