export type QuestionType =
  | 'SCALE'
  | 'TEXT'
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'YES_NO';

export function questionTypeLabel(type: QuestionType): string {
  switch (type) {
    case 'SCALE':
      return 'Skala';
    case 'TEXT':
      return 'Fri tekst';
    case 'SINGLE_CHOICE':
      return 'Ét valg';
    case 'MULTI_CHOICE':
      return 'Flere valg';
    case 'YES_NO':
      return 'Ja/Nej';
    default:
      return type;
  }
}
