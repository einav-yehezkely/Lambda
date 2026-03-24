import Link from 'next/link';
import type { CourseTemplate, ActiveVersionProgress } from '@lambda/shared';

const HE_RE = /[\u0590-\u05FF]/;
const hDir = (s?: string | null): 'rtl' | undefined => HE_RE.test(s ?? '') ? 'rtl' : undefined;

const SUBJECT_LABEL: Record<string, string> = {
  cs: 'Computer Science',
  math: 'Mathematics',
};

function subjectLabel(subject: string) {
  return SUBJECT_LABEL[subject] ?? subject;
}

function subjectBadgeClass(subject: string) {
  if (subject === 'cs') return 'bg-[#1e3a8a]/10 text-[#1e3a8a] dark:bg-blue-900/30 dark:text-blue-300';
  if (subject === 'math') return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
}

interface CourseCardProps {
  course: CourseTemplate;
  progress?: ActiveVersionProgress;
}

export function CourseCard({ course, progress }: CourseCardProps) {
  const pct = progress && progress.total > 0
    ? Math.round((progress.solved / progress.total) * 100)
    : 0;

  return (
    <div className="glass-card rounded-xl overflow-hidden hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-slate-900/40 transition-all duration-300 group border border-slate-200 dark:border-slate-700 flex flex-col">
      <Link href={`/courses/${course.id}`} className="block p-5 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#1e3a8a] dark:group-hover:text-blue-400 transition-colors line-clamp-2"
            dir={hDir(course.title)}
          >
            {course.title}
          </h3>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${subjectBadgeClass(course.subject)}`}>
            {subjectLabel(course.subject)}
          </span>
        </div>
        {course.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2" dir={hDir(course.description)}>
            {course.description}
          </p>
        )}
      </Link>

      {progress && (
        <div className="px-5 pb-4 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{progress.solved} / {progress.total} solved</span>
            <span className="font-semibold text-[#1e3a8a]">{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1e3a8a] rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
