import { PrismaClient, QuestionType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const LIKERT_4 = ['Meget uenig', 'Uenig', 'Enig', 'Meget enig'] as const;

/**
 * Spejler Slutevaluering (samme sektioner/skalaer til sammenligning),
 * men formuleret som midtvejs – fokus på indtil videre / resten af forløbet.
 */
const midtvejsStructure = [
  {
    title: 'Struktur',
    order: 0,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Jeg oplever at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Kommunikation gennem platforme som Notion og Teams er klar og tydelig',
          'Målene for forløbet er tydeligt defineret, og forståelige',
          'Der er klare bedømmelseskriterier for forløbet',
          'Det er tydeligt, hvornår jeg skal møde op og hvornår der er undervisning',
          'Friheden til at vælge arbejdslokation gør det til et bedre forløb',
          'Friheden i selv at vælge gruppe gør det til et bedre forløb',
          'Der er en god balance mellem struktur og fleksibilitet i forløbet',
          'Deadlines og afleveringer er tydeligt kommunikeret.',
          "OLC'en/klasselokalet er et godt arbejdslokale",
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Oplever du tidspunkter, hvor strukturen for forløbet kunne forbedres? Hvis ja, hvad kunne gøre det lettere for dig at følge strukturen i resten af forløbet?',
        order: 1,
        required: false,
      },
      {
        type: QuestionType.TEXT,
        text: "Hvordan kunne OLC'en som undervisnings- og grupperum blive et endnu bedre sted at arbejde og lære for dig i resten af forløbet?",
        order: 2,
        required: false,
      },
    ],
  },
  {
    title: 'Lærlingen – aka dig!',
    order: 1,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Jeg føler at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Jeg gør mit bedste på forløbet indtil videre!',
          'Jeg lever op til mine egne forventninger på forløbet indtil videre',
          'Jeg deltager aktivt i vores gruppearbejde',
          'Jeg føler at jeg lever op til min undervisers forventninger til mig',
          'Jeg føler, jeg udvikler mig som programmør',
          'Jeg tager ansvar for projektet og min egen læring',
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Er der noget i samarbejdet med underviseren eller gruppen, som kunne gøre resten af forløbet bedre for dig?',
        order: 1,
        required: false,
      },
    ],
  },
  {
    title: 'Underviseren',
    order: 2,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Jeg oplever at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Mathias møder forberedt op til undervisningen',
          'Mathias er til rådighed i det omfang jeg har brug for det og er hjælpsom i min proces',
          'Mathias har et fagligt højt niveau, nok til at han kan undervise forløbet på en forståelig og professionel måde',
          'Mathias giver mig brugbar og tilstrækkelig feedback indtil videre i forløbet',
          'Mathias skaber et trygt læringsmiljø, hvor jeg tør stille spørgsmål og lave fejl',
          'Mathias kobler stoffet til praksis og virkelige eksempler',
          'Mathias tager mig seriøst i 1:1-samtaler og giver mig brugbare råd',
          'Gruppesparring med Mathias er nyttig, og han inddrager alle i gruppen',
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Er der noget, jeg som underviser skal blive ved med at gøre – og noget, jeg skal ændre på i resten af forløbet?',
        order: 1,
        required: false,
      },
    ],
  },
  {
    title: 'Projektet og det faglige',
    order: 3,
    questions: [
      {
        type: QuestionType.TEXT,
        text: 'Har der været noget ved forløbet indtil videre, som har overrasket dig – positivt eller negativt?',
        order: 0,
        required: false,
      },
      {
        type: QuestionType.TEXT,
        text: 'Hvad har været specielt spændende på forløbet indtil videre, og hvorfor?',
        order: 1,
        required: false,
      },
      {
        type: QuestionType.TEXT,
        text: 'Hvad mangler der i forløbet indtil videre, eller hvad vil du gerne have mere af/dybde med i resten af forløbet?',
        order: 2,
        required: false,
      },
      {
        type: QuestionType.SCALE,
        text: 'Jeg føler at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Jeg kan bruge det, jeg har lært indtil videre, på min læreplads',
          'Jeg er blevet en bedre programmør under forløbet indtil videre',
          'Vores pensum er spændende og udfordrende',
          'Jeg oplever en god balance mellem teori og praksis i forløbet',
          'Jeg kan bygge videre på det lærte ved min læreplads, hobbyprojekter eller resten af forløbet',
        ],
        order: 3,
        required: true,
      },
    ],
  },
];

const MIDTVEJS_DESCRIPTION =
  'Du er midt i et hovedforløb. Jeg vil gerne have din feedback nu, så vi kan gøre resten af forløbet endnu bedre. Evalueringen er helt anonym – så vær gerne helt ærlig i dine svar!';

