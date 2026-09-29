import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuestionType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTemplateFromEvaluationDto,
  UpsertTemplateDto,
} from './dto/upsert-template.dto';
import { questionToInput, StructureSection } from '../common/structure.util';
import { normalizeShowWhen } from '../common/visibility';
import { QuestionInputDto } from '../evaluations/dto/upsert-questions.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.template.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getOne(id: string) {
    const template = await this.prisma.template.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('Skabelon ikke fundet');
    }
    return template;
  }

  async create(teacherId: string, dto: UpsertTemplateDto) {
    this.assertStructure(dto.sections);
    return this.prisma.template.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        createdBy: teacherId,
        structure: dto.sections as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpsertTemplateDto) {
    await this.getOne(id);
    this.assertStructure(dto.sections);
    return this.prisma.template.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        structure: dto.sections as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async remove(id: string) {
    await this.getOne(id);
    await this.prisma.template.delete({ where: { id } });
    return { ok: true };
  }

  async createFromEvaluation(
    teacherId: string,
    evaluationId: string,
    dto: CreateTemplateFromEvaluationDto,
  ) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { questions: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluering ikke fundet');
    }
    if (evaluation.createdBy !== teacherId) {
      throw new BadRequestException('Ingen adgang til denne evaluering');
    }
    if (evaluation.sections.length === 0) {
      throw new BadRequestException(
        'Evalueringen har ingen sektioner at gemme',
      );
    }

    const sections: StructureSection[] = evaluation.sections.map(
      (section, sIndex) => ({
        title: section.title,
        order: section.order ?? sIndex,
        stableKey: section.stableKey,
        showWhen: normalizeShowWhen(section.showWhen) as StructureSection['showWhen'],
        questions: section.questions.map((q) => questionToInput(q)),
      }),
    );
    this.assertStructure(sections);

    return this.prisma.template.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        createdBy: teacherId,
        structure: sections as unknown as Prisma.InputJsonValue,
      },
    });
  }

  getStructure(template: { structure: Prisma.JsonValue }): StructureSection[] {
    const raw = template.structure as unknown as StructureSection[];
    if (!Array.isArray(raw)) {
      throw new BadRequestException('Skabelonen har ugyldig struktur');
    }
    return raw;
  }

  private assertStructure(sections: StructureSection[]) {
    if (!sections.length) {
      throw new BadRequestException('Skabelonen skal have mindst én sektion');
    }
    const questions = sections.flatMap((s) => s.questions || []);
    if (!questions.length) {
      throw new BadRequestException('Skabelonen skal have mindst ét spørgsmål');
    }
    for (const section of sections) {
      if (!section.title?.trim()) {
        throw new BadRequestException('Alle sektioner skal have et navn');
      }
    }
    for (const q of questions) {
      this.validateQuestion(q);
    }
  }

  private validateQuestion(q: QuestionInputDto) {
    if (!q.text?.trim()) {
      throw new BadRequestException('Alle spørgsmål skal have tekst');
    }
    if (q.type === QuestionType.SCALE) {
      const items = (q.matrixItems ?? []).map((i) => i.trim()).filter(Boolean);
      if (!items.length) {
        throw new BadRequestException(
          'Skalaspørgsmål skal have mindst én række',
        );
      }
    }
    if (
      q.type === QuestionType.SINGLE_CHOICE ||
      q.type === QuestionType.MULTI_CHOICE
    ) {
      const options = (q.choiceOptions ?? [])
        .map((o) => o.trim())
        .filter(Boolean);
      if (options.length < 2) {
        throw new BadRequestException(
          'Valgspørgsmål skal have mindst to muligheder',
        );
      }
    }
  }
}
