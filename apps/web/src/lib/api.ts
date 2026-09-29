/** Browser-kald: samme origin via /api (nginx/Next rewrite → Nest). */
const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');


export type Teacher = {
  id: string;
  email: string;
  name: string;
};

export type EvaluationStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type QuestionType =
  | 'SCALE'
  | 'TEXT'
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'YES_NO';

export type Question = {
  id: string;
  type: QuestionType;
  text: string;
  scaleMin: number | null;
  scaleMax: number | null;
  scaleLabels?: string[];
  matrixItems?: string[];
  choiceOptions?: string[];
  order: number;
  required: boolean;
  sectionId?: string;
  stableKey?: string;
  showWhen?: import('./visibility').ShowWhen | null;
};

export type Section = {
  id: string;
  title: string;
  order: number;
  stableKey?: string;
  showWhen?: import('./visibility').ShowWhen | null;
  questions: Question[];
};

export type Evaluation = {
  id: string;
  title: string;
  classLabel: string;
  code: string;
  status: EvaluationStatus;
  createdAt: string;
  updatedAt: string;
  sections?: Section[];
  questions?: Question[];
  _count?: { questions: number; responses: number };
};

export type QuestionInput = {
  type: QuestionType;
  text: string;
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: string[];
  matrixItems?: string[];
  choiceOptions?: string[];
  order?: number;
  required?: boolean;
  stableKey?: string;
  showWhen?: import('./visibility').ShowWhen | null;
};

export type SectionInput = {
  title: string;
  order?: number;
  stableKey?: string;
  showWhen?: import('./visibility').ShowWhen | null;
  questions: QuestionInput[];
};

export type SummaryResult = {
  evaluationId: string;
  title: string;
  classLabel: string;
  status: EvaluationStatus;
  totalResponses: number;
  questions: Array<{
    questionId: string;
    type: QuestionType;
    text: string;
    scaleMin?: number;
    scaleMax?: number;
    scaleLabels?: string[];
    matrixItems?: string[];
    choiceOptions?: string[];
    answerCount: number;
    selectionCount?: number;
    average?: number | null;
    distribution?: Record<string, number>;
    options?: Array<{ index: number; label: string; count: number }>;
    rows?: Array<{
      index: number;
      text: string;
      answerCount: number;
      average: number | null;
      distribution: Record<string, number>;
    }>;
    texts?: string[];
  }>;
};

export type ResponseRow = {
  id: string;
  submittedAt: string;
  answers: Array<{
    id: string;
    scaleValue: number | null;
    textValue: string | null;
    matrixItemIndex: number | null;
    choiceIndexes?: number[];
    question: {
      id: string;
      text: string;
      type: QuestionType;
      order: number;
      scaleMin: number | null;
      scaleMax: number | null;
      scaleLabels?: string[];
      matrixItems?: string[];
      choiceOptions?: string[];
    };
  }>;
};

export type AiInsightResult = {
  type: 'texts' | 'report';
  title: string;
  classLabel: string;
  totalResponses: number;
  content: string;
  generatedAt: string;
};

export type AiBuilderChatResult = {
  reply: string;
  proposal: { sections: SectionInput[] } | null;
  generatedAt: string;
};

export type PublicEvaluation = {
  open: true;
  status: EvaluationStatus;
  id: string;
  title: string;
  classLabel: string;
  code: string;
  sections: Section[];
  questions: Question[];
};

export type PublicEvaluationClosed = {
  open: false;
  status: EvaluationStatus;
  id: string;
  title: string;
  classLabel: string;
  code: string;
};

export type PublicEvaluationLookup = PublicEvaluation | PublicEvaluationClosed;

