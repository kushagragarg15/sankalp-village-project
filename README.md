# Sankalp - Rural Education Management System

A comprehensive platform for managing volunteer-driven education programs in rural communities.

## Overview

Sankalp is a full-stack web application designed to coordinate weekend teaching volunteers, track student progress, and measure educational impact in rural villages. The platform streamlines event management, attendance tracking, and provides actionable analytics for program administrators.

## Features

### For Administrators
- **Dashboard**: Real-time overview of volunteers, students, and events
- **Event Management**: Create and manage weekend learning sessions with QR code check-in
- **Volunteer Management**: Track volunteer participation and attendance
- **Student Management**: Maintain student profiles and monitor progress
- **Analytics**: Visualize program impact with attendance trends and session metrics

### For Volunteers
- **QR Check-In**: Quick event check-in via QR code scanning
- **Session Logging**: Record teaching sessions with student attendance
- **Attendance History**: View personal participation records
- **Student Progress Tracking**: Monitor individual student development
- **Teaching Notes Generator**: Create structured lesson plans

## Tech Stack

**Frontend**
- React.js with React Router
- Tailwind CSS for styling
- Recharts for data visualization
- HTML5 QR code scanning

**Backend**
- Node.js with Express.js
- MongoDB with Mongoose ODM
- JWT authentication
- bcrypt password hashing

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd sankalps-village-project
```

2. **Configure environment variables**

Create a `.env` file in the `server` directory:
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/sankalp-village-project
JWT_SECRET=your_secure_jwt_secret_key
CLIENT_URL=http://localhost:5173
OPENAI_API_KEY=your_openai_api_key  # Optional
```

3. **Install dependencies**

Backend:
```bash
cd server
npm install
```

Frontend:
```bash
cd ../client
npm install
```

4. **Seed the database**
```bash
cd server
npm run seed
```

This creates sample data including admin and volunteer accounts, students, and sessions.

5. **Start the application**

Backend (from `server` directory):
```bash
npm run dev
```

Frontend (from `client` directory, in a new terminal):
```bash
npm run dev
```

6. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Demo Credentials

**Admin Account**
- Email: admin@sankalpvillage.org
- Password: admin123

**Volunteer Account**
- Email: priya@sankalpvillage.org
- Password: volunteer123

## Project Structure

```
sankalps-village-project/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── context/       # Authentication context
│   │   └── utils/         # API utilities
│   └── package.json
│
├── server/                # Express backend
│   ├── models/           # Database models
│   ├── controllers/      # Business logic
│   ├── routes/           # API endpoints
│   ├── middleware/       # Auth & error handling
│   └── server.js         # Entry point
│
└── README.md
```

## API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - List all users (Admin)
- `POST /api/users` - Create new user (Admin)

### Events
- `GET /api/events` - List all events
- `POST /api/events` - Create event (Admin)
- `GET /api/events/:id` - Get event details

### Students
- `GET /api/students` - List all students
- `POST /api/students` - Add new student
- `GET /api/students/:id/progress` - Get student progress

### Sessions
- `GET /api/sessions` - List teaching sessions
- `POST /api/sessions` - Log new session

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/impact` - Impact metrics

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for various platforms.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For questions or support, please open an issue in the repository.

---

Built to empower volunteer educators in rural communities.
