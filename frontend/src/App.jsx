import React, { useState, useEffect, createContext, useContext, useReducer } from 'react';
import { 
  User, 
  Ticket, 
  Settings, 
  LogOut, 
  Plus, 
  Search, 
  Filter, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Eye,
  Edit,
  Trash2,
  Send,
  Bot,
  UserCheck,
  FileText,
  BarChart3,
  Calendar
} from 'lucide-react';

// API Configuration
const API_BASE = 'http://localhost:5000/api'

// Auth Context
const AuthContext = createContext(null);

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
      return {
        isAuthenticated: true,
        token: action.payload.token,
        user: action.payload.user,
        loading: false
      };
    case 'LOGOUT':
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return {
        isAuthenticated: false,
        token: null,
        user: null,
        loading: false
      };
    case 'LOADING':
      return { ...state, loading: true };
    case 'STOP_LOADING':
      return { ...state, loading: false };
    case 'INIT':
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      return {
        isAuthenticated: !!(token && user),
        token,
        user: user ? JSON.parse(user) : null,
        loading: false
      };
    default:
      return state;
  }
};

// API Helper
const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      ...options
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  },

  // Auth endpoints
  auth: {
    login: (credentials) => api.request('/auth/login', { method: 'POST', body: credentials }),
    register: (userData) => api.request('/auth/register', { method: 'POST', body: userData })
  },

  // KB endpoints
  kb: {
    search: (query = '', tags = [], status = '') => {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      if (tags.length) params.append('tags', tags.join(','));
      if (status) params.append('status', status);
      return api.request(`/kb?${params}`);
    },
    get: (id) => api.request(`/kb/${id}`),
    create: (article) => api.request('/kb', { method: 'POST', body: article }),
    update: (id, article) => api.request(`/kb/${id}`, { method: 'PUT', body: article }),
    delete: (id) => api.request(`/kb/${id}`, { method: 'DELETE' })
  },

  // Tickets endpoints
  tickets: {
    list: (filters = {}) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      return api.request(`/tickets?${params}`);
    },
    get: (id) => api.request(`/tickets/${id}`),
    create: (ticket) => api.request('/tickets', { method: 'POST', body: ticket }),
    reply: (id, reply) => api.request(`/tickets/${id}/reply`, { method: 'POST', body: reply }),
    assign: (id, assigneeId) => api.request(`/tickets/${id}/assign`, { method: 'POST', body: { assigneeId } }),
    reopen: (id) => api.request(`/tickets/${id}/reopen`, { method: 'POST' }),
    close: (id) => api.request(`/tickets/${id}/close`, { method: 'POST' })
  },

  // Agent endpoints
  agent: {
    triage: (ticketId) => api.request('/agent/triage', { method: 'POST', body: { ticketId } }),
    getSuggestion: (ticketId) => api.request(`/agent/suggestion/${ticketId}`),
    updateSuggestion: (suggestionId, draft) => 
      api.request(`/agent/suggestion/${suggestionId}`, { method: 'PUT', body: { draftReply: draft } }),
    retry: (ticketId) => api.request(`/agent/retry/${ticketId}`, { method: 'POST' }),
    stats: () => api.request('/agent/stats')
  },

  // Config endpoints
  config: {
    get: () => api.request('/config'),
    update: (config) => api.request('/config', { method: 'PUT', body: config })
  },

  // Audit endpoints
  audit: {
    getTicketLogs: (ticketId, params = {}) => {
      const query = new URLSearchParams(params);
      return api.request(`/audit/tickets/${ticketId}/audit?${query}`);
    },
    getSystemLogs: (params = {}) => {
      const query = new URLSearchParams(params);
      return api.request(`/audit/system?${query}`);
    }
  }
};

// Auth Provider Component
function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, {
    isAuthenticated: false,
    token: null,
    user: null,
    loading: true
  });

  useEffect(() => {
    dispatch({ type: 'INIT' });
  }, []);

  const login = async (credentials) => {
    try {
      dispatch({ type: 'LOADING' });
      const response = await api.auth.login(credentials);
      dispatch({ type: 'LOGIN', payload: response });
      return response;
    } catch (error) {
      dispatch({ type: 'STOP_LOADING' });
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: 'LOADING' });
      const response = await api.auth.register(userData);
      dispatch({ type: 'LOGIN', payload: response });
      return response;
    } catch (error) {
      dispatch({ type: 'STOP_LOADING' });
      throw error;
    }
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Utility Components
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