export type Template = {
  id: string;
  name: string;
  description: string | null;
  structure: SectionInput[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = 'Noget gik galt';
    try {
      const body = await res.json();
      message = body.message
        ? Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message
        : message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  login(email: string, password: string) {
    return request<{ accessToken: string; teacher: Teacher }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  me(token: string) {
    return request<Teacher>('/auth/me', {}, token);
  },
  listEvaluations(token: string) {
    return request<Evaluation[]>('/evaluations', {}, token);
  },
  createEvaluation(
    token: string,
    data: {
      title: string;
      classLabel: string;
      templateId?: string;
      code?: string;
    },
  ) {
    return request<Evaluation>(
      '/evaluations',
      { method: 'POST', body: JSON.stringify(data) },
      token,
    );
  },
  listTemplates(token: string) {
    return request<Template[]>('/templates', {}, token);
  },
  getTemplate(token: string, id: string) {
    return request<Template>(`/templates/${id}`, {}, token);
  },
  createTemplate(
    token: string,
    data: { name: string; description?: string; sections: SectionInput[] },
  ) {
    return request<Template>(
      '/templates',
      { method: 'POST', body: JSON.stringify(data) },
      token,
    );
  },
  updateTemplate(
    token: string,
    id: string,
    data: { name: string; description?: string; sections: SectionInput[] },
  ) {
    return request<Template>(
      `/templates/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
      token,
    );
  },
  deleteTemplate(token: string, id: string) {
    return request<{ ok: boolean }>(
      `/templates/${id}`,
      { method: 'DELETE' },
      token,
    );
  },
  createTemplateFromEvaluation(
    token: string,
    evaluationId: string,
    data: { name: string; description?: string },
  ) {
    return request<Template>(
      `/templates/from-evaluation/${evaluationId}`,
      { method: 'POST', body: JSON.stringify(data) },
      token,
    );
  },
  getEvaluation(token: string, id: string) {
    return request<Evaluation>(`/evaluations/${id}`, {}, token);
  },
  updateEvaluation(
    token: string,
    id: string,
    data: { title?: string; classLabel?: string },
  ) {
    return request<Evaluation>(
      `/evaluations/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      token,
    );
  },
  updateStatus(token: string, id: string, status: EvaluationStatus) {
    return request<Evaluation>(
      `/evaluations/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      token,
    );
  },
  upsertStructure(token: string, id: string, sections: SectionInput[]) {
    return request<Evaluation>(
      `/evaluations/${id}/structure`,
      { method: 'PUT', body: JSON.stringify({ sections }) },
      token,
    );
  },
  deleteEvaluation(token: string, id: string) {
    return request<{ ok: boolean }>(
      `/evaluations/${id}`,
      { method: 'DELETE' },
      token,
    );
  },
  summary(token: string, id: string) {
    return request<SummaryResult>(
      `/evaluations/${id}/results/summary`,
      {},
      token,
    );
  },
  responses(token: string, id: string) {
    return request<ResponseRow[]>(
      `/evaluations/${id}/results/responses`,
      {},
      token,
    );
  },
  aiTextsRecap(token: string, id: string) {
    return request<AiInsightResult>(
      `/evaluations/${id}/ai/texts`,
      { method: 'POST', body: '{}' },
      token,
    );
  },
  aiFullReport(token: string, id: string) {
    return request<AiInsightResult>(
      `/evaluations/${id}/ai/report`,
      { method: 'POST', body: '{}' },
      token,
    );
  },
  aiBuilderChat(
    token: string,
    id: string,
    data: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      currentStructure?: SectionInput[];
    },
  ) {
    return request<AiBuilderChatResult>(
      `/evaluations/${id}/ai/builder-chat`,
      { method: 'POST', body: JSON.stringify(data) },
      token,
    );
  },
  publicByCode(code: string) {
    return request<PublicEvaluationLookup>(
      `/public/evaluations/by-code/${encodeURIComponent(code)}`,
    );
  },
  submitResponse(
    code: string,
    answers: Array<{
      questionId: string;
      scaleValue?: number;
      textValue?: string;
      matrixItemIndex?: number;
      choiceIndexes?: number[];
    }>,
  ) {
    return request<{ id: string; submittedAt: string }>(
      `/public/evaluations/${encodeURIComponent(code)}/responses`,
      { method: 'POST', body: JSON.stringify({ answers }) },
    );
  },
};
