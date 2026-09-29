import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EvaluationStatus, QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitResponseDto } from './dto/submit-response.dto';
import {
  AnswerSnapshot,
  isVisible,
  normalizeShowWhen,
} from '../common/visibility';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getByCode(code: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            questions: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluering ikke fundet');
    }

    if (evaluation.status !== EvaluationStatus.OPEN) {
      return {
        open: false as const,
        status: evaluation.status,
        id: evaluation.id,
        title: evaluation.title,
        classLabel: evaluation.classLabel,
        code: evaluation.code,
      };
    }

    const mapQuestion = (
      q: (typeof evaluation.sections)[0]['questions'][0],
    ) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      scaleMin: q.scaleMin,
      scaleMax: q.scaleMax,
      scaleLabels: q.scaleLabels ?? [],
      matrixItems: q.matrixItems ?? [],
      choiceOptions:
        q.type === QuestionType.YES_NO
          ? ['Ja', 'Nej']
          : q.choiceOptions ?? [],
      order: q.order,
      required: q.required,
      stableKey: q.stableKey,
      showWhen: normalizeShowWhen(q.showWhen),
      sectionId: q.sectionId,
    });

    return {
      open: true as const,
      status: evaluation.status,
      id: evaluation.id,
      title: evaluation.title,
      classLabel: evaluation.classLabel,
      code: evaluation.code,
      sections: evaluation.sections.map((section) => ({
        id: section.id,
        title: section.title,
        order: section.order,
        stableKey: section.stableKey,
        showWhen: normalizeShowWhen(section.showWhen),
        questions: section.questions.map(mapQuestion),
      })),
      questions: evaluation.sections.flatMap((s) =>
        s.questions.map(mapQuestion),
      ),
    };
  }

  async submit(code: string, dto: SubmitResponseDto) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { questions: { orderBy: { order: 'asc' } } },
        },
        questions: true,
      },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluering ikke fundet');
    }
    if (evaluation.status !== EvaluationStatus.OPEN) {
      throw new BadRequestException('Evalueringen er ikke åben for besvarelse');
    }

    const questionMap = new Map(evaluation.questions.map((q) => [q.id, q]));
    const answersByKey = this.buildAnswerSnapshots(dto, evaluation.questions);
    const visibleQuestionIds = new Set<string>();

    for (const section of evaluation.sections) {
      const sectionShow = normalizeShowWhen(section.showWhen);
      if (!isVisible(sectionShow, answersByKey)) continue;
      for (const question of section.questions) {
        const qShow = normalizeShowWhen(question.showWhen);
        if (!isVisible(qShow, answersByKey)) continue;
        visibleQuestionIds.add(question.id);
      }
    }

    const visibleAnswers = dto.answers.filter((a) =>
      visibleQuestionIds.has(a.questionId),
    );

    for (const question of evaluation.questions) {
      if (!visibleQuestionIds.has(question.id)) continue;
      const related = visibleAnswers.filter((a) => a.questionId === question.id);

      if (question.type === QuestionType.TEXT) {
        if (question.required && related.length === 0) {
          throw new BadRequestException(
            `Spørgsmål mangler svar: ${question.text}`,
          );
        }
        continue;
      }

      if (question.type === QuestionType.SCALE) {
        const items = question.matrixItems ?? [];
        const expected =
          items.length > 0
            ? items.map((_, index) => index)
            : [null as number | null];

        for (const rowIndex of expected) {
          const match =
            rowIndex === null
              ? related[0]
              : related.find((a) => a.matrixItemIndex === rowIndex);
          if (question.required && !match) {
            const rowLabel =
              rowIndex === null
                ? question.text
                : items[rowIndex] || `Række ${rowIndex + 1}`;
            throw new BadRequestException(`Udfyld: ${rowLabel}`);
          }
        }
        continue;
      }

      if (question.required && related.length === 0) {
        throw new BadRequestException(
          `Spørgsmål mangler svar: ${question.text}`,
        );
      }
    }

    for (const answer of visibleAnswers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new BadRequestException('Ukendt spørgsmål i svar');
      }

      if (question.type === QuestionType.SCALE) {
        if (
          answer.scaleValue === undefined ||
          answer.scaleValue === null ||
          answer.textValue
        ) {
          throw new BadRequestException(
            `Skalaspørgsmål kræver scaleValue: ${question.text}`,
          );
        }
        const min = question.scaleMin ?? 1;
        const max = question.scaleMax ?? 5;
        if (answer.scaleValue < min || answer.scaleValue > max) {
          throw new BadRequestException(
            `Skalaværdi uden for interval (${min}-${max})`,
          );
        }
        const items = question.matrixItems ?? [];
        if (items.length > 0) {
          if (
            answer.matrixItemIndex === undefined ||
            answer.matrixItemIndex === null ||
            answer.matrixItemIndex < 0 ||
            answer.matrixItemIndex >= items.length
          ) {
            throw new BadRequestException(
              `Ugyldigt matrixItemIndex for: ${question.text}`,
            );
          }
        }
      }

      if (question.type === QuestionType.TEXT) {
        if (answer.scaleValue !== undefined && answer.scaleValue !== null) {
          throw new BadRequestException(
            `Tekstspørgsmål må ikke have scaleValue: ${question.text}`,
          );
        }
        if (
          question.required &&
          (!answer.textValue || !answer.textValue.trim())
        ) {
          throw new BadRequestException(`Tekstsvar mangler: ${question.text}`);
        }
      }

      if (
        question.type === QuestionType.SINGLE_CHOICE ||
        question.type === QuestionType.MULTI_CHOICE ||
        question.type === QuestionType.YES_NO
      ) {
        const options =
          question.type === QuestionType.YES_NO
            ? ['Ja', 'Nej']
            : question.choiceOptions ?? [];
        const indexes = [...new Set(answer.choiceIndexes ?? [])];
        if (question.required && indexes.length === 0) {
          throw new BadRequestException(`Vælg et svar: ${question.text}`);
        }
        if (
          question.type === QuestionType.SINGLE_CHOICE ||
          question.type === QuestionType.YES_NO
        ) {
          if (indexes.length > 1) {
            throw new BadRequestException(
              `Kun ét valg tilladt: ${question.text}`,
            );
          }
        }
        for (const idx of indexes) {
          if (idx < 0 || idx >= options.length) {
            throw new BadRequestException(
              `Ugyldigt valg for: ${question.text}`,
            );
          }
        }
      }
    }

    const response = await this.prisma.response.create({
      data: {
        evaluationId: evaluation.id,
        answers: {
          create: visibleAnswers.map((a) => {
            const question = questionMap.get(a.questionId)!;
            const isScale = question.type === QuestionType.SCALE;
            const isText = question.type === QuestionType.TEXT;
            const isChoice =
              question.type === QuestionType.SINGLE_CHOICE ||
              question.type === QuestionType.MULTI_CHOICE ||
              question.type === QuestionType.YES_NO;
            return {
              questionId: a.questionId,
              matrixItemIndex: isScale ? (a.matrixItemIndex ?? null) : null,
              scaleValue: isScale ? a.scaleValue : null,
              textValue: isText ? a.textValue?.trim() || null : null,
              choiceIndexes: isChoice
                ? [...new Set(a.choiceIndexes ?? [])]
                : [],
            };
          }),
        },
      },
    });

    return { id: response.id, submittedAt: response.submittedAt };
  }

  private buildAnswerSnapshots(
    dto: SubmitResponseDto,
    questions: Array<{
      id: string;
      stableKey: string;
      type: QuestionType;
    }>,
  ): Map<string, AnswerSnapshot> {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const map = new Map<string, AnswerSnapshot>();

    for (const answer of dto.answers) {
      const question = byId.get(answer.questionId);
      if (!question) continue;
      const key = question.stableKey;
      const existing = map.get(key) || {};

      if (
        question.type === QuestionType.SINGLE_CHOICE ||
        question.type === QuestionType.MULTI_CHOICE ||
        question.type === QuestionType.YES_NO
      ) {
        existing.choiceIndexes = [...new Set(answer.choiceIndexes ?? [])];
      } else if (question.type === QuestionType.TEXT) {
        existing.textValue = answer.textValue ?? null;
      } else if (question.type === QuestionType.SCALE) {
        if (
          answer.matrixItemIndex !== undefined &&
          answer.matrixItemIndex !== null &&
          answer.scaleValue !== undefined &&
          answer.scaleValue !== null
        ) {
          existing.scaleByRow = {
            ...(existing.scaleByRow || {}),
            [answer.matrixItemIndex]: answer.scaleValue,
          };
        } else if (answer.scaleValue !== undefined) {
          existing.scaleValue = answer.scaleValue;
        }
      }
      map.set(key, existing);
    }

    return map;
  }
}
