export type JosekiRecord = {
  josekiId: string;
  result: "success" | "failure";
  timestamp: string; // ISO 8601
};

const STORAGE_KEY = "joseki_training_v1";

export function getRecords(): JosekiRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as JosekiRecord[];
  } catch {
    return [];
  }
}

export function addRecord(
  josekiId: string,
  result: "success" | "failure",
): void {
  const records = getRecords();
  records.push({ josekiId, result, timestamp: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** "YYYY/MM/DD" in local time */
export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function recordDateString(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export type JosekiStats = {
  josekiId: string;
  totalSuccess: number;
  totalFailure: number;
  totalAttempts: number;
  clearedToday: boolean;
  successRate: number; // 0–1; NaN if no attempts
};

export function buildStats(
  josekiId: string,
  records: JosekiRecord[],
): JosekiStats {
  const mine = records.filter((r) => r.josekiId === josekiId);
  const today = todayString();
  const totalSuccess = mine.filter((r) => r.result === "success").length;
  const totalFailure = mine.filter((r) => r.result === "failure").length;
  const totalAttempts = mine.length;
  const clearedToday = mine.some(
    (r) =>
      r.result === "success" && recordDateString(r.timestamp) === today,
  );
  const successRate =
    totalAttempts > 0 ? totalSuccess / totalAttempts : Number.NaN;
  return {
    josekiId,
    totalSuccess,
    totalFailure,
    totalAttempts,
    clearedToday,
    successRate,
  };
}
