# 🧪 Testing Guide - Event-Based System

## Quick Start

### 1. Start the Backend
```bash
cd server
npm run seed    # Seed with event-based data
npm run dev     # Start server on port 5000
```

### 2. Start the Frontend
```bash
cd client
npm run dev     # Start on port 5173
```

### 3. Access the Application
Open browser: `http://localhost:5173`

---

## 👤 Test Accounts

### Admin Account
- **Email:** `admin@sankalpvillage.org`
- **Password:** `admin123`
- **Access:** Full system access

### Volunteer Accounts
- **Email:** `priya@sankalpvillage.org`
- **Password:** `volunteer123`

- **Email:** `rahul@sankalpvillage.org`
- **Password:** `volunteer123`

---

## 🧪 Test Scenarios

### Scenario 1: Admin Creates Event

**Steps:**
1. Login as admin
2. Navigate to **Events** page
3. Click **Create Event** button
4. Fill in the form:
   - Title: "Weekend Learning Session"
   - Date: Select a Saturday or Sunday
   - Start Time: "10:00 AM"
   - End Time: "02:00 PM"
   - Description: "Math and Science classes"
5. Click **Create Event**

**Expected Results:**
- ✅ Event created successfully
- ✅ Redirected to Events list
- ✅ New event appears in the list
- ✅ Event has status badge "Upcoming"

**Verify:**
- Event has auto-generated QR code (format: EVENT-YYYYMMDD-XXXXXX)
- Event appears in Dashboard "Upcoming Events"

---

### Scenario 2: View Event QR Code

**Steps:**
1. Login as admin
2. Navigate to **Events** page
3. Click **View Details** on any event

**Expected Results:**
- ✅ Event details displayed
- ✅ Large QR code visible (256x256px)
- ✅ QR code text displayed below image
- ✅ Event information shown (date, time, description)
- ✅ Volunteers present list (initially empty)
- ✅ Teaching sessions list (initially empty)

**Verify:**
- QR code is clear and scannable
- Event details are accurate

---

### Scenario 3: Volunteer Check-In (Manual Entry)

**Steps:**
1. **As Admin:** Go to Event Details and copy the QR code (e.g., "EVENT-20260503-A7B9C2")
2. **Logout** and login as volunteer (`priya@sankalpvillage.org`)
3. Navigate to **Check In** page
4. Paste the QR code in the input field
5. Click **Check In**

**Expected Results:**
- ✅ Success message displayed
- ✅ Event details shown after check-in
- ✅ Redirected to Dashboard or stays on page

**Verify:**
- Go to **My Attendance** → Event appears in history
- Check-in time is recorded
- Check-in method shows "Manual" or "QR"

**As Admin:**
- Go back to Event Details
- Volunteer name appears in "Volunteers Present" list
- Check-in time is displayed

---

### Scenario 4: Log Teaching Session

**Steps:**
1. Login as volunteer (must be checked into an event first)
2. Navigate to **Log Session** page
3. Select the event you checked into
4. Fill in the form:
   - Subject: "Math"
   - Topic: "Fractions - Introduction"
   - Start Time: "10:00 AM"
   - End Time: "11:30 AM"
   - Select students present (checkboxes)
   - Notes: "Great session, students engaged"
5. Click **Log Session**

**Expected Results:**
- ✅ Session logged successfully
- ✅ Success message displayed
- ✅ Form resets

**Verify:**
- Go to Event Details → Session appears in "Teaching Sessions" list
- Student attendance recorded
- Session details are accurate

---

### Scenario 5: View Volunteer Attendance

**Steps:**
1. Login as volunteer
2. Navigate to **My Attendance** page

**Expected Results:**
- ✅ List of all events attended
- ✅ Attendance percentage displayed
- ✅ Check-in times shown
- ✅ Check-in methods shown (QR/Manual)

**Verify:**
- Attendance percentage calculation is correct
- Events are sorted by date (most recent first)
- All checked-in events appear

---

### Scenario 6: View Student List (No Village Filter)

**Steps:**
1. Login as admin or volunteer
2. Navigate to **Students** page

**Expected Results:**
- ✅ List of all students displayed
- ✅ No village filter present
- ✅ Columns: Name, Grade, Events Attended, Parent Phone, Enrollment Date
- ✅ "Events Attended" shows count

**Verify:**
- No village-related fields visible
- Parent phone field present
- Events attended count is accurate

---

### Scenario 7: Add New Student (No Village Assignment)

**Steps:**
1. Login as admin
2. Navigate to **Students** page
3. Click **Add Student** button
4. Fill in the form:
   - Name: "Test Student"
   - Grade: "Class 5"
   - Parent Phone: "+91 98765 43210"
5. Click **Add Student**

**Expected Results:**
- ✅ Student created successfully
- ✅ No village field in form
- ✅ Student appears in list
- ✅ Parent phone displayed

**Verify:**
- No village assignment required
- Student can be added without village

---

### Scenario 8: View Student Progress (Event-Based)

**Steps:**
1. Navigate to **Students** page
2. Click **View Progress** on any student

**Expected Results:**
- ✅ Student name and grade displayed (no village)
- ✅ Stats show: Events Attended, Subjects Covered, Quiz Scores
- ✅ Topics covered grouped by subject
- ✅ Each topic shows date covered
- ✅ Quiz scores displayed with subject and topic

**Verify:**
- No village reference in header
- Events attended count is accurate
- Topics are from teaching sessions

