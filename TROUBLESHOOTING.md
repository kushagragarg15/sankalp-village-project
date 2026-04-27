# Troubleshooting Guide

Common issues and their solutions for Sankalp's Village Project.

## 🔴 Frontend Issues

### Issue: Page Reloads Instantly / Can't Type in Forms

**Symptoms:**
- Input fields clear immediately after typing
- Page refreshes on every keystroke
- Form submits without clicking button

**Causes & Solutions:**

#### 1. Missing `e.preventDefault()` in Form Handler
**Check:** All form `onSubmit` handlers must have `e.preventDefault()`

```javascript
// ✅ CORRECT
const handleSubmit = async (e) => {
  e.preventDefault();  // MUST BE FIRST LINE
  // your logic here
};

// ❌ WRONG - Missing preventDefault
const handleSubmit = async (e) => {
  // your logic here
};
```

**Fixed in:** All form components already have this.

#### 2. Infinite Re-render Loop
**Check:** `useEffect` without dependency array

```javascript
// ❌ WRONG - Causes infinite loop
useEffect(() => {
  setState(something);
});

// ✅ CORRECT - Has dependency array
useEffect(() => {
  setState(something);
}, []); // Empty array = run once on mount
```

**Fixed in:** All components have proper dependencies.

#### 3. Redirect Loop on Login Page
**Symptom:** Login page keeps refreshing

**Cause:** API interceptor redirecting to `/login` when already on `/login`

**Solution:** Already fixed in `client/src/utils/api.js`:
```javascript
if (error.response?.status === 401 && window.location.pathname !== '/login') {
  window.location.href = '/login';
}
```

#### 4. State Reset in Wrong Place
**Check:** No state setters in render body

```javascript
// ❌ WRONG - Resets on every render
function Component() {
  setEmail('');  // BAD - outside handler
  return <input />;
}

// ✅ CORRECT - Only in handlers
function Component() {
  const handleClear = () => {
    setEmail('');  // GOOD - inside handler
  };
  return <input />;
}
```

### Issue: "Cannot read property of undefined"

**Cause:** Trying to access nested properties before data loads

**Solution:** Use optional chaining
```javascript
// ❌ WRONG
{user.assignedVillage.name}

// ✅ CORRECT
{user?.assignedVillage?.name}
```

### Issue: Components Not Updating

**Cause:** State mutation instead of creating new state

**Solution:** Always create new objects/arrays
```javascript
// ❌ WRONG - Mutating state
formData.attendees.push(id);
setFormData(formData);

// ✅ CORRECT - New array
setFormData({
  ...formData,
  attendees: [...formData.attendees, id]
});
```

---

## 🔴 Backend Issues

### Issue: "MongoDB connection failed"

**Symptoms:**
- Server won't start
- Error: "MongooseServerSelectionError"

**Solutions:**

#### 1. MongoDB Not Running (Local)
```bash
# Start MongoDB service
# Windows:
net start MongoDB

# Mac:
brew services start mongodb-community

# Linux:
sudo systemctl start mongod
```

#### 2. Wrong Connection String
Check `.env`:
```env
# Local MongoDB
MONGO_URI=mongodb://localhost:27017/sankalp-village-project

# MongoDB Atlas
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

#### 3. MongoDB Atlas IP Whitelist
- Go to MongoDB Atlas dashboard
- Network Access → Add IP Address
- Add `0.0.0.0/0` (allow all) or your specific IP

#### 4. Wrong Database Credentials
- Verify username and password in connection string
- Check if user has read/write permissions

### Issue: "Port 5000 already in use"

**Solution 1:** Change port in `.env`
```env
PORT=5001
```

**Solution 2:** Kill process using port 5000
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill -9
```

### Issue: "JWT malformed" or "Invalid token"

**Causes:**
1. JWT_SECRET changed after tokens were issued
2. Cookie not being sent

**Solutions:**
1. Clear browser cookies
2. Logout and login again
3. Check JWT_SECRET in `.env` hasn't changed

### Issue: "Cannot find module"

**Solution:**
```bash
cd server
rm -rf node_modules package-lock.json
npm install
```

---

## 🔴 CORS Issues

### Issue: "CORS policy blocked"

**Symptoms:**
- Frontend can't connect to backend
- Console error: "Access-Control-Allow-Origin"

**Solutions:**

#### 1. Check CLIENT_URL in Backend `.env`
```env
CLIENT_URL=http://localhost:5173
```

#### 2. Verify CORS Configuration in `server/server.js`
```javascript
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
```

#### 3. Check Vite Proxy in `client/vite.config.js`
```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true
    }
  }
}
```

---