/** Baseret på Forms: H4 - 2026 Evaluering (Sluteval.pdf) */
const slutStructure = [
  {
    title: 'Struktur',
    order: 0,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Jeg oplevede at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Kommunikation gennem platforme som Notion og Teams var klar og tydelig',
          'Målene for forløbet var tydeligt defineret, og forståelige',
          'Der var klare bedømmelseskriterier for forløbet',
          'Det var tydeligt, hvornår jeg skulle møde op og hvornår der var undervisning',
          'Friheden til at vælge arbejdslokation, gjorde det til et bedre forløb',
          'Friheden i selv at vælge gruppe, gjorde det til et bedre forløb',
          'Der var en god balance mellem struktur og fleksibilitet i forløbet',
          'Deadlines og afleveringer var tydeligt kommunikeret.',
          "OLC'en/klasselokalet var et godt arbejdslokale",
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Oplevede du tidspunkter, hvor strukturen for forløbet kunne forbedres? Hvis ja, hvad kunne have gjort det lettere for dig at følge strukturen?',
        order: 1,
        required: false,
      },
      {
        type: QuestionType.TEXT,
        text: "Hvordan kunne OLC'en som undervisnings- og grupperum blive et endnu bedre sted at arbejde og lære for dig?",
        order: 2,
        required: false,
      },
    ],
  },
  {
    title: 'Lærlingen – aka dig!',
    order: 1,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Jeg føler at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Jeg gjorde mit bedste på forløbet!',
          'Jeg levede op til mine egne forventninger på forløbet',
          'Jeg deltog aktivt i vores gruppearbejde',
          'Jeg føler at jeg levede op til min undervisers forventninger til mig',
          'Jeg føler, jeg udvikler mig som programmør',
          'Jeg tog ansvar for projektet og min egen læring',
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Er der noget i samarbejdet med underviseren eller gruppen, som kunne have gjort forløbet bedre for dig?',
        order: 1,
        required: false,
      },
    ],
  },
  {
    title: 'Underviseren',
    order: 2,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Jeg oplevede at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Mathias mødte forberedt op til undervisningen',
          'Mathias var til rådighed i det omfang jeg havde brug for det og var hjælpsom i min proces',
          'Mathias havde et fagligt højt niveau, nok til at han kunne undervise forløbet på en forståelig og professionel måde',
          'Mathias gav mig brugbar og tilstrækkelig feedback under og efter forløbet',
          'Mathias skabte et trygt læringsmiljø, hvor jeg turde stille spørgsmål og lave fejl',
          'Mathias koblede stoffet til praksis og virkelige eksempler',
          'Mathias tog mig seriøst i 1:1-samtaler og gav mig brugbare råd',
          'Gruppesparring med Mathias var nyttig, og han inddrog alle i gruppen',
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Er der noget, jeg som underviser skal blive ved med at gøre – og noget, jeg skal ændre på?',
        order: 1,
        required: false,
      },
    ],
  },
  {
    title: 'Projektet og det faglige',
    order: 3,
    questions: [
      {
        type: QuestionType.TEXT,
        text: 'Var der noget ved forløbet, som overraskede dig – positivt eller negativt?',
        order: 0,
        required: false,
      },
      {
        type: QuestionType.TEXT,
        text: 'Hvad var specielt spændende på forløbet, og hvorfor?',
        order: 1,
        required: false,
      },
      {
        type: QuestionType.TEXT,
        text: 'Hvad manglede der i forløbet, eller hvad ville du gerne have haft mere af/dybden med?',
        order: 2,
        required: false,
      },
      {
        type: QuestionType.SCALE,
        text: 'Jeg føler at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Jeg kan bruge det, jeg har lært i forløbet, på min læreplads',
          'Jeg er blevet en bedre programmør under forløbet',
          'Vores pensum var spændende og udfordrende',
          'Jeg oplevede en god balance mellem teori og praksis i forløbet',
          'Jeg kan bygge videre på det lærte ved min læreplads, hobbyprojekter eller næste forløb',
        ],
        order: 3,
        required: true,
      },
    ],
  },
];

const SLUT_DESCRIPTION =
  'Du er netop færdig med et hovedforløb. Jeg vil rigtig gerne have din feedback, så vi kan gøre det næste forløb endnu bedre. Evalueringen er helt anonym – så vær gerne helt ærlig i dine svar!';

