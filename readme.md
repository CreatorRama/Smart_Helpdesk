# Smart Helpdesk - Full-Stack Agentic Triage System

A complete helpdesk solution with AI-powered ticket triage, featuring a Node.js/Express backend with MongoDB and a React frontend. The system provides intelligent ticket classification, knowledge base retrieval, automated replies, and comprehensive role-based user management.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  React Frontend (Port 3000)                │
│  ┌─────────────────┬───────────────────┬─────────────────┐  │
│  │   Auth Views    │   Ticket Views    │   Admin Views   │  │
│  │  Login/Register │  List/Details/    │   KB/Settings/  │  │
│  │                 │  Create/Reply     │   Dashboard     │  │
│  └─────────────────┴───────────────────┴─────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     Express API Gateway                     │
├─────────────────────┬───────────────────┬───────────────────┤
│   Auth & Users      │   Tickets & KB    │   Agent Service   │
├─────────────────────┼───────────────────┼───────────────────┤
│                     MongoDB Database                        │
├─────────────────────────────────────────────────────────────┤
│              LLM Service (DeepSeek/Stub)                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Components:

**Backend:**
- **Express API Gateway**: RESTful API with role-based authentication
- **MongoDB**: Document database with optimized indexes
- **Agent Service**: Agentic workflow for ticket triage
- **LLM Service**: DeepSeek integration with fallback to rule-based stub
- **Audit System**: Comprehensive logging with trace IDs

**Frontend:**
- **React SPA**: Modern responsive interface with hooks and context
- **Role-Based UI**: Dynamic interface based on user permissions
- **Real-time Updates**: Live ticket status and reply updates
- **Responsive Design**: Mobile-friendly with Tailwind CSS
- **Component Architecture**: Modular, reusable UI components

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- MongoDB (if running locally)

### Full Stack Setup (Recommended)

1. **Clone and setup backend**:
```bash
git clone <repository>
cd backend
cp .env.example .env
```

2. **Configure backend environment** (edit `.env`):
```env
JWT_SECRET=your-super-secret-jwt-key-here
DEEPSEEK_API_KEY=your-deepseek-api-key  # optional
STUB_MODE=true  # set false to use DeepSeek
AUTO_CLOSE_ENABLED=true
CONFIDENCE_THRESHOLD=0.78
PORT=8080  # Backend port
FRONTEND_URL=http://localhost:5173  # Frontend URL for CORS
```

3. **Start backend services**:
```bash
docker-compose up -d
```

4. **Seed database**:
```bash
docker-compose exec api npm run seed
```

5. **Setup frontend**:
```bash
cd ../frontend  # or wherever your frontend is
npm install
```

6. **Configure frontend** (create `.env.local`):
```env
REACT_APP_API_BASE=http://localhost:5000/api
```

7. **Start frontend**:
```bash
npm start
```

