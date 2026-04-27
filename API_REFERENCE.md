# API Reference

Base URL: `http://localhost:5000/api`

All authenticated routes require a valid JWT token in httpOnly cookie.

## Authentication

### POST /auth/login
Login user and set JWT cookie.

**Request:**
```json
{
  "email": "admin@sankalpvillage.org",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Admin User",
    "email": "admin@sankalpvillage.org",
    "role": "admin",
    "assignedVillage": null
  }
}
```

### POST /auth/logout
Logout user and clear JWT cookie.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /auth/me
Get current logged-in user.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Admin User",
    "email": "admin@sankalpvillage.org",
    "role": "admin"
  }
}
```

---

## Users (Admin Only)

### GET /users
Get all users.

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [...]
}
```

### GET /users/:id
Get single user by ID.

### POST /users
Create new user.

**Request:**
```json
{
  "name": "New Volunteer",
  "email": "volunteer@example.com",
  "password": "password123",
  "role": "volunteer",
  "assignedVillage": "village_id"
}
```

### PUT /users/:id
Update user (password cannot be updated via this route).

### DELETE /users/:id
Delete user.

---

## Villages

### GET /villages
Get all villages with assigned volunteers.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "...",
      "name": "Rampur",
      "district": "Bareilly",
      "state": "Uttar Pradesh",
      "assignedVolunteers": [...]
    }
  ]
}
```

### GET /villages/:id
Get single village with gap detection data.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "Rampur",
    "lastSessionDate": "2026-04-15",
    "daysSinceLastSession": 12,
    "hasGap": false
  }
}
```

### POST /villages (Admin)
Create new village.

**Request:**
```json
{
  "name": "Village Name",
  "district": "District Name",
  "state": "State Name"
}
```

### PUT /villages/:id (Admin)
Update village.

### DELETE /villages/:id (Admin)
Delete village.

---

## Students

### GET /students
Get all students. Optional query param: `?village=village_id`

**Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "_id": "...",
      "name": "Aarav Singh",
      "village": {...},
      "grade": "Class 5",
      "enrollmentDate": "2025-01-15",
      "attendance": [...],
      "quizScores": [...]
    }
  ]
}
```

### GET /students/:id
Get single student.

### GET /students/:id/progress
Get detailed student progress with attendance percentage and topics covered.

**Response:**
```json
{
  "success": true,
  "data": {
    "student": {...},
    "attendance": {
      "sessionsAttended": 5,
      "totalSessions": 8,
      "percentage": 63
    },
    "topicsCovered": {
      "Math": [...],
      "English": [...]
    },
    "quizScores": [...],
    "recentSessions": [...]
  }
}
```

### POST /students
Create new student.

**Request:**
```json
{
  "name": "Student Name",
  "village": "village_id",
  "grade": "Class 5"
}
```

### PUT /students/:id
Update student.

### POST /students/:id/quiz-score
Add quiz score to student.

**Request:**
```json
{
  "subject": "Math",
  "topic": "Fractions",
  "score": 8,
  "maxScore": 10
}
```

### DELETE /students/:id (Admin)
Delete student.

---

## Sessions

### GET /sessions
Get all sessions. Optional query params:
- `?village=village_id`
- `?volunteer=volunteer_id`
- `?subject=Math`

**Response:**
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "_id": "...",
      "volunteer": {...},
      "village": {...},
      "date": "2026-04-15",
      "subject": "Math",
      "topicCovered": "Adding Fractions",
      "attendees": [...],
      "notes": "Great session..."
    }
  ]
}
```

### GET /sessions/:id
Get single session.

### GET /sessions/village/:villageId
Get all sessions for a specific village.

### GET /sessions/planner/:villageId
Get session planner data. Query params: `?subject=Math&grade=Class 5`

**Response:**
```json
{
  "success": true,
  "data": {
    "recentSessions": [...],
    "nextRecommendedTopic": {
      "order": 3,
      "title": "Subtracting Fractions",
      "description": "..."
    },
    "studentsMissedLastSession": [...]
  }
}
```

### POST /sessions
Create new session.

**Request:**
```json
{
  "volunteer": "volunteer_id",
  "village": "village_id",
  "date": "2026-04-27",
  "subject": "Math",
  "topicCovered": "Decimals",
  "attendees": ["student_id1", "student_id2"],
  "notes": "Optional notes..."
}
```

### PUT /sessions/:id
Update session.

### DELETE /sessions/:id (Admin)
Delete session.

---

## Syllabus

### GET /syllabus
Get all syllabi. Optional query params:
- `?subject=Math`
- `?grade=Class 5`

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "...",
      "subject": "Math",
      "grade": "Class 5",
      "topics": [
        {
          "order": 1,
          "title": "Introduction to Fractions",
          "description": "..."
        }
      ]
    }
  ]
}
```

### GET /syllabus/:id
Get single syllabus.

### POST /syllabus (Admin)
Create new syllabus.

**Request:**
```json
{
  "subject": "Math",
  "grade": "Class 5",
  "topics": [
    {
      "order": 1,
      "title": "Topic Title",
      "description": "Topic description"
    }
  ]
}
```

### PUT /syllabus/:id (Admin)
Update syllabus.

### DELETE /syllabus/:id (Admin)
Delete syllabus.

---

## Analytics

### GET /analytics/dashboard
Get dashboard statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVolunteers": 2,
    "totalVillages": 2,
    "totalStudents": 10,
    "sessionsThisMonth": 3,
    "villagesWithGaps": [
      {
        "id": "...",
        "name": "Village Name",
        "lastSessionDate": "2026-03-15",
        "daysSinceLastSession": 43
      }
    ]
  }
}
```

### GET /analytics/attendance
Get attendance analytics. Optional query params:
- `?villageId=village_id`
- `?startDate=2026-01-01`
- `?endDate=2026-04-30`

**Response:**
```json
{
  "success": true,
  "data": {
    "attendanceTrend": [
      {
        "date": "2026-03-15",
        "count": 4,
        "subject": "Math"
      }
    ],
    "avgAttendance": 4,
    "totalSessions": 6
  }
}
```

### GET /analytics/impact
Get impact analytics. Optional query params same as attendance.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSessions": 6,
    "totalStudents": 10,
    "topicsBySubject": {
      "Math": 3,
      "English": 2,
      "Science": 1
    },
    "improvements": {
      "Math": {
        "students": 2,
        "avgImprovement": 23.5
      }
    }
  }
}
```

---

## AI

### POST /ai/generate-notes
Generate teaching notes using OpenAI.

**Request:**
```json
{
  "topic": "Fractions",
  "grade": "Class 5",
  "subject": "Math"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "topic": "Fractions",
    "grade": "Class 5",
    "subject": "Math",
    "notes": "Generated lesson plan content...",
    "generatedAt": "2026-04-27T..."
  }
}
```

**Error Response (No API Key):**
```json
{
  "success": false,
  "message": "AI service not configured. Please add OPENAI_API_KEY to environment variables."
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error message here"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

---

## Authentication Flow

1. **Login:** POST to `/api/auth/login` with credentials
2. **JWT Cookie:** Server sets httpOnly cookie with JWT token
3. **Authenticated Requests:** Cookie automatically sent with subsequent requests
4. **Logout:** POST to `/api/auth/logout` to clear cookie

---

## Rate Limiting

Currently no rate limiting implemented. Consider adding for production:
- express-rate-limit for API endpoints
- Especially important for AI endpoint (OpenAI costs)

---

## CORS Configuration

Configured to accept requests from:
- `http://localhost:5173` (development)
- Can be configured via `CLIENT_URL` environment variable

Credentials (cookies) are enabled.
