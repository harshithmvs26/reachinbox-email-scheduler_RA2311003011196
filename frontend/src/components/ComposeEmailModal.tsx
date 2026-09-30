import { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import api from '../lib/api';

export default function ComposeEmailModal({ user, onClose, onSuccess }: { user: any, onClose: () => void, onSuccess: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [delayMs, setDelayMs] = useState('2000');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please upload a CSV file with email addresses');
      return;
    }

    if (!subject || !body || !scheduledAt) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('userId', user.id);
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('scheduledAt', new Date(scheduledAt).toISOString());
    formData.append('delayMs', delayMs);
    formData.append('file', file);

    try {
      await api.post('/emails/schedule', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'An error occurred while scheduling');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-xl font-semibold">Compose Email Sequence</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input 
                type="text" 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500"
                placeholder="Exciting news from ReachInbox!"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
              <textarea 
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 h-32"
                placeholder="Hi there, ..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Sending At</label>
                <input 
                  type="datetime-local" 
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delay Between Emails (ms)</label>
                <input 
                  type="number" 
                  value={delayMs}
                  onChange={(e) => setDelayMs(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leads (CSV)</label>
              <div 
                className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:bg-gray-50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto text-gray-400 mb-2" size={24} />
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Click to upload a CSV file'}
                </span>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden" 
                  accept=".csv"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : 'Schedule Emails'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
