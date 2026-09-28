import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EvaluationStatus, QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import {
  QuestionInputDto,
  UpsertStructureDto,
} from './dto/upsert-questions.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { mapQuestionData, StructureSection } from '../common/structure.util';
import { TemplatesService } from '../templates/templates.service';
import { AiService } from '../ai/ai.service';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const evaluationDetailInclude = {
  sections: {
    orderBy: { order: 'asc' as const },
    include: {
      questions: { orderBy: { order: 'asc' as const } },
    },
  },
  questions: { orderBy: { order: 'asc' as const } },
  _count: { select: { responses: true, questions: true } },
};

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templatesService: TemplatesService,
    private readonly aiService: AiService,
  ) {}

  async list(teacherId: string) {
    return this.prisma.evaluation.findMany({
      where: { createdBy: teacherId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { questions: true, responses: true } },
      },
    });
  }

  async create(teacherId: string, dto: CreateEvaluationDto) {
    const code = dto.code?.trim()
      ? await this.resolveCustomCode(dto.code)
      : await this.generateUniqueCode();

    let templateSections: StructureSection[] | null = null;
    if (dto.templateId) {
      const template = await this.templatesService.getOne(dto.templateId);
      templateSections = this.templatesService.getStructure(template);
    }

    return this.prisma.$transaction(async (tx) => {
      const evaluation = await tx.evaluation.create({
        data: {
          title: dto.title,
          classLabel: dto.classLabel,
          code,
          createdBy: teacherId,
          status: EvaluationStatus.DRAFT,
        },
      });

      if (templateSections && templateSections.length > 0) {
        for (const [sIndex, section] of templateSections.entries()) {
          await tx.section.create({
            data: {
              evaluationId: evaluation.id,
              title: section.title.trim(),
              order: section.order ?? sIndex,
              questions: {
                create: (section.questions || []).map((q, qIndex) =>
                  mapQuestionData(evaluation.id, q, qIndex),
                ),
              },
            },
          });
        }
      } else {
        await tx.section.create({
          data: {
            evaluationId: evaluation.id,
            title: 'Sektion 1',
            order: 0,
          },
        });
      }

      return tx.evaluation.findUnique({
        where: { id: evaluation.id },
        include: evaluationDetailInclude,
      });
    });
  }

  async getOne(teacherId: string, id: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
      include: evaluationDetailInclude,
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluering ikke fundet');
    }
    this.assertOwner(evaluation.createdBy, teacherId);
    return evaluation;
  }

  async update(teacherId: string, id: string, dto: UpdateEvaluationDto) {
    await this.getOne(teacherId, id);
    return this.prisma.evaluation.update({
      where: { id },
      data: {
        title: dto.title,
        classLabel: dto.classLabel,
      },
      include: evaluationDetailInclude,
    });
  }

  async updateStatus(teacherId: string, id: string, dto: UpdateStatusDto) {
    const evaluation = await this.getOne(teacherId, id);
    if (
      dto.status === EvaluationStatus.OPEN &&
      evaluation.questions.length === 0
    ) {
      throw new BadRequestException(
        'Tilføj mindst ét spørgsmål før evalueringen åbnes',
      );
    }
    return this.prisma.evaluation.update({
      where: { id },
      data: { status: dto.status },
      include: evaluationDetailInclude,
    });
  }

  async upsertStructure(teacherId: string, id: string, dto: UpsertStructureDto) {
    const evaluation = await this.getOne(teacherId, id);
    if (evaluation.status === EvaluationStatus.CLOSED) {
      throw new BadRequestException(
        'Kan ikke ændre spørgsmål på en lukket evaluering',
      );
    }

    if (dto.sections.some((s) => !s.title.trim())) {
      throw new BadRequestException('Alle sektioner skal have et navn');
    }

    const allQuestions = dto.sections.flatMap((s) => s.questions);
    for (const q of allQuestions) {
      this.validateQuestionInput(q);
    }
    if (allQuestions.length === 0) {
      throw new BadRequestException('Tilføj mindst ét spørgsmål');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.section.deleteMany({ where: { evaluationId: id } });

      for (const [sIndex, section] of dto.sections.entries()) {
        await tx.section.create({
          data: {
            evaluationId: id,
            title: section.title.trim(),
            order: section.order ?? sIndex,
            questions: {
              create: section.questions.map((q, qIndex) =>
                this.mapQuestionCreate(id, q, qIndex),
              ),
            },
          },
        });
      }

      return tx.evaluation.findUnique({
        where: { id },
        include: evaluationDetailInclude,
      });
    });
  }

  private validateQuestionInput(q: QuestionInputDto) {
    if (q.type === QuestionType.SCALE) {
      const min = q.scaleMin ?? 1;
      const max = q.scaleMax ?? 5;
      if (min >= max) {
        throw new BadRequestException(
          'scaleMin skal være mindre end scaleMax',
        );
      }
      const steps = max - min + 1;
      const trimmedLabels = (q.scaleLabels ?? []).map((label) => label.trim());
      const hasLabels = trimmedLabels.some(Boolean);
      if (hasLabels) {
        if (trimmedLabels.length !== steps) {
          throw new BadRequestException(
            `Antal skalalabels skal matche antal trin (${steps})`,
          );
        }
        if (trimmedLabels.some((label) => !label)) {
          throw new BadRequestException(
            'Udfyld label for alle trin, eller lad dem alle være tomme',
          );
        }
      }
      const matrixItems = (q.matrixItems ?? [])
        .map((item) => item.trim())
        .filter(Boolean);
      if (matrixItems.length === 0) {
        throw new BadRequestException(
          'Skalaspørgsmål skal have mindst én række/udsagn',
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
          'Valgspørgsmål skal have mindst to svarmuligheder',
        );
      }
    }
  }

  private mapQuestionCreate(
    evaluationId: string,
    q: QuestionInputDto,
    index: number,
  ) {
    const isScale = q.type === QuestionType.SCALE;
    const isChoice =
      q.type === QuestionType.SINGLE_CHOICE ||
      q.type === QuestionType.MULTI_CHOICE;
    const isYesNo = q.type === QuestionType.YES_NO;
    const min = q.scaleMin ?? 1;
    const max = q.scaleMax ?? 5;
    const trimmedLabels = (q.scaleLabels ?? []).map((label) => label.trim());
    const hasLabels = isScale && trimmedLabels.some(Boolean);
    const matrixItems = isScale
      ? (q.matrixItems ?? []).map((item) => item.trim()).filter(Boolean)
      : [];
    const choiceOptions = isYesNo
      ? ['Ja', 'Nej']
      : isChoice
        ? (q.choiceOptions ?? []).map((o) => o.trim()).filter(Boolean)
        : [];
    return {
      evaluationId,
      type: q.type,
      text: q.text,
      scaleMin: isScale ? min : null,
      scaleMax: isScale ? max : null,
      scaleLabels: hasLabels ? trimmedLabels : [],
      matrixItems,
      choiceOptions,
      order: q.order ?? index,
      required: q.required ?? true,
    };
  }

  async remove(teacherId: string, id: string) {
    await this.getOne(teacherId, id);
    await this.prisma.evaluation.delete({ where: { id } });
    return { ok: true };
  }

  async summary(teacherId: string, id: string) {
    const evaluation = await this.getOne(teacherId, id);
    const responses = await this.prisma.response.findMany({
      where: { evaluationId: id },
      include: { answers: true },
    });

    const totalResponses = responses.length;
    const questions = evaluation.questions.map((question) => {
      const answers = responses.flatMap((r) =>
        r.answers.filter((a) => a.questionId === question.id),
      );

      if (question.type === QuestionType.SCALE) {
        const min = question.scaleMin ?? 1;
        const max = question.scaleMax ?? 5;
        const matrixItems = question.matrixItems ?? [];
        const rows =
          matrixItems.length > 0
            ? matrixItems.map((itemText, rowIndex) => {
                const rowAnswers = answers.filter(
                  (a) => a.matrixItemIndex === rowIndex,
                );
                const values = rowAnswers
                  .map((a) => a.scaleValue)
                  .filter((v): v is number => v !== null && v !== undefined);
                const distribution: Record<string, number> = {};
                for (let i = min; i <= max; i++) {
                  distribution[String(i)] = 0;
                }
                for (const v of values) {
                  distribution[String(v)] = (distribution[String(v)] ?? 0) + 1;
                }
                const average =
                  values.length > 0
                    ? values.reduce((sum, v) => sum + v, 0) / values.length
                    : null;
                return {
                  index: rowIndex,
                  text: itemText,
                  answerCount: values.length,
                  average,
                  distribution,
                };
              })
            : [
                (() => {
                  const values = answers
                    .map((a) => a.scaleValue)
                    .filter((v): v is number => v !== null && v !== undefined);
                  const distribution: Record<string, number> = {};
                  for (let i = min; i <= max; i++) {
                    distribution[String(i)] = 0;
                  }
                  for (const v of values) {
                    distribution[String(v)] =
                      (distribution[String(v)] ?? 0) + 1;
                  }
                  const average =
                    values.length > 0
                      ? values.reduce((sum, v) => sum + v, 0) / values.length
                      : null;
                  return {
                    index: 0,
                    text: question.text,
                    answerCount: values.length,
                    average,
                    distribution,
                  };
                })(),
              ];

        const flatValues = answers
          .map((a) => a.scaleValue)
          .filter((v): v is number => v !== null && v !== undefined);
        const average =
          flatValues.length > 0
            ? flatValues.reduce((sum, v) => sum + v, 0) / flatValues.length
            : null;

        return {
          questionId: question.id,
          type: question.type,
          text: question.text,
          scaleMin: min,
          scaleMax: max,
          scaleLabels: question.scaleLabels ?? [],
          matrixItems,
          answerCount: flatValues.length,
          average,
          rows,
          distribution: rows.length === 1 ? rows[0].distribution : undefined,
        };
      }

      if (question.type === QuestionType.TEXT) {
        const texts = answers
          .map((a) => a.textValue)
          .filter((v): v is string => !!v && v.trim().length > 0);
        return {
          questionId: question.id,
          type: question.type,
          text: question.text,
          answerCount: texts.length,
          texts,
        };
      }

      // SINGLE_CHOICE | MULTI_CHOICE | YES_NO
      const options =
        question.type === QuestionType.YES_NO
          ? ['Ja', 'Nej']
          : question.choiceOptions ?? [];
      const distribution: Record<string, number> = {};
      options.forEach((_, i) => {
        distribution[String(i)] = 0;
      });
      let selections = 0;
      for (const answer of answers) {
        for (const idx of answer.choiceIndexes ?? []) {
          distribution[String(idx)] = (distribution[String(idx)] ?? 0) + 1;
          selections += 1;
        }
      }
      return {
        questionId: question.id,
        type: question.type,
        text: question.text,
        choiceOptions: options,
        answerCount: answers.length,
        selectionCount: selections,
        distribution,
        options: options.map((label, index) => ({
          index,
          label,
          count: distribution[String(index)] ?? 0,
        })),
      };
    });

    return {
      evaluationId: id,
      title: evaluation.title,
      classLabel: evaluation.classLabel,
      status: evaluation.status,
      totalResponses,
      questions,
    };
  }

  async listResponses(teacherId: string, id: string) {
    await this.getOne(teacherId, id);
    return this.prisma.response.findMany({
      where: { evaluationId: id },
      orderBy: { submittedAt: 'desc' },
      include: {
        answers: {
          include: {
            question: {
              select: {
                id: true,
                text: true,
                type: true,
                order: true,
                scaleMin: true,
                scaleMax: true,
                scaleLabels: true,
                matrixItems: true,
                choiceOptions: true,
              },
            },
          },
        },
      },
    });
  }

  async aiTextsRecap(teacherId: string, id: string) {
    const summary = await this.summary(teacherId, id);
    const textBlocks = summary.questions
      .filter(
        (q: { type: QuestionType; texts?: string[] }) =>
          q.type === QuestionType.TEXT && (q.texts?.length ?? 0) > 0,
      )
      .map((q: { text: string; texts?: string[] }) => {
        const lines = (q.texts || [])
          .slice(0, 80)
          .map((t, i) => `${i + 1}. ${t}`)
          .join('\n');
        return `### ${q.text}\n${lines}`;
      });

    if (textBlocks.length === 0) {
      throw new BadRequestException('Ingen skriftlige svar at analysere');
    }

    const system = `Du er en dansk undervisningskonsulent. Du opsummerer anonyme elevsvar.
Skriv på dansk, klart og handlingsorienteret.
Brug Markdown med ## til sektionsoverskrifter og - til punktlister.
Hold punkterne korte (én linje). Opfind ikke citater – parafrasér tendenser.
Undgå personhenvisninger.`;

    const user = `Evaluering: ${summary.title} (${summary.classLabel})
Antal besvarelser: ${summary.totalResponses}

Skriftlige svar:
${textBlocks.join('\n\n')}

Lav en AI-recap i præcis denne struktur:

## Overordnede tendenser
- ...

## Det eleverne roser
- ...

## Det der bør ændres
- ...

## 3 konkrete anbefalinger til underviseren
1. **Titel:** kort anbefaling
2. **Titel:** kort anbefaling
3. **Titel:** kort anbefaling`;

    const content = await this.aiService.complete(system, user);
    return {
      type: 'texts' as const,
      title: summary.title,
      classLabel: summary.classLabel,
      totalResponses: summary.totalResponses,
      content,
      generatedAt: new Date().toISOString(),
    };
  }

  async aiFullReport(teacherId: string, id: string) {
    const summary = await this.summary(teacherId, id);
    if (summary.totalResponses === 0) {
      throw new BadRequestException('Ingen svar at lave rapport på endnu');
    }

    const scaleLines: string[] = [];
    for (const q of summary.questions) {
      if (q.type !== QuestionType.SCALE) continue;
      const rows =
        q.rows && q.rows.length > 0
          ? q.rows
          : [
              {
                text: q.text,
                average: q.average,
                answerCount: q.answerCount,
                distribution: q.distribution || {},
              },
            ];
      for (const row of rows) {
        const avg =
          row.average !== null && row.average !== undefined
            ? Number(row.average).toFixed(2)
            : '–';
        const dist = Object.entries(row.distribution || {})
          .map(([k, v]) => `${k}:${v}`)
          .join(', ');
        scaleLines.push(
          `- [${q.text}] ${row.text} | gns ${avg} | n=${row.answerCount} | fordeling ${dist}`,
        );
      }
    }

    const textBlocks = summary.questions
      .filter(
        (q: { type: QuestionType; texts?: string[] }) =>
          q.type === QuestionType.TEXT && (q.texts?.length ?? 0) > 0,
      )
      .map((q: { text: string; texts?: string[] }) => {
        const lines = (q.texts || [])
          .slice(0, 60)
          .map((t, i) => `${i + 1}. ${t}`)
          .join('\n');
        return `### ${q.text}\n${lines}`;
      });

    const choiceBlocks = summary.questions
      .filter(
        (q: { type: QuestionType }) =>
          q.type === QuestionType.SINGLE_CHOICE ||
          q.type === QuestionType.MULTI_CHOICE ||
          q.type === QuestionType.YES_NO,
      )
      .map(
        (q: {
          text: string;
          options?: Array<{ label: string; count: number }>;
        }) => {
          const opts = (q.options || [])
            .map((o) => `${o.label}: ${o.count}`)
            .join(', ');
          return `- ${q.text} → ${opts || 'ingen data'}`;
        },
      );

    const system = `Du er en dansk evalueringsanalytiker for undervisere.
Du laver en kort, professionel midtvejs-/evalueringsrapport på dansk.
Brug Markdown med ## til sektionsoverskrifter, - til punkter og nummererede lister til anbefalinger.
Basér dig kun på de data, du får. Undgå jargon. Vær ærlig men konstruktiv.`;

    const user = `Rapportgrundlag
Titel: ${summary.title}
Hold: ${summary.classLabel}
Status: ${summary.status}
Antal svar: ${summary.totalResponses}

SKALA-RESULTATER (1–4 typisk):
${scaleLines.join('\n') || '(ingen)'}

VALGSPØRGSMÅL:
${choiceBlocks.join('\n') || '(ingen)'}

SKRIFTLIGE SVAR:
${textBlocks.join('\n\n') || '(ingen)'}

Skriv en samlet rapport i præcis denne struktur:

## Executive summary
Kort afsnit på 5–8 linjer.

## Stærke sider
- ...

## Opmærksomhedspunkter
- ...

## Tendenser i de skriftlige svar
- ...

## Anbefalede næste skridt
1. ...
2. ...
3. ...
4. ...
5. ...

## Til holdet
Kort neutral afslutning underviseren kan dele.`;

    const content = await this.aiService.complete(system, user);
    return {
      type: 'report' as const,
      title: summary.title,
      classLabel: summary.classLabel,
      totalResponses: summary.totalResponses,
      content,
      generatedAt: new Date().toISOString(),
    };
  }

  private assertOwner(ownerId: string, teacherId: string) {
    if (ownerId !== teacherId) {
      throw new ForbiddenException('Ingen adgang til denne evaluering');
    }
  }

  private async resolveCustomCode(raw: string): Promise<string> {
    const code = raw.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{4,12}$/.test(code)) {
      throw new BadRequestException(
        'Kode må kun indeholde bogstaver og tal (uden I, O, 0, 1) – 4 til 12 tegn',
      );
    }
    const existing = await this.prisma.evaluation.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException('Koden er allerede i brug');
    }
    return code;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      const existing = await this.prisma.evaluation.findUnique({
        where: { code },
      });
      if (!existing) {
        return code;
      }
    }
    throw new BadRequestException('Kunne ikke generere unik kode');
  }
}
