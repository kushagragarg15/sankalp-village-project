# CORS Issue Fix Guide

## The Issue

When your frontend (Vercel) tries to connect to your backend (Render), you might see:
- "Login failed" 
- "Failed to fetch"
- CORS error in browser console

## Why It Happens

Your backend needs to explicitly allow requests from your frontend URL. This is a security feature.

## The Fix

### Step 1: Verify Backend CORS Configuration

Your backend (`server/server.js`) already has CORS configured:

```javascript
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
```

This is correct! ✅

### Step 2: Set CLIENT_URL Environment Variable

**On Render (Backend):**

1. Go to your Render dashboard
2. Click on your backend service (sankalp-backend)
3. Click "Environment" in left sidebar
4. Find or add `CLIENT_URL` variable
5. Set the value to your **exact Vercel URL**:
   ```
   https://sankalp-village-project.vercel.app
   ```
   
**Important:**
- ✅ Correct: `https://sankalp-village-project.vercel.app`
- ❌ Wrong: `https://sankalp-village-project.vercel.app/` (no trailing slash)
- ❌ Wrong: `http://sankalp-village-project.vercel.app` (must be https)

6. Click "Save Changes"
7. Wait 2 minutes for Render to redeploy

### Step 3: Verify Frontend API URL

**On Vercel (Frontend):**

1. Go to your Vercel dashboard
2. Click on your project
3. Go to "Settings" → "Environment Variables"
4. Verify `VITE_API_URL` is set to your backend URL:
   ```
   https://sankalp-backend.onrender.com
   ```

**Important:**
- ✅ Correct: `https://sankalp-backend.onrender.com`
- ❌ Wrong: `https://sankalp-backend.onrender.com/` (no trailing slash)
- ❌ Wrong: `http://sankalp-backend.onrender.com` (must be https)

5. If you made changes, redeploy:
   - Go to "Deployments"
   - Click "..." on latest deployment
   - Click "Redeploy"

### Step 4: Test the Connection

1. **Open your Vercel URL** in browser
2. **Open Developer Tools** (F12)
3. **Go to Console tab**
4. **Try to login** with demo credentials
5. **Check for errors**

**If working correctly, you should see:**
- No CORS errors in console
- Successful login
- Redirect to dashboard

**If still failing, check:**
- Network tab for the actual error
- Response from backend
- Status code (should be 200 for success)

## Common Mistakes

### ❌ Mistake 1: Trailing Slash
```
CLIENT_URL=https://sankalp-village-project.vercel.app/
```
**Fix:** Remove the trailing slash
```
CLIENT_URL=https://sankalp-village-project.vercel.app
```

### ❌ Mistake 2: Wrong Protocol
```
CLIENT_URL=http://sankalp-village-project.vercel.app
```
**Fix:** Use https (Vercel always uses https)
```
CLIENT_URL=https://sankalp-village-project.vercel.app
```

### ❌ Mistake 3: Wrong Domain
```
CLIENT_URL=https://sankalp-village-project-git-main.vercel.app
```
**Fix:** Use the main production URL
```
CLIENT_URL=https://sankalp-village-project.vercel.app
```

### ❌ Mistake 4: Not Waiting for Redeploy
After changing environment variables, Render needs to redeploy (1-2 minutes).

**Fix:** Wait for the redeploy to complete before testing.

## Advanced: Allow Multiple Origins

If you need to allow multiple frontend URLs (e.g., staging + production):

**Update `server/server.js`:**

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://sankalp-village-project.vercel.app',
  'https://sankalp-staging.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
```

## Verification Checklist

- [ ] `CLIENT_URL` is set in Render environment variables
- [ ] `CLIENT_URL` matches your Vercel URL exactly
- [ ] No trailing slash in `CLIENT_URL`
- [ ] Using https:// (not http://)
- [ ] Render service has redeployed after env var change
- [ ] `VITE_API_URL` is set in Vercel environment variables
- [ ] `VITE_API_URL` matches your Render backend URL
- [ ] No trailing slash in `VITE_API_URL`
- [ ] Vercel has redeployed after env var change
- [ ] Browser cache cleared (Ctrl+Shift+R or Cmd+Shift+R)

## Testing CORS Manually

### Test 1: Check Backend Health

Open in browser:
```
https://your-backend-url.onrender.com/api/auth/me
```

Expected response:
```json
{"success":false,"message":"Not authorized, no token"}
```

This means backend is running! ✅

### Test 2: Check CORS Headers

Open browser console and run:
```javascript
fetch('https://your-backend-url.onrender.com/api/auth/me', {
  credentials: 'include'
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**If CORS is working:**
- You'll see the JSON response
- No CORS error

**If CORS is NOT working:**
- You'll see: "CORS policy: No 'Access-Control-Allow-Origin' header"
- This means `CLIENT_URL` is not set correctly

## Still Not Working?

### Check Render Logs

1. Go to Render dashboard
2. Click on your backend service
3. Click "Logs"
4. Look for errors related to CORS or environment variables

### Check Vercel Logs

1. Go to Vercel dashboard
2. Click on your project
3. Click "Deployments"
4. Click on latest deployment
5. Check "Build Logs" and "Function Logs"

### Check Browser Network Tab

1. Open Developer Tools (F12)
2. Go to "Network" tab
3. Try to login
4. Click on the failed request
5. Check:
   - Request URL (should be your backend URL)
   - Request Headers (should include Origin)
   - Response Headers (should include Access-Control-Allow-Origin)
   - Status Code (should be 200 for success)

## Quick Fix Commands

### Regenerate and Update Environment Variables

**Backend (Render):**
```bash
# Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update in Render dashboard:
# JWT_SECRET=<new_value>
# CLIENT_URL=https://your-vercel-url.vercel.app
```

**Frontend (Vercel):**
```bash
# Update in Vercel dashboard:
# VITE_API_URL=https://your-backend.onrender.com
```

## Contact Support

If you're still having issues after following this guide:

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review Render and Vercel logs
3. Verify all environment variables are correct
4. Try redeploying both frontend and backend
5. Clear browser cache completely

---

**Remember:** After changing any environment variable, you must:
1. Save the changes
2. Wait for automatic redeploy (or trigger manual redeploy)
3. Clear browser cache
4. Test again

The most common issue is forgetting to wait for the redeploy! ⏱️
