/**
 * Logique de calcul des Flammes 🔥 (Streaks de complicité) entre amis.
 * 
 * Règles :
 * 1. Disparaît s'il n'y a plus eu d'échange depuis au moins 48 heures (2 jours).
 * 2. S'allume dès lors qu'il y a une activité importante : au moins 3 échanges
 *    dans une même journée récemment (aujourd'hui ou hier).
 * 3. Compte le nombre de jours consécutifs d'échanges (1 échange min par jour pour maintenir la flamme).
 */

function getDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calculateFlameStreak(
  timestamps: string[],
  lastInteractionAt: string | null | undefined
): number | null {
  if (!lastInteractionAt) return null;

  const now = Date.now();
  const lastTime = new Date(lastInteractionAt).getTime();
  if (isNaN(lastTime)) return null;

  const diffMs = now - lastTime;
  const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

  // 1. Règle d'inactivité : la flamme disparaît si plus rien depuis 2 jours (48h)
  if (diffMs > TWO_DAYS_MS) {
    return null;
  }

  // 2. Dédoublonner les timestamps miroir (ex: A->B et B->A enregistrés au même instant)
  const distinctTimestamps: number[] = [];
  const sortedTimes = timestamps
    .map(t => new Date(t).getTime())
    .filter(t => !isNaN(t))
    .sort((a, b) => b - a);

  for (const t of sortedTimes) {
    if (distinctTimestamps.length === 0 || Math.abs(distinctTimestamps[distinctTimestamps.length - 1] - t) > 2000) {
      distinctTimestamps.push(t);
    }
  }

  // 3. Regrouper les échanges par jour local (YYYY-MM-DD)
  const dayCounts: Record<string, number> = {};
  for (const t of distinctTimestamps) {
    const d = new Date(t);
    const key = getDayKey(d);
    dayCounts[key] = (dayCounts[key] || 0) + 1;
  }

  // 4. Condition d'allumage : au moins 3 échanges dans une même journée récente
  const hasSufficientDailyActivity = Object.values(dayCounts).some(count => count >= 3);
  if (!hasSufficientDailyActivity) {
    return null;
  }

  // 5. Calcul des jours consécutifs (streak)
  const nowDate = new Date(now);
  const todayKey = getDayKey(nowDate);
  const yesterdayDate = new Date(now - 86400000);
  const yesterdayKey = getDayKey(yesterdayDate);

  let startDate: Date;
  if (dayCounts[todayKey] && dayCounts[todayKey] > 0) {
    startDate = nowDate;
  } else if (dayCounts[yesterdayKey] && dayCounts[yesterdayKey] > 0) {
    startDate = yesterdayDate;
  } else {
    return null;
  }

  let streakDays = 0;
  let cur = new Date(startDate);
  while (true) {
    const key = getDayKey(cur);
    if (dayCounts[key] && dayCounts[key] > 0) {
      streakDays++;
      cur = new Date(cur.getTime() - 86400000);
    } else {
      break;
    }
  }

  return streakDays > 0 ? streakDays : null;
}