8. **Access the application**:
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000/api`

### Development Setup

**Backend Development:**
```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev  # Starts on port 8080
```

**Frontend Development:**
```bash
# Terminal 2 - Frontend
cd frontend
npm install
npm run dev   # Starts on port 3000
```

## 🎨 Frontend Architecture

### Technology Stack
- **React 18**: Modern hooks-based architecture
- **Lucide React**: Icon library for consistent UI
- **Tailwind CSS**: Utility-first styling
- **Context API**: State management for auth and global state
- **Local Storage**: Token persistence and user session

### Component Structure
```
src/
├── App.js                    # Main application component
├── components/
│   ├── Auth/
│   │   ├── LoginForm.js      # Authentication form
│   │   ├── AuthProvider.js   # Auth context provider
│   │   └── useAuth.js        # Auth hook
│   ├── Layout/
│   │   ├── Sidebar.js        # Navigation sidebar
│   │   ├── Header.js         # Page header
│   │   └── LoadingSpinner.js # Loading indicator
│   ├── Tickets/
│   │   ├── TicketList.js     # Ticket listing with filters
│   │   ├── TicketItem.js     # Individual ticket card
│   │   ├── TicketDetails.js  # Detailed ticket view
│   │   └── CreateTicketModal.js # New ticket form
│   ├── KnowledgeBase/
│   │   ├── KnowledgeBase.js  # KB main view
│   │   ├── ArticleCard.js    # Article preview card
│   │   ├── ArticleEditor.js  # Article create/edit form
│   │   └── ArticleModal.js   # New article modal
│   ├── Dashboard/
│   │   ├── Dashboard.js      # Analytics dashboard
│   │   └── StatCard.js       # Statistics display card
│   ├── Settings/
│   │   └── SystemSettings.js # Admin configuration
│   └── Common/
│       ├── ErrorMessage.js   # Error display component
│       └── SuccessMessage.js # Success notification
```

### State Management
- **Auth Context**: Global authentication state and user info
- **Local State**: Component-specific state with useState/useReducer
- **API Integration**: Centralized API service with error handling
- **LocalStorage**: Persistent token storage and user preferences

### Responsive Design
- **Mobile First**: Designed for mobile devices, enhanced for desktop
- **Breakpoint System**: Tailwind's responsive utilities
- **Flexible Layouts**: CSS Grid and Flexbox for adaptive layouts
- **Touch Friendly**: Optimized for touch interactions

## 🔧 API Integration

### API Configuration
```javascript
const API_BASE = 'http://localhost:5000/api'  // Configurable base URL

