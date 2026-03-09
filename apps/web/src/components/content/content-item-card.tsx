import type { VersionContentItem } from '@lambda/shared';
import { LatexContent } from './latex-content';

const TYPE_LABEL: Record<string, string> = {
  proof: 'Proof',
  exam_question: 'Exam',
  coding_question: 'Code',
};

const TYPE_COLOR: Record<string, string> = {
  proof: 'bg-purple-100 text-purple-700',
  exam_question: 'bg-blue-100 text-blue-700',
  coding_question: 'bg-orange-100 text-orange-700',
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'text-green-600',
  medium: 'text-yellow-600',
  hard: 'text-red-600',
};

export function ContentItemCard({ item }: { item: VersionContentItem }) {
  const { content_item } = item;

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-gray-900 text-sm">
          <LatexContent content={content_item.title} />
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {content_item.difficulty && (
            <span className={`text-xs font-medium ${DIFFICULTY_COLOR[content_item.difficulty]}`}>
              {content_item.difficulty}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[content_item.type]}`}>
            {TYPE_LABEL[content_item.type]}
          </span>
        </div>
      </div>

      <div className="mt-2 text-sm text-gray-600">
        <LatexContent content={content_item.content} />
      </div>

      {content_item.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {content_item.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