---

### Scenario 9: Manage Volunteers (No Village Assignment)

**Steps:**
1. Login as admin
2. Navigate to **Volunteers** page

**Expected Results:**
- ✅ List of all volunteers displayed
- ✅ No village assignment column
- ✅ Columns: Name, Email, Phone, Events Attended, Status
- ✅ All volunteers show "Active" status

**Verify:**
- No village-related fields visible
- Phone field present
- Events attended count displayed

---

### Scenario 10: Add New Volunteer (No Village Assignment)

**Steps:**
1. Login as admin
2. Navigate to **Volunteers** page
3. Click **Add Volunteer** button
4. Fill in the form:
   - Name: "Test Volunteer"
   - Email: "test@example.com"
   - Password: "test123"
   - Phone: "+91 98765 43210"
5. Click **Add Volunteer**

**Expected Results:**
- ✅ Volunteer created successfully
- ✅ No village assignment field in form
- ✅ Volunteer appears in list
- ✅ Phone number displayed

**Verify:**
- No village assignment required
- Volunteer can be added without village

---

### Scenario 11: View Analytics (Event-Based)

**Steps:**
1. Login as admin or volunteer
2. Navigate to **Analytics** page

**Expected Results:**
- ✅ Summary stats: Total Volunteers, Total Students, Events This Month
- ✅ Volunteer Attendance Trend chart (line chart)
- ✅ Events Per Month chart (bar chart)
- ✅ Teaching Sessions by Subject chart (bar chart)

**Verify:**
- Charts display event-based data
- No session-based analytics
- Data is accurate and up-to-date

---

### Scenario 12: Dashboard Overview

**Steps:**
1. Login as admin or volunteer
2. View **Dashboard** page

**Expected Results:**
- ✅ Upcoming events section
- ✅ Recent events section
- ✅ Event-based statistics
- ✅ Quick action buttons

**Verify:**
- No village-related stats
- Events are sorted correctly
- Stats are accurate

---

## 🐛 Known Issues to Test

### 1. QR Code Scanner (Not Implemented)
- **Current:** Manual entry only
- **Test:** Try to find camera scanner option
- **Expected:** Not available yet (placeholder only)

### 2. Event Editing (Not Implemented)
- **Current:** Edit button may be visible but non-functional
- **Test:** Click edit button on event
- **Expected:** Nothing happens or shows "Not implemented"

### 3. Manual Check-In Button (Not Implemented)
- **Current:** Admin cannot manually check in volunteers from Event Details
- **Test:** Look for manual check-in button in Event Details
- **Expected:** Button not present

---

## ✅ Success Criteria

The system passes testing if:

- [x] Admin can create events
- [x] QR codes are generated and displayed
- [x] Volunteers can check in (manual entry)
- [x] Volunteers can log teaching sessions
- [x] Attendance is tracked for volunteers
- [x] Students page has no village filter
- [x] Volunteers page has no village assignment
- [x] Analytics shows event-based data
- [x] Dashboard shows event-based stats
- [x] No console errors
- [x] Mobile responsive

---

## 🔍 Debugging Tips

### Backend Issues
```bash
# Check server logs
cd server
npm run dev

# Check database connection
# Look for "MongoDB connected" message

# Check API endpoints
curl http://localhost:5000/api/events
```

### Frontend Issues
```bash
# Check browser console for errors
# Open DevTools → Console

# Check network requests
# Open DevTools → Network tab

# Verify API calls
# Look for 200 status codes
```

### Common Issues

**Issue:** "Cannot read property of undefined"
- **Solution:** Check if data is loaded before rendering
- **Check:** Loading states in components

**Issue:** "401 Unauthorized"
- **Solution:** Login again, token may have expired
- **Check:** AuthContext and token storage

**Issue:** "QR code not working"
- **Solution:** Verify QR code format (EVENT-YYYYMMDD-XXXXXX)
- **Check:** Event model and QR generation logic

---

## 📱 Mobile Testing

### Test on Mobile Devices
1. Access app on mobile browser
2. Test QR code display (should be large and clear)
3. Test check-in flow (manual entry)
4. Test navigation (sidebar should work)
5. Test forms (should be touch-friendly)

### Expected Mobile Behavior
- ✅ QR codes display properly
- ✅ Forms are touch-friendly
- ✅ Tables scroll horizontally
- ✅ Cards stack vertically
- ✅ Navigation works smoothly

---

## 🎯 Performance Testing

### Load Testing
1. Create 10+ events
2. Add 20+ students
3. Add 10+ volunteers
4. Log 30+ teaching sessions
5. Check page load times

### Expected Performance
- ✅ Pages load in < 2 seconds
- ✅ No lag when scrolling
- ✅ Charts render smoothly
- ✅ Forms submit quickly

---

## 📊 Data Validation

### Check Data Integrity
1. Verify QR codes are unique
2. Verify attendance records are accurate
3. Verify teaching sessions are linked to events
4. Verify student attendance is tracked correctly

### SQL Queries (MongoDB)
```javascript
// Check events
db.events.find().pretty()

// Check volunteer attendance
db.users.find({ role: 'volunteer' }).pretty()

// Check student attendance
db.students.find().pretty()
```

---

## 🎉 Testing Complete!

Once all scenarios pass, the system is ready for:
- ✅ User acceptance testing
- ✅ Production deployment
- ✅ Real-world usage

---

**Happy Testing!** 🚀
