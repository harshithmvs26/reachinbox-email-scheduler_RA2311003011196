import { format } from 'date-fns'; // We'll add date-fns later if not present, wait let's use native Date to avoid extra deps

export default function EmailsTable({ emails, type, loading }: { emails: any[], type: 'scheduled' | 'sent', loading: boolean }) {
  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading emails...</div>;
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-16">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No emails found</h3>
        <p className="text-gray-500">You don't have any {type} emails yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3">To Email</th>
            <th className="px-6 py-3">Subject</th>
            <th className="px-6 py-3">{type === 'scheduled' ? 'Scheduled For' : 'Sent At'}</th>
            <th className="px-6 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <tr key={email.id} className="border-b hover:bg-gray-50">
              <td className="px-6 py-4 font-medium">{email.toEmail}</td>
              <td className="px-6 py-4 truncate max-w-xs">{email.subject}</td>
              <td className="px-6 py-4">
                {new Date(type === 'scheduled' ? email.scheduledAt : email.sentAt).toLocaleString()}
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  email.status === 'SENT' ? 'bg-green-100 text-green-800' :
                  email.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {email.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
