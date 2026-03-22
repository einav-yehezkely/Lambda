'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCourseRequests, useFulfillCourseRequest, useRespondCourseRequest } from '@/hooks/useCourseRequests';
import { useCurrentUser } from '@/hooks/useUsers';
import { Modal } from '@/components/ui/modal';
import type { CourseRequest } from '@lambda/shared';

export default function AdminCourseRequestsPage() {
  const router = useRouter();
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const { data: requests, isLoading } = useCourseRequests();
  const fulfill = useFulfillCourseRequest();
  const respond = useRespondCourseRequest();

  // Fulfill modal state
  const [selected, setSelected] = useState<CourseRequest | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('cs');
  const [subjectCustom, setSubjectCustom] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  // Respond modal state
  const [respondTarget, setRespondTarget] = useState<CourseRequest | null>(null);
  const [respondMessage, setRespondMessage] = useState('');
  const [respondError, setRespondError] = useState('');

  useEffect(() => {
    if (!userLoading && !currentUser?.is_admin) {
      router.replace('/');
    }
  }, [userLoading, currentUser, router]);

  if (userLoading || !currentUser?.is_admin) return null;

  const openFulfill = (req: CourseRequest) => {
    setSelected(req);
    setTitle(req.course_name);
    const knownSubjects = ['cs', 'math'];
    if (req.subject && knownSubjects.includes(req.subject)) {
      setSubject(req.subject);
      setSubjectCustom('');
    } else if (req.subject) {
      setSubject('custom');
      setSubjectCustom(req.subject);
    } else {
      setSubject('cs');
      setSubjectCustom('');
    }
    setDescription(req.description ?? '');
    setFormError('');
  };

  const closeFulfillModal = () => {
    setSelected(null);
    setTitle(''); setSubject('cs'); setSubjectCustom(''); setDescription(''); setFormError('');
  };

  const openRespond = (req: CourseRequest) => {
    setRespondTarget(req);
    setRespondMessage('');
    setRespondError('');
  };

  const closeRespondModal = () => {
    setRespondTarget(null);
    setRespondMessage('');
    setRespondError('');
  };

  const handleFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!title.trim()) { setFormError('Title is required'); return; }
    const subj = subject === 'custom' ? subjectCustom.trim() : subject;
    if (!subj) { setFormError('Subject is required'); return; }
    setFormError('');
    try {
      const course = await fulfill.mutateAsync({
        id: selected.id,
        body: { title: title.trim(), subject: subj, description: description.trim() || undefined },
      });
      closeFulfillModal();
      router.push(`/courses/${course.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create course');
    }
  };

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondTarget) return;
    if (!respondMessage.trim()) { setRespondError('Message is required'); return; }
    setRespondError('');
    try {
      await respond.mutateAsync({ id: respondTarget.id, message: respondMessage.trim() });
      closeRespondModal();
    } catch (e) {
      setRespondError(e instanceof Error ? e.message : 'Failed to send response');
    }
  };

  const pending = requests?.filter((r) => r.status === 'pending') ?? [];
  const fulfilled = requests?.filter((r) => r.status === 'fulfilled') ?? [];

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Course Requests</h1>
        <p className="text-sm text-slate-500 mt-1">Review and fulfil course requests from users.</p>
      </div>

      {isLoading && <div className="text-sm text-gray-400">Loading...</div>}

      {!isLoading && pending.length === 0 && (
        <div className="text-sm text-gray-400">No pending requests.</div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3 mb-10">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Pending ({pending.length})</h2>
          {pending.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onFulfill={() => openFulfill(req)}
              onRespond={() => openRespond(req)}
            />
          ))}
        </div>
      )}

      {fulfilled.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Fulfilled ({fulfilled.length})</h2>
          {fulfilled.map((req) => (
            <RequestCard key={req.id} req={req} />
          ))}
        </div>
      )}

      {/* Fulfill / Create course modal */}
      {selected && (
        <Modal title={`Create course: "${selected.course_name}"`} onClose={closeFulfillModal}>
          <div className="mb-4 p-3 bg-slate-50 rounded-md text-sm text-slate-600 space-y-1">
            {selected.subject && <p><span className="font-medium">Subject:</span> {selected.subject}</p>}
            {selected.institution && <p><span className="font-medium">Institution:</span> {selected.institution}</p>}
            {selected.description && <p><span className="font-medium">Description:</span> {selected.description}</p>}
            {selected.notes && <p><span className="font-medium">Notes:</span> {selected.notes}</p>}
            <p><span className="font-medium">Requested by:</span> {selected.requester?.display_name ?? selected.requester?.username ?? '—'}</p>
          </div>
          <form onSubmit={handleFulfill} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course title *</label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                dir="auto"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Subject *</label>
              <div className="flex gap-2 mb-2">
                {[{ value: 'cs', label: 'Computer Science' }, { value: 'math', label: 'Mathematics' }, { value: 'custom', label: 'Other...' }].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSubject(s.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      subject === s.value
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {subject === 'custom' && (
                <input
                  type="text"
                  value={subjectCustom}
                  onChange={(e) => setSubjectCustom(e.target.value)}
                  placeholder="e.g. Physics, Biology..."
                  dir="auto"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional"
                dir="auto"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={closeFulfillModal} className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:border-gray-500">
                Cancel
              </button>
              <button type="submit" disabled={fulfill.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                {fulfill.isPending ? 'Creating...' : 'Create course & notify user'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Respond modal */}
      {respondTarget && (
        <Modal title={`Send response: "${respondTarget.course_name}"`} onClose={closeRespondModal}>
          <div className="mb-4 p-3 bg-slate-50 rounded-md text-sm text-slate-600">
            <p><span className="font-medium">Requested by:</span> {respondTarget.requester?.display_name ?? respondTarget.requester?.username ?? '—'}</p>
            {respondTarget.requester?.email && (
              <p className="text-xs text-slate-400 mt-0.5">{respondTarget.requester.email}</p>
            )}
          </div>
          <form onSubmit={handleRespond} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message to user *</label>
              <textarea
                autoFocus
                value={respondMessage}
                onChange={(e) => setRespondMessage(e.target.value)}
                rows={4}
                dir="auto"
                placeholder="e.g. This course already exists at..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>
            {respondError && <p className="text-sm text-red-500">{respondError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={closeRespondModal} className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:border-gray-500">
                Cancel
              </button>
              <button type="submit" disabled={respond.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                {respond.isPending ? 'Sending...' : 'Send response'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function RequestCard({
  req,
  onFulfill,
  onRespond,
}: {
  req: CourseRequest;
  onFulfill?: () => void;
  onRespond?: () => void;
}) {
  return (
    <div className={`border rounded-lg p-4 bg-white ${req.status === 'fulfilled' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 text-sm">{req.course_name}</p>
          <div className="mt-1 space-y-0.5 text-xs text-slate-500">
            {req.subject && <p>Subject: {req.subject}</p>}
            {req.institution && <p>Institution: {req.institution}</p>}
            {req.description && <p>{req.description}</p>}
            {req.notes && <p>Notes: {req.notes}</p>}
            <p>
              By {req.requester?.display_name ?? req.requester?.username ?? '—'}
              {req.requester?.email ? ` (${req.requester.email})` : ''}
              {' · '}{new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {req.status === 'fulfilled' ? (
            <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">Fulfilled</span>
          ) : (
            <div className="flex flex-col gap-1.5">
              {onFulfill && (
                <button
                  onClick={onFulfill}
                  className="text-xs px-3 py-1.5 bg-[#1e3a8a] text-white rounded-md hover:bg-blue-900 font-medium"
                >
                  Create course
                </button>
              )}
              {onRespond && (
                <button
                  onClick={onRespond}
                  className="text-xs px-3 py-1.5 border border-slate-300 text-slate-600 rounded-md hover:border-slate-500 font-medium"
                >
                  Send response
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
