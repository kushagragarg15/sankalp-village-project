# User Management Scripts

This folder contains scripts to manage users and their roles in the Sankalp Village Project.

## Available Scripts

### 1. List Users
View all users in the database with their roles.

```bash
npm run list-users
```

**Output:**
```
=== Current Users in Database ===

1. KUSHAGRA GARG
   Email: 23ucc564@lnmiit.ac.in
   Role: admin
   Google ID: Yes

Total users: 5
```

---

### 2. Manage Roles (Interactive)
Interactive menu to manage user roles. Best for multiple changes.

```bash
npm run manage-roles
```

**Features:**
- List all users
- Change user role by email
- Quick make admin
- Quick make volunteer
- User-friendly menu interface

**Example Session:**
```
╔════════════════════════════════════╗
║   USER ROLE MANAGEMENT TOOL        ║
╚════════════════════════════════════╝

1. List all users
2. Change user role by email
3. Make user admin
4. Make user volunteer
5. Exit

Select an option (1-5): 3
Enter user email to make admin: test@example.com
✅ Successfully updated Test User
   volunteer → admin
```

---

### 3. Quick Role Change (Command Line)
Fast one-line command to change a user's role. Best for single changes.

```bash
npm run change-role <email> <role>
```

**Examples:**
```bash
# Make user an admin
npm run change-role test@example.com admin

# Make user a volunteer
npm run change-role user@gmail.com volunteer
```

**Output:**
```
✅ Connected to MongoDB
✅ Successfully updated Test User
   Email: test@example.com
   Role: volunteer → admin
```

---

### 4. Create Test Volunteers
Create test volunteer accounts with passwords for easy testing.

```bash
npm run create-test-volunteers
```

**Creates 5 test accounts:**
- volunteer1@gmail.com
- volunteer2@gmail.com
- volunteer3@gmail.com
- john.volunteer@gmail.com
- jane.volunteer@gmail.com

**Password for all:** `volunteer123`

**Output:**
```
✅ Created: Test Volunteer 1 (volunteer1@gmail.com)
✅ Created: Test Volunteer 2 (volunteer2@gmail.com)
...
🔐 Login Credentials:
   Email: volunteer1@gmail.com
   Password: volunteer123 (for all accounts)
```

**Note:** If accounts already exist, they will be skipped.

---

### 5. Create Test Students
Create dummy student data for testing the attendance system.

```bash
npm run create-test-students
```

**Creates 26 test students:**
- Grade 1: 3 students
- Grade 2: 3 students
- Grade 3: 4 students
- Grade 4: 3 students
- Grade 5: 4 students
- Grade 6: 3 students
- Grade 7: 3 students
- Grade 8: 3 students

**Output:**
```
✅ Created: Aarav Kumar (Grade 1)
✅ Created: Diya Sharma (Grade 1)
...
📊 Summary:
   Created: 26 students
```

**Note:** If students already exist, they will be skipped.

---

### 6. Create All Test Data
Create both test volunteers and students in one command.

```bash
npm run create-test-data
```

This runs both `create-test-volunteers` and `create-test-students` sequentially.

---

### 7. Clear All Data
⚠️ **WARNING:** This deletes ALL data from the database!

```bash
npm run clear-data
```

---

## Role Types

- **admin**: Full access to all features
  - Manage sessions
  - View all volunteers
  - View analytics
  - Manage students

- **volunteer**: Limited access
  - Register for sessions
  - Submit attendance
  - View students
  - View own analytics

---

## Automatic Role Assignment

When users sign in with Google, roles are automatically assigned based on email:

- Emails starting with `23` or `24` → **admin**
- Emails starting with `25` or `26` → **volunteer**
- All other emails → **volunteer** (default)

You can override these automatic assignments using the scripts above.

---

## Testing Workflow

1. **List current users:**
   ```bash
   npm run list-users
   ```

2. **Change a user to volunteer for testing:**
   ```bash
   npm run change-role 23ucc564@lnmiit.ac.in volunteer
   ```

3. **Change back to admin:**
   ```bash
   npm run change-role 23ucc564@lnmiit.ac.in admin
   ```

---

## Troubleshooting

**Error: "User not found"**
- Make sure the user has signed in at least once
- Check the email spelling

**Error: "Cannot connect to MongoDB"**
- Ensure MongoDB is running
- Check your `.env` file has correct `MONGO_URI`

**Error: "Invalid role"**
- Role must be exactly `admin` or `volunteer` (lowercase)
