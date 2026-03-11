'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  useSolutions,
  useCreateSolution,
  useUpdateSolution,
  useDeleteSolution,
  useVoteSolution,
} from '@/hooks/useSolutions';
import { LatexContent } from './latex-content';
import { LatexEditor } from '@/components/ui/latex-editor';
import type { Solution } from '@lambda/shared';

function AuthorAvatar({ solution }: { solution: Solution }) {
  const author = solution.author;
  if (!author) return null;
  return author.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={author.avatar_url}
      alt={author.display_name ?? author.username}
      width={24}
      height={24}
      className="rounded-full object-cover shrink-0"
    />
  ) : (
    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-gray-500">
        {(author.display_name ?? author.username)[0].toUpperCase()}
      </span>
    </div>
  );
}

function SolutionRow({
  solution,
  contentItemId,
  currentUserId,
}: {
  solution: Solution;
  contentItemId: string;
  currentUserId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(solution.content);
  const updateSolution = useUpdateSolution();
  const deleteSolution = useDeleteSolution();
  const voteSolution = useVoteSolution();

  const isAuthor = currentUserId === solution.author_id;

  const handleVote = (vote: 1 | -1) => {
    if (!currentUserId) return;
    voteSolution.mutate({ id: solution.id, vote, contentItemId });
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    await updateSolution.mutateAsync({ id: solution.id, content: editContent.trim(), contentItemId });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this solution?')) return;
    await deleteSolution.mutateAsync({ id: solution.id, contentItemId });
  };

  return (
    <div className="border border-gray-100 rounded-lg p-4">
      {/* Author + meta */}
      <div className="flex items-center gap-2 mb-3">
        <AuthorAvatar solution={solution} />
        <div className="flex-1 min-w-0">
          {solution.author ? (
            <Link
              href={`/profile/${solution.author.username}`}
              className="text-xs font-semibold text-gray-700 hover:text-gray-900"
            >
              {solution.author.display_name ?? solution.author.username}
            </Link>
          ) : (
            <span className="text-xs text-gray-400">Unknown</span>
          )}
        </div>
        {/* Vote controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleVote(1)}
            disabled={!currentUserId || voteSolution.isPending}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 ${
              solution.user_vote === 1
                ? 'text-green-600 font-bold'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Upvote"
          >
            ▲
          </button>
          <span className={`text-xs font-semibold w-5 text-center ${
            solution.vote_count > 0 ? 'text-green-600' :
            solution.vote_count < 0 ? 'text-red-500' : 'text-gray-400'
          }`}>
            {solution.vote_count}
          </span>
          <button
            onClick={() => handleVote(-1)}
            disabled={!currentUserId || voteSolution.isPending}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 ${
              solution.user_vote === -1
                ? 'text-red-500 font-bold'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Downvote"
          >
            ▼
          </button>
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <div className="space-y-2">
          <LatexEditor value={editContent} onChange={setEditContent} rows={4} />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={updateSolution.isPending}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              {updateSolution.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditContent(solution.content); }}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:border-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-700 leading-relaxed">
          <LatexContent content={solution.content} />
        </div>
      )}

      {/* Author actions */}
      {isAuthor && !editing && (
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteSolution.isPending}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function CommunitySolutions({ contentItemId }: { contentItemId: string }) {
  const { user } = useAuth();
  const { data: solutions, isLoading } = useSolutions(contentItemId);
  const createSolution = useCreateSolution();
  const [showForm, setShowForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) { setFormError('Solution cannot be empty'); return; }
    setFormError('');
    try {
      await createSolution.mutateAsync({ content_item_id: contentItemId, content: newContent.trim() });
      setNewContent('');
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit solution');
    }
  };

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Community Solutions {solutions && solutions.length > 0 && `(${solutions.length})`}
        </h3>
        {user && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs text-gray-500 hover:text-gray-900 border border-gray-300 rounded px-2 py-0.5 hover:border-gray-500 transition-colors"
          >
            + Propose solution
          </button>
        )}
      </div>

      {/* Add solution form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 border border-dashed border-gray-300 rounded-lg p-3 space-y-2">
          <LatexEditor
            value={newContent}
            onChange={setNewContent}
            rows={4}
            placeholder="Write your solution... Use $...$ for inline LaTeX."
          />
          {formError && <p className="text-xs text-red-500">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createSolution.isPending}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              {createSolution.isPending ? 'Submitting...' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewContent(''); setFormError(''); }}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:border-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!user && (
        <p className="text-xs text-gray-400 mb-3">
          <Link href="/" className="underline hover:text-gray-600">Sign in</Link> to propose a solution.
        </p>
      )}

      {isLoading && <p className="text-xs text-gray-400">Loading...</p>}

      {!isLoading && (!solutions || solutions.length === 0) && (
        <p className="text-xs text-gray-400">No community solutions yet. Be the first!</p>
      )}

      {solutions && solutions.length > 0 && (
        <div className="space-y-2">
          {solutions.map((s) => (
            <SolutionRow
              key={s.id}
              solution={s}
              contentItemId={contentItemId}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