// Centralized API client with authentication
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
    // ... error handling and response parsing
  }
}
```

### Frontend API Endpoints

**Authentication:**
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

**Tickets:**
- `GET /api/tickets` - List tickets with filtering
- `POST /api/tickets` - Create new ticket (triggers auto-triage)
- `GET /api/tickets/:id` - Get ticket details with replies
- `POST /api/tickets/:id/reply` - Add reply to ticket
- `POST /api/tickets/:id/assign` - Assign ticket to agent
- `POST /api/tickets/:id/reopen` - Reopen closed ticket
- `POST /api/tickets/:id/close` - Close ticket

**Knowledge Base:**
- `GET /api/kb` - Search articles with query/tags/status filters
- `POST /api/kb` - Create new article (admin only)
- `PUT /api/kb/:id` - Update article (admin only)
- `DELETE /api/kb/:id` - Delete article (admin only)

**Agent Operations:**
- `POST /api/agent/triage` - Manual triage trigger
- `GET /api/agent/suggestion/:ticketId` - Get AI suggestion for ticket
- `PUT /api/agent/suggestion/:id` - Update AI suggestion
- `POST /api/agent/retry/:ticketId` - Retry failed triage
- `GET /api/agent/stats` - Dashboard statistics

**Configuration:**
- `GET /api/config` - Get system configuration
- `PUT /api/config` - Update system settings (admin only)

## 👥 User Roles & Features

### User Role
**Accessible Views:** Tickets, Knowledge Base
**Features:**
- Create and view own tickets
- Search knowledge base articles
- View ticket status and replies
- Basic dashboard with personal stats

### Agent Role
**Accessible Views:** Tickets, Knowledge Base, Dashboard
**Features:**
- View all tickets (filtered and unfiltered)
- Reply to tickets and change status
- Assign tickets to other agents
- Trigger manual triage
- Edit AI-generated suggestions
- View analytics dashboard
- Full knowledge base access

### Admin Role
**Accessible Views:** All views including Settings
**Features:**
- All agent features
- Create/edit/delete knowledge base articles
- Configure system settings
- Manage auto-close thresholds
- View comprehensive analytics
- System configuration access

## 🎯 Key Frontend Features

### Authentication System
```javascript
// JWT-based authentication with persistent login
const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // Auto-restore session on app load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      dispatch({ type: 'INIT', payload: { token, user: JSON.parse(user) } });
    }
  }, []);
};
```

### Real-Time Ticket Updates
- Automatic refresh of ticket lists
- Live status updates
- Real-time reply notifications
- Dynamic UI state management

### Smart Filtering System
```javascript
// Multi-dimensional ticket filtering
const [filters, setFilters] = useState({
  status: '',      // open, triaged, waiting_human, resolved, closed
  category: '',    // billing, tech, shipping, other
  my: '',          // show only assigned tickets
  search: ''       // text search
});
```

### AI Integration Display
- **Confidence Scores**: Visual confidence indicators
- **AI Suggestions**: Editable AI-generated replies
- **Category Prediction**: Automatic categorization with confidence
- **Knowledge Base Integration**: Referenced articles in suggestions

### Responsive Ticket Management
- **Create Modal**: Inline ticket creation
- **Expandable Details**: Click-to-expand ticket views
- **Status Management**: Visual status indicators
- **Reply Threading**: Conversation-style reply display

### Knowledge Base Features
- **Full-Text Search**: Real-time article search
- **Tag-Based Filtering**: Organize articles by tags
- **WYSIWYG Editor**: Rich text article editing
- **Draft/Published States**: Article publication workflow

### Dashboard Analytics
- **Real-Time Stats**: Live triage statistics
- **Category Breakdown**: Visual category distribution
- **Confidence Analysis**: AI performance metrics
- **Auto-Close Rates**: Efficiency indicators

## 🛡️ Frontend Security Features

- **JWT Token Management**: Secure token storage and refresh
- **Route Protection**: Role-based view access control
- **API Error Handling**: Comprehensive error management
- **XSS Protection**: Safe content rendering
- **Input Sanitization**: Form data validation
- **CORS Configuration**: Proper cross-origin setup

## 🎨 UI/UX Design System

### Color Scheme
```javascript
// Tailwind-based color system
const statusColors = {
  open: 'bg-blue-100 text-blue-800',
  triaged: 'bg-yellow-100 text-yellow-800',
  waiting_human: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800'
};
```

### Typography Scale
- **Headers**: text-xl to text-3xl font weights
- **Body Text**: text-sm to text-base
- **Labels**: text-xs to text-sm with medium weight
- **Interactive Elements**: Consistent sizing and spacing

### Interactive States
- **Hover Effects**: Subtle color transitions
- **Active States**: Clear visual feedback
- **Disabled States**: Reduced opacity with cursor changes
- **Loading States**: Spinner animations and skeleton screens

### Responsive Breakpoints
- **Mobile**: < 640px - Stack layouts, full-width components
- **Tablet**: 640px - 1024px - Adaptive grids, collapsible sidebars
- **Desktop**: > 1024px - Multi-column layouts, expanded features

## 🧪 Testing Strategy

### Backend Testing
```bash
# Run all backend tests
npm test

# Run specific test suites
npm test -- --testPathPattern=auth
npm test -- --testPathPattern=tickets
npm test -- --testPathPattern=agent

# Integration testing
node scripts/test-api.js
```

### Frontend Testing Setup
```bash
# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom

# Run frontend tests
npm test

