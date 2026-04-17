export const SECURITY_QUESTIONS = [
  { key: 'first_pet', question: "What was the name of your first pet?" },
  { key: 'mother_maiden', question: "What is your mother's maiden name?" },
  { key: 'birth_city', question: "In what city were you born?" },
  { key: 'childhood_nickname', question: "What was your childhood nickname?" },
  { key: 'first_school', question: "What was the name of your first school?" },
  { key: 'favorite_teacher', question: "What is the name of your favorite teacher?" },
  { key: 'first_job', question: "What was your first job?" },
  { key: 'childhood_best_friend', question: "What is the name of your childhood best friend?" },
  { key: 'first_car', question: "What was the make of your first car?" },
  { key: 'favorite_book', question: "What is the title of your favorite book?" },
] as const;

export type SecurityQuestionKey = typeof SECURITY_QUESTIONS[number]['key'];

export const SECURITY_QUESTION_KEYS = new Set<string>(SECURITY_QUESTIONS.map(q => q.key));