## 🔴 Authentication Issues

### Issue: Can't Login / Always Redirected

**Debug Steps:**

1. **Check Backend Logs**
   - Look for login attempt
   - Check for errors

2. **Check Browser Console**
   - Look for API errors
   - Check Network tab for 401/403

3. **Verify Credentials**
   - Use seed credentials:
   - Admin: `admin@sankalpvillage.org` / `admin123`
   - Volunteer: `priya@sankalpvillage.org` / `volunteer123`

4. **Clear Cookies**
   - Open DevTools → Application → Cookies
   - Delete all cookies for localhost

5. **Re-seed Database**
   ```bash
   cd server
   npm run seed
   ```

### Issue: "User not found" After Login

**Cause:** Database not seeded or cleared

**Solution:**
```bash
cd server
npm run seed
```

---

## 🔴 OpenAI / AI Features Issues

### Issue: "AI service not configured"

**Cause:** Missing OPENAI_API_KEY

**Solution:**
1. Get API key from platform.openai.com
2. Add to `.env`:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```
3. Restart backend server

### Issue: "OpenAI API rate limit exceeded"

**Cause:** Too many requests or no credits

**Solutions:**
1. Check OpenAI account billing
2. Add credits to account
3. Wait for rate limit to reset

### Issue: "Invalid OpenAI API key"

**Solutions:**
1. Verify key is correct (starts with `sk-`)
2. Check key hasn't been revoked
3. Generate new key from OpenAI dashboard

---

## 🔴 Development Server Issues

### Issue: Hot Reload Not Working

**Solution:**
```bash
# Stop both servers (Ctrl+C)
# Clear cache and restart

cd client
rm -rf node_modules/.vite
npm run dev

# In another terminal
cd server
npm run dev
```

### Issue: Changes Not Reflecting

**Solutions:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Restart dev servers
4. Check if you're editing the right file

---

## 🔴 Build/Production Issues

### Issue: Build Fails

**Check:**
1. All dependencies installed
2. No TypeScript errors (if using TS)
3. Environment variables set

**Solution:**
```bash
cd client
npm run build
```

Check output for specific errors.

### Issue: Production API Calls Failing

**Cause:** Wrong API base URL

**Solution:** Update `client/src/utils/api.js`:
```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true
});
```

Add to `.env`:
```env
VITE_API_URL=https://your-backend-url.com/api
```

---

## 🛠️ Debugging Tools

### Browser DevTools
1. **Console** - Check for JavaScript errors
2. **Network** - Check API calls and responses
3. **Application** - Check cookies and localStorage
4. **React DevTools** - Inspect component state

### Backend Debugging
1. **Console Logs** - Add `console.log()` statements
2. **MongoDB Compass** - View database directly
3. **Postman** - Test API endpoints independently

### Quick Debug Checklist
- [ ] Backend server running?
- [ ] Frontend server running?
- [ ] MongoDB running?
- [ ] .env file configured?
- [ ] Database seeded?
- [ ] Browser console clear of errors?
- [ ] Network tab shows successful API calls?

---

## 🔍 Common Error Messages

### "Cannot GET /api/..."
**Cause:** Backend not running or wrong URL
**Solution:** Start backend server

### "Network Error"
**Cause:** Backend not reachable
**Solution:** Check backend is running on correct port

### "Unexpected token < in JSON"
**Cause:** Backend returning HTML instead of JSON (usually 404)
**Solution:** Check API endpoint URL is correct

### "Failed to fetch"
**Cause:** CORS or network issue
**Solution:** Check CORS configuration

---

## 📞 Getting Help

If issue persists:

1. **Check Logs**
   - Backend terminal output
   - Browser console
   - Network tab in DevTools

2. **Isolate the Problem**
   - Does it happen on login only?
   - Does it happen on all pages?
   - Does it happen in incognito mode?

3. **Try Fresh Start**
   ```bash
   # Stop all servers
   # Delete node_modules in both client and server
   # Reinstall dependencies
   # Re-seed database
   # Restart servers
   ```

4. **Check Documentation**
   - README.md
   - SETUP.md
   - API_REFERENCE.md

---

## ✅ Prevention Tips

1. **Always use `e.preventDefault()` in form handlers**
2. **Always add dependency arrays to `useEffect`**
3. **Use optional chaining for nested properties**
4. **Don't mutate state directly**
5. **Check backend logs when API fails**
6. **Keep .env file updated**
7. **Restart servers after .env changes**
8. **Clear cookies when auth issues occur**

---

**Most issues can be solved by:**
1. Restarting both servers
2. Clearing browser cookies
3. Re-seeding the database
4. Checking .env configuration
