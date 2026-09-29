/**
 * Importerer Microsoft Forms-export (H4 - 2026 Evaluering) som en lukket
 * Slutevaluering med alle besvarelser.
 *
 * Kør fra apps/api:
 *   DATABASE_URL=postgresql://evaluering:evaluering@localhost:5433/evaluering?schema=public npx tsx prisma/import-h4.ts
 */
import { PrismaClient, QuestionType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const META_COLUMNS = new Set([
  'ID',
  'Start time',
  'Completion time',
  'Email',
  'Name',
  'Last modified time',
]);

const SCALE_MAP: Record<string, number> = {
  'meget uenig': 1,
  uenig: 2,
  enig: 3,
  'meget enig': 4,
};

/** Forms-header → skabelontekst ved små staveforskelle */
const HEADER_ALIASES: Record<string, string> = {
  [normalizeKey('Jeg levede op til min egne forventninger på forløbet')]:
    'Jeg levede op til mine egne forventninger på forløbet',
  [normalizeKey('Der var klare bedømmelses kriterier for forløbet')]:
    'Der var klare bedømmelseskriterier for forløbet',
};

function normalizeKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`´]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function normalize(raw: string): string {
  const key = normalizeKey(raw);
  const alias = HEADER_ALIASES[key];
  return alias ? normalizeKey(alias) : key;
}

function parseScale(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const key = String(value).trim().toLowerCase();
  return SCALE_MAP[key] ?? null;
}

function parseText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const asNum = typeof value === 'number' ? value : Number(value);
  if (!Number.isNaN(asNum) && asNum > 20000 && asNum < 100000) {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + asNum * 86400000);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function main() {
  const filePath =
    process.env.H4_XLSX_PATH ||
    path.join(__dirname, '..', 'data', 'h4-2026-evaluering.xlsx');

  if (!fs.existsSync(filePath)) {
    throw new Error(`Fandt ikke Excel-fil: ${filePath}`);
  }

  const teacherEmail = (
    process.env.SEED_TEACHER_EMAIL || 'underviser@eval.local'
  ).toLowerCase();
  const teacher = await prisma.teacher.findUnique({
    where: { email: teacherEmail },
  });
  if (!teacher) {
    throw new Error(`Underviser findes ikke: ${teacherEmail}`);
  }

  const template = await prisma.template.findFirst({
    where: { name: 'Slutevaluering' },
  });
  if (!template) {
    throw new Error('Skabelon "Slutevaluering" mangler – kør seed først');
  }

  const structure = template.structure as Array<{
    title: string;
    order: number;
    questions: Array<{
      type: QuestionType;
      text: string;
      scaleMin?: number;
      scaleMax?: number;
      scaleLabels?: string[];
      matrixItems?: string[];
      order: number;
      required?: boolean;
    }>;
  }>;

  const code = 'H42026';
  const existing = await prisma.evaluation.findUnique({ where: { code } });
  if (existing) {
    await prisma.evaluation.delete({ where: { id: existing.id } });
    console.log(`Slettede tidligere import med kode ${code}`);
  }

  const evaluation = await prisma.$transaction(async (tx) => {
    const created = await tx.evaluation.create({
      data: {
        title: 'H4 - 2026 Evaluering',
        classLabel: 'H4 2026',
        code,
        status: 'CLOSED',
        createdBy: teacher.id,
      },
    });

    for (const sectionDef of structure) {
      const section = await tx.section.create({
        data: {
          evaluationId: created.id,
          title: sectionDef.title,
          order: sectionDef.order,
          stableKey: `sec-${sectionDef.order}-${Date.now().toString(36)}`,
        },
      });
      for (const q of sectionDef.questions) {
        await tx.question.create({
          data: {
            evaluationId: created.id,
            sectionId: section.id,
            type: q.type,
            text: q.text,
            scaleMin: q.scaleMin ?? null,
            scaleMax: q.scaleMax ?? null,
            scaleLabels: q.scaleLabels ?? [],
            matrixItems: q.matrixItems ?? [],
            choiceOptions: [],
            order: q.order,
            required: q.required ?? true,
            stableKey: `q-${sectionDef.order}-${q.order}-${Date.now().toString(36)}`,
          },
        });
      }
    }

    return tx.evaluation.findUniqueOrThrow({
      where: { id: created.id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
  });

  type Target =
    | { kind: 'scale'; questionId: string; matrixItemIndex: number }
    | { kind: 'text'; questionId: string };

  const targetsByNorm = new Map<string, Target>();

  for (const q of evaluation.questions) {
    if (q.type === QuestionType.SCALE && q.matrixItems.length > 0) {
      q.matrixItems.forEach((item, index) => {
        targetsByNorm.set(normalize(item), {
          kind: 'scale',
          questionId: q.id,
          matrixItemIndex: index,
        });
      });
    } else if (q.type === QuestionType.TEXT) {
      targetsByNorm.set(normalize(q.text), {
        kind: 'text',
        questionId: q.id,
      });
    }
  }

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  const unmatchedHeaders = new Set<string>();
  let imported = 0;

  for (const row of rows) {
    const answers: Array<{
      questionId: string;
      matrixItemIndex?: number | null;
      scaleValue?: number | null;
      textValue?: string | null;
    }> = [];

    for (const [header, value] of Object.entries(row)) {
      if (META_COLUMNS.has(header)) continue;
      const target = targetsByNorm.get(normalize(header));
      if (!target) {
        unmatchedHeaders.add(header);
        continue;
      }
      if (target.kind === 'scale') {
        const scaleValue = parseScale(value);
        if (scaleValue === null) continue;
        answers.push({
          questionId: target.questionId,
          matrixItemIndex: target.matrixItemIndex,
          scaleValue,
        });
      } else {
        const textValue = parseText(value);
        if (!textValue) continue;
        answers.push({
          questionId: target.questionId,
          textValue,
        });
      }
    }

    if (answers.length === 0) continue;

    await prisma.response.create({
      data: {
        evaluationId: evaluation.id,
        submittedAt: parseDate(row['Completion time']) ?? new Date(),
        answers: { create: answers },
      },
    });
    imported += 1;
  }

  if (unmatchedHeaders.size > 0) {
    console.warn('Umatchede kolonner:');
    for (const h of unmatchedHeaders) console.warn(`  - ${h}`);
  }

  console.log(
    `Importerede ${imported} svar til evaluering ${evaluation.id} (kode ${code})`,
  );
  console.log(`Åbn: /evaluations/${evaluation.id}/results`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
