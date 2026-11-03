export const LEVELS = [0, 30, 80, 150, 250, 400, 600, 850, 1150, 1500];
export const TITLES_AR = ["متدرّب", "مبتدئ", "متمكّن", "محترف", "خبير", "قائد", "رئيسي", "معلّم", "حكيم", "أسطورة"];
export const TITLES_EN = ["Trainee", "Junior", "Skilled", "Pro", "Expert", "Lead", "Principal", "Master", "Sage", "Legend"];
export const XP_PER_TASK = 10;
export const XP_PER_LESSON = 15;

export function levelOf(xp: number) {
  let i = 0;
  while (i < LEVELS.length - 1 && xp >= LEVELS[i + 1]) i++;
  const prev = LEVELS[i];
  const next = LEVELS[i + 1] ?? prev;
  return { level: i + 1, index: i, progress: next > prev ? (xp - prev) / (next - prev) : 1, titleAr: TITLES_AR[i], titleEn: TITLES_EN[i] };
}
