import Link from 'next/link';
import type { CourseTemplate } from '@lambda/shared';

const SUBJECT_LABEL: Record<string, string> = {
  cs: 'Computer Science',
  math: 'Mathematics',
  other: 'Other',
};

const SUBJECT_BADGE: Record<string, string> = {
  cs: 'bg-indigo-50 text-indigo-700',
  math: 'bg-blue-50 text-blue-800',
  other: 'bg-gray-100 text-gray-600',
};

export function CourseCard({ course }: { course: CourseTemplate }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="block border border-gray-200 rounded-lg p-5 bg-white hover:border-[#6366F1] hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-[#1A365D]">{course.title}</h2>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${SUBJECT_BADGE[course.subject] ?? 'bg-gray-100 text-gray-600'}`}>
          {SUBJECT_LABEL[course.subject] ?? course.subject}
        </span>
      </div>
      {course.description && (
        <p className="mt-1.5 text-sm text-[#1A365D]/60 line-clamp-2">{course.description}</p>
      )}
    </Link>
  );
}