function ErrorMessage({ message, onDismiss }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
      <div className="flex justify-between">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <p className="text-sm text-red-800">{message}</p>
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-red-400 hover:text-red-600">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function SuccessMessage({ message, onDismiss }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
      <div className="flex justify-between">
        <div className="flex">
          <CheckCircle className="h-5 w-5 text-green-400" />
          <div className="ml-3">
            <p className="text-sm text-green-800">{message}</p>
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-green-400 hover:text-green-600">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// Auth Components
function LoginForm() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const { login, register, loading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isRegistering) {
        await register({ ...formData, name: formData.name || formData.email.split('@')[0] });
      } else {
        await login(formData);
      }
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isRegistering ? 'Create your account' : 'Sign in to your account'}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}
          
          <div className="rounded-md shadow-sm -space-y-px">
            {isRegistering && (
              <input
                type="text"
                placeholder="Full Name"
                className="relative block w-full px-3 py-2 border border-gray-300 rounded-t-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            )}
            <input
              type="email"
              required
              placeholder="Email address"
              className={`relative block w-full px-3 py-2 border border-gray-300 ${isRegistering ? '' : 'rounded-t-md'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <input
              type="password"
              required
              placeholder="Password"
              className="relative block w-full px-3 py-2 border border-gray-300 rounded-b-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isRegistering ? 'Sign up' : 'Sign in')}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-blue-600 hover:text-blue-500"
            >
              {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Layout Components
function Sidebar({ activeView, setActiveView }) {
  const { user, logout } = useAuth();

  const menuItems = [
    { key: 'tickets', label: 'Tickets', icon: Ticket, roles: ['user', 'agent', 'admin'] },
    { key: 'kb', label: 'Knowledge Base', icon: FileText, roles: ['user', 'agent', 'admin'] },
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['agent', 'admin'] },
    { key: 'settings', label: 'Settings', icon: Settings, roles: ['admin'] }
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="bg-gray-800 text-white w-64 min-h-screen p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold">Smart Helpdesk</h1>
        <p className="text-sm text-gray-400">Welcome, {user.name}</p>
        <p className="text-xs text-gray-500 capitalize">{user.role}</p>
      </div>

      <nav className="space-y-2">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key)}
              className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors ${
                activeView === item.key 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Icon className="h-5 w-5 mr-3" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-8">
        <button
          onClick={logout}
          className="w-full flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <LogOut className="h-5 w-5 mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

function Header({ title, actions }) {
  return (
    <div className="bg-white shadow-sm border-b px-6 py-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <div className="flex space-x-3">
          {actions}
        </div>
      </div>
    </div>
  );
}

// Ticket Components
function TicketList() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({});
  const { user } = useAuth();

  useEffect(() => {
    loadTickets();
  }, [filters]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await api.tickets.list(filters);
      setTickets(response.tickets);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      triaged: 'bg-yellow-100 text-yellow-800',
      waiting_human: 'bg-orange-100 text-orange-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="mb-6 flex gap-4">
        <select
          value={filters.status || ''}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="triaged">Triaged</option>
          <option value="waiting_human">Waiting Human</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={filters.category || ''}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          <option value="billing">Billing</option>
          <option value="tech">Technical</option>
          <option value="shipping">Shipping</option>
          <option value="other">Other</option>
        </select>

        {user.role !== 'user' && (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.my === 'true'}
              onChange={(e) => setFilters({ ...filters, my: e.target.checked ? 'true' : '' })}
              className="mr-2"
            />
            My Tickets
          </label>
        )}
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {tickets.length === 0 ? (
            <li className="p-6 text-center text-gray-500">No tickets found</li>
          ) : (
            tickets.map((ticket) => (
              <TicketItem key={ticket._id} ticket={ticket} />
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function TicketItem({ ticket }) {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      triaged: 'bg-yellow-100 text-yellow-800',
      waiting_human: 'bg-orange-100 text-orange-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <li className="px-6 py-4 hover:bg-gray-50 cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 truncate">{ticket.title}</h3>
              <div className="ml-2 flex-shrink-0 flex">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="mt-2 sm:flex sm:justify-between">
              <div className="sm:flex">
                <p className="flex items-center text-sm text-gray-500">
                  <User className="flex-shrink-0 mr-1.5 h-4 w-4" />
                  {ticket.createdBy?.name || 'Unknown'}
                </p>
                <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                  <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4" />
                  {formatDate(ticket.createdAt)}
                </p>
              </div>
              <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                <span className="capitalize">{ticket.category}</span>
                {ticket.replies && ticket.replies.length > 0 && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {ticket.replies.length} replies
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="ml-5 flex-shrink-0">
            <Eye className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </li>
      {showDetails && <TicketDetails ticketId={ticket._id} onClose={() => setShowDetails(false)} />}
    </>
  );
}

function TicketDetails({ ticketId, onClose }) {
  const [ticket, setTicket] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadTicketDetails();
  }, [ticketId]);

  const loadTicketDetails = async () => {
    try {
      setLoading(true);
      const [ticketData, suggestionData] = await Promise.allSettled([
        api.tickets.get(ticketId),
        user.role !== 'user' ? api.agent.getSuggestion(ticketId) : Promise.resolve(null)
      ]);

      if (ticketData.status === 'fulfilled') {
        setTicket(ticketData.value);
      }

      if (suggestionData.status === 'fulfilled' && suggestionData.value) {
        setSuggestion(suggestionData.value);
        if (user.role !== 'user' && suggestionData.value.draftReply) {
          setReplyContent(suggestionData.value.draftReply);
        }
      }
    } catch (error) {
      console.error('Error loading ticket details:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    if (!replyContent.trim()) return;

    try {
      setSending(true);
      await api.tickets.reply(ticketId, {
        content: replyContent,
        status: 'resolved'
      });
      setReplyContent('');
      await loadTicketDetails();
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (action, data = {}) => {
    try {
      switch (action) {
        case 'close':
          await api.tickets.close(ticketId);
          break;
        case 'reopen':
          await api.tickets.reopen(ticketId);
          break;
        case 'triage':
          await api.agent.triage(ticketId);
          break;
      }
      await loadTicketDetails();
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!ticket) return <div>Ticket not found</div>;

  return (
    <li className="px-6 py-4 bg-gray-50 border-t">
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-lg font-medium text-gray-900">{ticket.title}</h4>
            <p className="text-sm text-gray-600 mt-1">{ticket.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        {suggestion && user.role !== 'user' && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h5 className="font-medium text-blue-900 mb-2 flex items-center">
              <Bot className="h-4 w-4 mr-2" />
              AI Suggestion (Confidence: {Math.round(suggestion.confidence * 100)}%)
            </h5>
            <p className="text-sm text-blue-800 mb-2">
              Predicted Category: <span className="font-medium capitalize">{suggestion.predictedCategory}</span>
            </p>
            {suggestion.articleIds && suggestion.articleIds.length > 0 && (
              <p className="text-sm text-blue-800 mb-2">
                Referenced Articles: {suggestion.articleIds.length}
              </p>
            )}
          </div>
        )}

        {ticket.replies && ticket.replies.length > 0 && (
          <div className="space-y-3">
            <h5 className="font-medium text-gray-900">Conversation</h5>
            {ticket.replies.map((reply, index) => (
              <div key={index} className={`p-3 rounded-lg ${reply.isAgentGenerated ? 'bg-blue-50' : 'bg-white border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {reply.author?.name || 'System'}
                    {reply.isAgentGenerated && <span className="ml-2 text-xs text-blue-600">(AI Generated)</span>}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(reply.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{reply.content}</p>
              </div>
            ))}
          </div>
        )}

        {user.role !== 'user' && (
          <div className="space-y-3">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Type your reply..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
            <div className="flex justify-between">
              <div className="space-x-2">
                {ticket.status === 'open' && (
                  <button
                    onClick={() => handleAction('triage')}
                    className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                  >
                    Trigger Triage
                  </button>
                )}
                {['resolved', 'closed'].includes(ticket.status) && (
                  <button
                    onClick={() => handleAction('reopen')}
                    className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                  >
                    Reopen
                  </button>
                )}
                {!['closed'].includes(ticket.status) && (
                  <button
                    onClick={() => handleAction('close')}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Close
                  </button>
                )}
              </div>
              <button
                onClick={sendReply}
                disabled={sending || !replyContent.trim()}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function CreateTicketModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
      setFormData({ title: '', description: '', category: 'other' });
      onClose();
    } catch (error) {
      console.error('Error creating ticket:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Create New Ticket</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of the issue"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="billing">Billing</option>
              <option value="tech">Technical</option>
              <option value="shipping">Shipping</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Detailed description of the issue"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Knowledge Base Components
function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadArticles();
  }, [searchQuery]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const response = await api.kb.search(searchQuery);
      setArticles(response.articles);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createArticle = async (articleData) => {
    try {
      await api.kb.create(articleData);
      await loadArticles();
      setShowCreateModal(false);
    } catch (error) {
      setError(error.message);
    }
  };

  const updateArticle = async (id, articleData) => {
    try {
      await api.kb.update(id, articleData);
      await loadArticles();
      setSelectedArticle(null);
    } catch (error) {
      setError(error.message);
    }
  };

  const deleteArticle = async (id) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    
    try {
      await api.kb.delete(id);
      await loadArticles();
      setSelectedArticle(null);
    } catch (error) {
      setError(error.message);
    }
  };

  if (selectedArticle) {
    return (
      <ArticleEditor
        article={selectedArticle}
        onSave={updateArticle}
        onDelete={deleteArticle}
        onCancel={() => setSelectedArticle(null)}
        readOnly={user.role === 'user'}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {user.role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Article
          </button>
        )}
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid gap-4">
          {articles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No articles found
            </div>
          ) : (
            articles.map((article) => (
              <ArticleCard
                key={article._id}
                article={article}
                onClick={() => setSelectedArticle(article)}
                canEdit={user.role === 'admin'}
              />
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <ArticleModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={createArticle}
        />
      )}
    </div>
  );
}

function ArticleCard({ article, onClick, canEdit }) {
  const getStatusColor = (status) => {
    return status === 'published' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-lg shadow border hover:shadow-md cursor-pointer transition-shadow"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-900">{article.title}</h3>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(article.status)}`}>
          {article.status}
        </span>
      </div>
      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
        {article.body.substring(0, 150)}...
      </p>
      {article.tags && article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {article.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 text-xs text-gray-500">
        Updated: {new Date(article.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

function ArticleEditor({ article, onSave, onDelete, onCancel, readOnly }) {
  const [formData, setFormData] = useState({
    title: article?.title || '',
    body: article?.body || '',
    tags: article?.tags?.join(', ') || '',
    status: article?.status || 'draft'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const articleData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      };
      
      await onSave(article._id, articleData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-semibold">
          {readOnly ? 'View Article' : (article ? 'Edit Article' : 'New Article')}
        </h2>
        <div className="space-x-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {readOnly ? 'Back' : 'Cancel'}
          </button>
          {!readOnly && (
            <>
              {article && (
                <button
                  onClick={() => onDelete(article._id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={readOnly}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content
          </label>
          <textarea
            required
            rows={12}
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={readOnly}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="billing, payments, refunds"
            disabled={readOnly}
          />
        </div>

        {!readOnly && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        )}
      </form>
    </div>
  );
}

function ArticleModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    tags: '',
    status: 'draft'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const articleData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      };
      
      await onSubmit(articleData);
      setFormData({ title: '', body: '', tags: '', status: 'draft' });
      onClose();
    } catch (error) {
      console.error('Error creating article:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Create New Article</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <textarea
              required
              rows={8}
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="billing, payments, refunds"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Article'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Dashboard Components
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (user.role !== 'user') {
      loadStats();
    }
  }, [user.role]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.agent.stats();
      setStats(response);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (user.role === 'user') {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-gray-500">
          Dashboard access is restricted to agents and administrators.
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}
      
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Suggestions"
            value={stats.total}
            icon={<Bot className="h-6 w-6" />}
          />
          <StatCard
            title="Auto-Closed"
            value={stats.autoClosedTotal}
            subtitle={`${Math.round(stats.autoCloseRate * 100)}% rate`}
            icon={<CheckCircle className="h-6 w-6" />}
          />
          <StatCard
            title="Last 24 Hours"
            value={stats.last24Hours}
            icon={<Clock className="h-6 w-6" />}
          />
          <StatCard
            title="Avg Confidence"
            value={`${Math.round(stats.averageConfidence * 100)}%`}
            icon={<BarChart3 className="h-6 w-6" />}
          />
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium mb-4">Category Breakdown</h3>
            {stats.categoryBreakdown.map((category) => (
              <div key={category._id} className="flex justify-between items-center py-2">
                <span className="capitalize">{category._id}</span>
                <div className="text-right">
                  <span className="font-medium">{category.count}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({Math.round(category.avgConfidence * 100)}% avg)
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium mb-4">Confidence Distribution</h3>
            {stats.confidenceDistribution.map((bucket, index) => {
              const ranges = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
              return (
                <div key={index} className="flex justify-between items-center py-2">
                  <span>{ranges[index] || 'Other'}</span>
                  <span className="font-medium">{bucket.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            {icon}
          </div>
        </div>
        <div className="ml-4">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

// Settings Components
function SystemSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.config.get();
      setConfig(response);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      await api.config.update(config);
      setSuccess('Configuration saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (user.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-gray-500">
          Settings access is restricted to administrators.
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;
  if (!config) return <div>Failed to load configuration</div>;

  return (
    <div className="p-6">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold mb-6">System Configuration</h2>

        {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}
        {success && <SuccessMessage message={success} onDismiss={() => setSuccess('')} />}

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.autoCloseEnabled}
                onChange={(e) => setConfig({ ...config, autoCloseEnabled: e.target.checked })}
                className="mr-3"
              />
              <div>
                <div className="font-medium">Auto-Close Tickets</div>
                <div className="text-sm text-gray-500">
                  Automatically close tickets when AI confidence is above threshold
                </div>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Threshold
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.confidenceThreshold}
              onChange={(e) => setConfig({ ...config, confidenceThreshold: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>0%</span>
              <span className="font-medium">{Math.round(config.confidenceThreshold * 100)}%</span>
              <span>100%</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Tickets with AI confidence above this threshold will be auto-closed (if enabled)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SLA Hours
            </label>
            <input
              type="number"
              min="1"
              max="168"
              value={config.slaHours}
              onChange={(e) => setConfig({ ...config, slaHours: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Target response time in hours (1-168)
            </p>
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [activeView, setActiveView] = useState('tickets');
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { isAuthenticated, loading, user } = useAuth();

  const createTicket = async (ticketData) => {
    try {
      await api.tickets.create(ticketData);
      setSuccess('Ticket created successfully');
      setTimeout(() => setSuccess(''), 3000);
      setShowCreateTicket(false);
    } catch (error) {
      setError(error.message);
    }
  };

  const getHeaderActions = () => {
    const actions = [];
    
    if (activeView === 'tickets') {
      actions.push(
        <button
          key="create"
          onClick={() => setShowCreateTicket(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </button>
      );
    }
    
    return actions;
  };

  const getPageTitle = () => {
    const titles = {
      tickets: 'Tickets',
      kb: 'Knowledge Base',
      dashboard: 'Dashboard',
      settings: 'Settings'
    };
    return titles[activeView] || 'Smart Helpdesk';
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'tickets':
        return <TicketList />;
      case 'kb':
        return <KnowledgeBase />;
      case 'dashboard':
        return <Dashboard />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <TicketList />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={getPageTitle()} actions={getHeaderActions()} />
        
        <main className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4">
              <ErrorMessage message={error} onDismiss={() => setError('')} />
            </div>
          )}
          {success && (
            <div className="p-4">
              <SuccessMessage message={success} onDismiss={() => setSuccess('')} />
            </div>
          )}
          
          {renderActiveView()}
        </main>
      </div>

      <CreateTicketModal
        isOpen={showCreateTicket}
        onClose={() => setShowCreateTicket(false)}
        onSubmit={createTicket}
      />
    </div>
  );
}

export default function MainApp() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}