# Run with coverage
npm test -- --coverage --watchAll=false
```

### Test Coverage Areas
- **Authentication Flow**: Login/logout/registration
- **Ticket Management**: CRUD operations and status changes
- **Knowledge Base**: Article management and search
- **Role-Based Access**: Permission verification
- **API Integration**: Request/response handling
- **Error Handling**: Error state management

## 📱 Mobile Responsiveness

### Mobile-First Design
- **Touch-Optimized**: Minimum 44px touch targets
- **Readable Typography**: Adequate font sizes and line spacing
- **Simplified Navigation**: Collapsible sidebar, bottom navigation
- **Optimized Forms**: Large input fields, clear labels

### Tablet Optimization
- **Adaptive Layouts**: Grid systems that reflow
- **Enhanced Touch**: Hover states adapted for touch
- **Landscape Support**: Optimal use of screen real estate

### Desktop Enhancements
- **Multi-Column Layouts**: Efficient information density
- **Keyboard Navigation**: Full keyboard accessibility
- **Advanced Interactions**: Hover effects, tooltips

## 🔄 Backend Integration

### Agentic Workflow Integration
The frontend seamlessly integrates with the backend's AI-powered triage system:

1. **Ticket Creation**: User creates ticket → Backend triggers auto-triage
2. **AI Processing**: Backend classifies and suggests responses
3. **Agent Review**: Frontend displays AI suggestions with confidence scores
4. **Decision Making**: Agent can accept, edit, or override AI suggestions
5. **Status Updates**: Real-time status changes reflected in UI

### Knowledge Base Sync
- **Real-Time Search**: Frontend search queries backend KB index
- **Article References**: AI suggestions include linked KB articles
- **Content Management**: Admin interface for KB article lifecycle

## 🚨 Error Handling & User Experience

### Error Management
```javascript
// Centralized error handling
const ErrorMessage = ({ message, onDismiss }) => (
  <div className="bg-red-50 border border-red-200 rounded-md p-4">
    <div className="flex justify-between">
      <div className="flex">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <div className="ml-3">
          <p className="text-sm text-red-800">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600">×</button>
      )}
    </div>
  </div>
);
```

### Loading States
- **Spinner Animations**: Consistent loading indicators
- **Skeleton Screens**: Content placeholders during loading
- **Progressive Enhancement**: Graceful degradation for slow networks

### Success Feedback
- **Toast Notifications**: Non-intrusive success messages
- **Status Indicators**: Visual confirmation of actions
- **Auto-Dismiss**: Timed notification removal

## 🌍 Environment Configuration

### Frontend Environment Variables
```env
# .env.local
REACT_APP_API_BASE=http://localhost:5000/api
REACT_APP_APP_NAME=Smart Helpdesk
REACT_APP_VERSION=1.0.0
REACT_APP_SUPPORT_EMAIL=support@helpdesk.local
```

### Backend Environment Variables
```env
# .env
NODE_ENV=development
PORT=8080
MONGO_URI=mongodb://localhost:27017/helpdesk
JWT_SECRET=your-super-secret-jwt-key-here
AUTO_CLOSE_ENABLED=true
CONFIDENCE_THRESHOLD=0.78
STUB_MODE=true
DEEPSEEK_API_KEY=your-deepseek-api-key
FRONTEND_URL=http://localhost:3000
```

## 📁 Complete Project Structure

```
smart-helpdesk/
├── backend/
│   ├── server.js                 # Main application entry
│   ├── models/                   # MongoDB schemas
│   │   └── index.js             # User, Ticket, Article, etc.
│   ├── routes/                   # API route handlers  
│   │   ├── auth.js              # Authentication
│   │   ├── tickets.js           # Ticket operations
│   │   ├── kb.js                # Knowledge base
│   │   ├── agent.js             # Agent operations
│   │   ├── config.js            # System configuration
│   │   └── audit.js             # Audit logs
│   ├── services/                 # Business logic
│   │   ├── agentService.js      # Main agentic workflow
│   │   └── llmService.js        # LLM provider & KB search
│   ├── middleware/              # Express middleware
│   │   └── auth.js              # Authentication & authorization
│   ├── scripts/                 # Utility scripts
│   │   ├── seed.js              # Database seeding
│   │   ├── test-api.js          # API testing
│   │   └── mongo-init.js        # Docker MongoDB setup
│   ├── tests/                   # Test suites
│   │   ├── setup.js             # Test configuration
│   │   ├── auth.test.js         # Auth tests
│   │   ├── kb.test.js           # Knowledge base tests
│   │   ├── tickets.test.js      # Ticket tests
│   │   └── agent.test.js        # Agent workflow tests
│   ├── docker-compose.yml       # Multi-service setup
│   ├── Dockerfile              # Container definition
│   └── package.json            # Dependencies & scripts
│
├── frontend/
│   ├── public/
│   │   ├── index.html           # HTML template
│   │   └── favicon.ico          # App icon
│   ├── src/
│   │   ├── App.js               # Main React component
│   │   ├── index.js             # React app entry point
│   │   ├── components/          # React components
│   │   │   ├── Auth/            # Authentication components
│   │   │   ├── Layout/          # Layout components
│   │   │   ├── Tickets/         # Ticket management
│   │   │   ├── KnowledgeBase/   # KB components
│   │   │   ├── Dashboard/       # Analytics components
│   │   │   ├── Settings/        # Admin settings
│   │   │   └── Common/          # Shared components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API integration
│   │   ├── utils/               # Utility functions
│   │   └── styles/              # CSS files
│   ├── package.json            # Frontend dependencies
│   └── tailwind.config.js      # Tailwind configuration
│
└── docs/
    ├── api-documentation.md    # API endpoint docs
    ├── deployment-guide.md     # Production deployment
    └── user-manual.md          # End-user documentation
