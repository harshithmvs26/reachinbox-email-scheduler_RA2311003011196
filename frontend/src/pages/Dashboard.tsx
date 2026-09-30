import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Bell, Search } from 'lucide-react';
import ComposeEmailModal from '../components/ComposeEmailModal';
import EmailsTable from '../components/EmailsTable';
import api from '../lib/api';

export default function Dashboard({ user }: { user: any }) {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEmails = async () => {
    setLoading(true);
    try {
      if (searchQuery) {
        const res = await api.get(`/emails/search?userId=${user.id}&q=${searchQuery}`);
        setEmails(res.data);
      } else {
        const res = await api.get(`/emails/${activeTab}?userId=${user.id}`);
        setEmails(res.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [activeTab, user.id, searchQuery]);

  const handleSlackConnect = () => {
    window.location.href = `http://localhost:5000/api/slack/connect?userId=${user.id}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      {searchParams.get('slack_connected') && (
        <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-6 flex justify-between items-center">
          Slack connected successfully! Rate limit notifications will be sent there.
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">Email Campaigns</h2>
        <div className="flex gap-4">
          <button 
            onClick={handleSlackConnect}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-md shadow-sm text-sm font-medium hover:bg-gray-50 text-gray-700"
          >
            <Bell size={16} />
            Connect Slack
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={16} />
            Compose New Email
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="border-b px-6 flex justify-between items-center">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'scheduled' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Scheduled Emails
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'sent' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sent / Failed Emails
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search emails..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="p-6">
          <EmailsTable emails={emails} type={activeTab} loading={loading} />
        </div>
      </div>

      {isModalOpen && (
        <ComposeEmailModal 
          user={user} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            fetchEmails();
          }} 
        />
      )}
    </div>
  );
}
