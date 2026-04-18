
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type MetricType = 'reps' | 'sets' | 'weight' | 'duration' | 'distance' | 'count';

export interface ExerciseMetric {
  type: MetricType;
  label: string;
  targetValue?: number;
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  description?: string;
  metrics: ExerciseMetric[];
  scheduledDays: DayOfWeek[];
}

export interface MetricValue {
  type: MetricType;
  value: number;
}

export interface ExerciseLog {
  id: string;
  templateId: string;
  date: string; // ISO string or YYYY-MM-DD
  metrics: MetricValue[];
  notes?: string;
  isScheduled: boolean;
}

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

export interface DailyHealth {
  date: string; // YYYY-MM-DD
  water: number; // glasses
  sleep: number; // hours
  sleepStart?: string; // ISO timestamp
  fastingStart?: string; // ISO timestamp
  fastingEnd?: string; // ISO timestamp
}

export interface AppSettings {
  showTooltips: boolean;
  waterGoal: number;
  sleepGoal: number;
  weight?: number; // kg
  height?: number; // cm
  age?: number;
  gender?: 'male' | 'female';
}