```

## 🎯 Test Accounts

After seeding, these accounts are available for testing:

| Role | Email | Password | Frontend Access |
|------|-------|----------|-----------------|
| Admin | `admin@helpdesk.local` | `admin123` | All features + Settings |
| Agent | `agent@helpdesk.local` | `agent123` | Tickets + KB + Dashboard |
| User | `user@helpdesk.local` | `user123` | Tickets + KB (read-only) |

## 🚀 Production Deployment

### Frontend Deployment (Static Hosting)
```bash
# Build for production
npm run build

# Deploy to static hosting (Netlify, Vercel, etc.)
# Configure environment variables in hosting platform
REACT_APP_API_BASE=https://your-api-domain.com/api
```

### Backend Deployment (Container-based)
```bash
# Build and deploy with Docker
docker-compose -f docker-compose.prod.yml up -d

# Or deploy to cloud platforms (AWS, GCP, Azure)
# Configure production environment variables
```

### Database Deployment
- **MongoDB Atlas**: Cloud-hosted MongoDB
- **Self-hosted**: MongoDB replica set for high availability
- **Backup Strategy**: Automated backups with point-in-time recovery

## 📈 Performance Optimization

### Frontend Optimization
- **Code Splitting**: React.lazy() for route-based splitting
- **Image Optimization**: Optimized asset delivery
- **Bundle Analysis**: Webpack bundle analyzer
- **Caching Strategy**: Service worker implementation

### Backend Optimization
- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: Efficient database connections
- **Caching Layer**: Redis for session and data caching
- **Load Balancing**: Horizontal scaling support

## 🔧 Development Tips

### Frontend Development
```bash
# Start with hot reload
npm start

# Lint and format code
npm run lint
npm run format

# Build and analyze bundle
npm run build
npm run analyze
```

### Adding New Features
1. **Create Component**: Add to appropriate directory
2. **Update Routes**: Modify App.js routing
3. **API Integration**: Add to api service object
4. **State Management**: Update context if needed
5. **Testing**: Add component and integration tests

### Styling Guidelines
- Use Tailwind utility classes
- Follow mobile-first responsive design
- Maintain consistent color scheme
- Ensure accessibility compliance

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes to both frontend and backend as needed
4. Test thoroughly (unit and integration tests)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

### Code Standards
- **Frontend**: ESLint + Prettier configuration
- **Backend**: Node.js best practices
- **Documentation**: Update README for new features
- **Testing**: Maintain test coverage above 80%

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Ready to build the future of customer support?** This full-stack system combines the power of AI-driven automation with intuitive user experience design. Deploy locally for development or scale to production with confidence! 🚀

### Quick Links
- 🎮 **Frontend Demo**: http://localhost:5173
- 🔧 **Backend API**: http://localhost:5000/api
- 📊 **Health Check**: http://localhost:5000/healthz
- 📚 **API Docs**: http://localhost:5000/api-docs (if enabled)
- 🐛 **Issues**: Report bugs and feature requests
- 💬 **Discussions**: Community support and ideas