/** Midtvejs for GF2 Programmering – learn.gf2.dk, tavle, opgaver/projekter */
const gf2MidtvejsStructure = [
  {
    title: 'learn.gf2.dk og materialer',
    order: 0,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Indtil videre oplever jeg at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'learn.gf2.dk er overskuelig at finde rundt i',
          'Opgaverne på learn.gf2.dk er tydeligt formuleret',
          'Platformen understøtter mit selvstændige arbejde godt',
          'Feedback eller progress på learn.gf2.dk giver mening for mig',
          'Materialerne hjælper mig med at forstå det, vi arbejder med',
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Hvad fungerer godt på learn.gf2.dk indtil videre?',
        order: 1,
        required: false,
      },
      {
        type: QuestionType.TEXT,
        text: 'Hvad mangler eller bør ændres på learn.gf2.dk i resten af forløbet?',
        order: 2,
        required: false,
      },
    ],
  },
  {
    title: 'Undervisning på tavlen',
    order: 1,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Når vi undervises på tavlen, oplever jeg at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Tempoet passer til mit niveau',
          'Forklaringerne er klare og forståelige',
          'Tavleundervisningen kobles godt til de opgaver, vi skal lave bagefter',
          'Der er tid og plads til at stille spørgsmål',
          'Jeg får noget ud af tavleundervisningen, jeg kan bruge i praksis',
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Hvad skal underviseren blive ved med at gøre på tavlen – og hvad bør ændres i resten af forløbet?',
        order: 1,
        required: false,
      },
    ],
  },
  {
    title: 'Underviseren',
    order: 2,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Jeg oplever at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Mathias møder forberedt op til undervisningen',
          'Mathias er til rådighed i det omfang jeg har brug for det og er hjælpsom i min proces',
          'Mathias har et fagligt højt niveau, nok til at han kan undervise forløbet på en forståelig og professionel måde',
          'Mathias giver mig brugbar og tilstrækkelig feedback indtil videre i forløbet',
          'Mathias skaber et trygt læringsmiljø, hvor jeg tør stille spørgsmål og lave fejl',
          'Mathias kobler stoffet til praksis og virkelige eksempler',
          'Mathias tager mig seriøst i 1:1-samtaler og giver mig brugbare råd',
          'Gruppesparring med Mathias er nyttig, og han inddrager alle i gruppen',
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Er der noget, Mathias som underviser skal blive ved med at gøre – og noget, han skal ændre på i resten af forløbet?',
        order: 1,
        required: false,
      },
    ],
  },
  {
    title: 'Opgaver og projekter sammen',
    order: 3,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Når vi laver opgaver og projekter, oplever jeg at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Der er en god balance mellem teori og praksis',
          'Samarbejdet om opgaver/projekter fungerer godt',
          'Opgaverne føles relevante for det, jeg skal lære',
          'Udfordringsniveauet er passende (hverken for let eller for svært)',
          'Jeg får nok støtte, når jeg sidder fast',
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Hvilke typer opgaver eller projekter vil du gerne have mere – eller mindre – af fremadrettet?',
        order: 1,
        required: false,
      },
    ],
  },
  {
    title: 'Dig selv og resten af forløbet',
    order: 4,
    questions: [
      {
        type: QuestionType.SCALE,
        text: 'Jeg føler at…',
        scaleMin: 1,
        scaleMax: 4,
        scaleLabels: [...LIKERT_4],
        matrixItems: [
          'Jeg gør en god indsats på forløbet indtil videre',
          'Jeg udvikler mig som programmør',
          'Jeg tør stille spørgsmål, når noget er uklart',
          'Jeg er klædt på til den næste del af GF2',
        ],
        order: 0,
        required: true,
      },
      {
        type: QuestionType.TEXT,
        text: 'Nævn én ting, der skal ændres, så resten af GF2 bliver bedre for dig.',
        order: 1,
        required: true,
      },
    ],
  },
];

const GF2_MIDTVEJS_DESCRIPTION =
  'Du er midt i GF2 Programmering (ca. de første uger på holdet). Vi bruger learn.gf2.dk, tavleundervisning og opgaver/projekter sammen. Din feedback er anonym – fortæl gerne hvad der fungerer, og hvad der bør ændres fremadrettet.';

async function ensureTemplate(
  name: string,
  description: string,
  structure: unknown,
) {
  const existing = await prisma.template.findFirst({ where: { name } });
  if (existing) {
    await prisma.template.update({
      where: { id: existing.id },
      data: {
        description,
        structure: structure as object,
      },
    });
    console.log(`Updated template: ${name}`);
    return;
  }
  await prisma.template.create({
    data: {
      name,
      description,
      structure: structure as object,
    },
  });
  console.log(`Seeded template: ${name}`);
}

async function main() {
  const email = (
    process.env.SEED_TEACHER_EMAIL || 'underviser@eval.local'
  ).toLowerCase();
  const password = process.env.SEED_TEACHER_PASSWORD || 'changeme123';
  const name = process.env.SEED_TEACHER_NAME || 'Demo Underviser';

  const existing = await prisma.teacher.findUnique({ where: { email } });
  if (!existing) {
    const legacy = await prisma.teacher.findUnique({
      where: { email: 'underviser@mags.local' },
    });
    if (legacy) {
      await prisma.teacher.update({
        where: { id: legacy.id },
        data: { email, name },
      });
      console.log(`Renamed seed teacher → ${email}`);
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.teacher.create({
        data: { email, name, passwordHash },
      });
      console.log(`Seeded teacher: ${email}`);
    }
  } else {
    console.log(`Seed teacher already exists: ${email}`);
  }

  await ensureTemplate(
    'Midtvejs evaluering',
    MIDTVEJS_DESCRIPTION,
    midtvejsStructure,
  );
  await ensureTemplate('Slutevaluering', SLUT_DESCRIPTION, slutStructure);
  await ensureTemplate(
    'GF2 Programmering – midtvejs',
    GF2_MIDTVEJS_DESCRIPTION,
    gf2MidtvejsStructure,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
