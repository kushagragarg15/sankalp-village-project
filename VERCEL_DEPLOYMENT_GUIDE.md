# Vercel Deployment Guide - Complete Step-by-Step

This guide will walk you through deploying the Sankalp application using Vercel for the frontend and Render for the backend.

## Overview

**Architecture:**
- **Frontend**: Vercel (React + Vite)
- **Backend**: Render (Node.js + Express)
- **Database**: MongoDB Atlas

**Estimated Time**: 35-40 minutes
**Cost**: $0 (using free tiers)

---

## Prerequisites

Before starting, ensure you have:
- [x] GitHub account with repository pushed
- [x] Vercel account (sign up at https://vercel.com)
- [x] Render account (sign up at https://render.com)
- [x] MongoDB Atlas account (sign up at https://www.mongodb.com/cloud/atlas)

---

## Part 1: Set Up MongoDB Atlas (5 minutes)

### Step 1.1: Create MongoDB Cluster

1. **Go to MongoDB Atlas**: https://www.mongodb.com/cloud/atlas
2. **Sign up or log in**
3. **Create a new project**:
   - Click "New Project"
   - Name: "Sankalp"
   - Click "Create Project"

4. **Create a cluster**:
   - Click "Build a Database"
   - Choose "FREE" tier (M0 Sandbox)
   - Select a cloud provider (AWS recommended)
   - Choose a region closest to you
   - Cluster Name: "sankalp-cluster"
   - Click "Create"

### Step 1.2: Configure Database Access

1. **Create Database User**:
   - Go to "Database Access" in left sidebar
   - Click "Add New Database User"
   - Authentication Method: Password
   - Username: `sankalpuser`
   - Password: Click "Autogenerate Secure Password" (SAVE THIS!)
   - Database User Privileges: "Read and write to any database"
   - Click "Add User"

### Step 1.3: Configure Network Access

1. **Whitelist IP Addresses**:
   - Go to "Network Access" in left sidebar
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"
   - Wait for status to become "Active" (30 seconds)

### Step 1.4: Get Connection String

1. **Get Connection String**:
   - Go to "Database" in left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Driver: Node.js
   - Version: 4.1 or later
   - Copy the connection string
   - It looks like: `mongodb+srv://sankalpuser:<password>@sankalp-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority`

2. **Replace `<password>`** with the password you saved earlier

3. **Add database name** to the connection string:
   - Change: `mongodb+srv://...mongodb.net/?retryWrites=true`
   - To: `mongodb+srv://...mongodb.net/sankalp-db?retryWrites=true`

4. **Save this connection string** - you'll need it for backend deployment

---

## Part 2: Deploy Backend on Render (10 minutes)

### Step 2.1: Create Render Account

1. **Go to Render**: https://render.com
2. **Sign up** using your GitHub account
3. **Authorize Render** to access your GitHub repositories

### Step 2.2: Create Web Service

1. **Click "New +"** in top right
2. **Select "Web Service"**
3. **Connect your repository**:
   - Find "sankalp-village-project"
   - Click "Connect"

### Step 2.3: Configure Web Service

Fill in the following settings:

**Basic Settings:**
- **Name**: `sankalp-backend`
- **Region**: Choose closest to you (e.g., Oregon, Frankfurt, Singapore)
- **Branch**: `main`
- **Root Directory**: `server`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Instance Type:**
- Select **"Free"** (0.1 CPU, 512 MB RAM)

### Step 2.4: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add these variables one by one:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `MONGO_URI` | Your MongoDB connection string from Step 1.4 |
| `JWT_SECRET` | Generate using command below |
| `CLIENT_URL` | `https://sankalp-village-project.vercel.app` (we'll update this later) |
| `OPENAI_API_KEY` | Your OpenAI key (optional, leave blank if you don't have one) |

**To generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste it as the value.

### Step 2.5: Deploy Backend

1. **Click "Create Web Service"**
2. **Wait for deployment** (3-5 minutes)
3. **Check logs** for any errors
4. **Copy your backend URL** (e.g., `https://sankalp-backend.onrender.com`)
5. **Test the backend**:
   - Visit: `https://your-backend-url.onrender.com/api/auth/me`
   - You should see: `{"success":false,"message":"Not authorized, no token"}`
   - This means the backend is working!

### Step 2.6: Seed the Database

1. **In Render dashboard**, click on your service
2. **Click "Shell"** in the left sidebar
3. **Run the seed command**:
   ```bash
   npm run seed
   ```
4. **Wait for completion** (30 seconds)
5. **You should see**: "Database seeded successfully"

---

## Part 3: Deploy Frontend on Vercel (10 minutes)

### Step 3.1: Prepare Frontend Configuration

Before deploying, we need to update the API configuration.

1. **Update API URL in code**:
   - Open: `client/src/utils/api.js`
   - Find the line with `API_URL`
   - It should look like:
   ```javascript
   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
   ```
   - This is correct - no changes needed!

### Step 3.2: Create Vercel Account

1. **Go to Vercel**: https://vercel.com
2. **Click "Sign Up"**
3. **Sign up with GitHub** (recommended)
4. **Authorize Vercel** to access your repositories

### Step 3.3: Import Project

1. **Click "Add New..."** → **"Project"**
2. **Import Git Repository**:
   - Find "sankalp-village-project"
   - Click "Import"

### Step 3.4: Configure Project Settings

Based on your screenshot, configure as follows:

**Project Settings:**
- **Project Name**: `sankalp-village-project` (or customize)
- **Framework Preset**: Select **"Vite"** from dropdown
- **Root Directory**: Click "Edit" → Enter `client` → Click "Continue"

**Build and Output Settings:**
Click the dropdown arrow to expand, then configure:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3.5: Add Environment Variables

Click **"Environment Variables"** dropdown to expand.

Add this variable:

| Name | Value |
|------|-------|
| `VITE_API_URL` | Your backend URL from Step 2.5 (e.g., `https://sankalp-backend.onrender.com`) |

**Important**: 
- Make sure there's NO trailing slash in the URL
- Example: `https://sankalp-backend.onrender.com` ✅
- NOT: `https://sankalp-backend.onrender.com/` ❌

### Step 3.6: Deploy Frontend

1. **Click "Deploy"**
2. **Wait for build** (2-3 minutes)
3. **Watch the build logs** for any errors
4. **Once complete**, you'll see "Congratulations!" 🎉
5. **Click "Visit"** to see your deployed app
6. **Copy your frontend URL** (e.g., `https://sankalp-village-project.vercel.app`)

---

## Part 4: Update Backend CORS Settings (2 minutes)

Now that we have the frontend URL, we need to update the backend.

### Step 4.1: Update CLIENT_URL

1. **Go back to Render dashboard**
2. **Click on your backend service** (sankalp-backend)
3. **Click "Environment"** in left sidebar
4. **Find `CLIENT_URL`** variable
5. **Click "Edit"**
6. **Update value** to your Vercel URL (e.g., `https://sankalp-village-project.vercel.app`)
7. **Click "Save Changes"**
8. **Service will automatically redeploy** (1-2 minutes)

---

## Part 5: Test Your Deployment (5 minutes)

### Step 5.1: Test Frontend

1. **Visit your Vercel URL**
2. **You should see the login page** with logo animation
3. **Check browser console** (F12) for any errors

### Step 5.2: Test Login

Try logging in with demo credentials:

**Admin Account:**
- Email: `admin@sankalpvillage.org`
- Password: `admin123`

**Volunteer Account:**
- Email: `priya@sankalpvillage.org`
- Password: `volunteer123`

### Step 5.3: Test Features

After logging in, test these features:

- [x] Dashboard loads with stats
- [x] Events page displays
- [x] Volunteers page shows data
- [x] Students page shows data
- [x] Analytics charts render
- [x] QR code displays on event details
- [x] Navigation works smoothly

### Step 5.4: Test on Mobile

1. **Open your Vercel URL on mobile**
2. **Test responsive design**
3. **Try logging in**
4. **Navigate through pages**

---

## Part 6: Configure Custom Domain (Optional, 5 minutes)

### Step 6.1: Add Domain to Vercel

1. **In Vercel dashboard**, go to your project
2. **Click "Settings"** → **"Domains"**
3. **Enter your domain** (e.g., `sankalp.yourdomain.com`)
4. **Click "Add"**
5. **Follow DNS configuration instructions**

### Step 6.2: Update Backend CORS

1. **Go to Render backend service**
2. **Update `CLIENT_URL`** to your custom domain
3. **Save and redeploy**

---

## Troubleshooting

### Issue: "Failed to fetch" or CORS Error

**Solution:**
1. Check that `CLIENT_URL` in Render matches your Vercel URL exactly
2. Ensure no trailing slash in URLs
3. Wait 2 minutes for Render to redeploy after changing environment variables
4. Clear browser cache and try again

### Issue: "Cannot connect to database"

**Solution:**
1. Check MongoDB Atlas IP whitelist includes 0.0.0.0/0
2. Verify `MONGO_URI` is correct in Render environment variables
3. Ensure database user has read/write permissions
4. Check Render logs for specific error messages

### Issue: Build fails on Vercel

**Solution:**
1. Verify Root Directory is set to `client`
2. Check that Framework Preset is "Vite"
3. Ensure Build Command is `npm run build`
4. Check Vercel build logs for specific errors
5. Verify all dependencies are in `client/package.json`

### Issue: Login fails with "Invalid credentials"

**Solution:**
1. Check that backend is running (visit backend URL)
2. Verify database was seeded (check Render logs)
3. Try re-running seed command in Render shell
4. Check browser console for API errors

### Issue: QR code doesn't display

**Solution:**
1. Check that event was created successfully
2. Verify backend URL is correct in frontend
3. Check browser console for errors
4. Try creating a new event

### Issue: Charts don't render

**Solution:**
1. Check that there's data in the database
2. Verify API calls are successful (check Network tab)
3. Clear browser cache
4. Check for JavaScript errors in console

---

## Post-Deployment Checklist

- [ ] Frontend loads successfully
- [ ] Backend API responds
- [ ] Login works with demo credentials
- [ ] Dashboard displays stats
- [ ] Events page works
- [ ] QR codes display
- [ ] Analytics charts render
- [ ] Mobile responsive design works
- [ ] No console errors
- [ ] CORS configured correctly

---

## Updating Your Deployment

### Update Frontend

**Option 1: Automatic (Recommended)**
- Push changes to GitHub main branch
- Vercel automatically rebuilds and deploys

**Option 2: Manual**
1. Go to Vercel dashboard
2. Click "Deployments"
3. Click "Redeploy" on latest deployment

### Update Backend

**Option 1: Automatic (Recommended)**
- Push changes to GitHub main branch
- Render automatically rebuilds and deploys

**Option 2: Manual**
1. Go to Render dashboard
2. Click "Manual Deploy" → "Deploy latest commit"

---

## Environment Variables Reference

### Backend (Render)

```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://sankalpuser:password@cluster.mongodb.net/sankalp-db?retryWrites=true&w=majority
JWT_SECRET=your_generated_64_character_hex_string
CLIENT_URL=https://sankalp-village-project.vercel.app
OPENAI_API_KEY=sk-... (optional)
```

### Frontend (Vercel)

```env
VITE_API_URL=https://sankalp-backend.onrender.com
```

---

## Monitoring and Logs

### Vercel Logs

1. Go to Vercel dashboard
2. Click on your project
3. Click "Deployments"
4. Click on a deployment to see logs

### Render Logs

1. Go to Render dashboard
2. Click on your service
3. Click "Logs" in left sidebar
4. View real-time logs

### MongoDB Logs

1. Go to MongoDB Atlas
2. Click on your cluster
3. Click "Metrics" to see database activity

---

## Cost Breakdown

### Free Tier Limits

**Vercel:**
- Unlimited deployments
- 100 GB bandwidth/month
- Automatic HTTPS
- Custom domains

**Render:**
- 750 hours/month (enough for 1 service)
- Automatic HTTPS
- Automatic deploys from GitHub

**MongoDB Atlas:**
- 512 MB storage
- Shared RAM
- Sufficient for small deployments

**Total: $0/month**

### When to Upgrade

Consider upgrading when:
- Traffic exceeds 100 GB/month (Vercel)
- Need more than 750 hours/month (Render)
- Database exceeds 512 MB (MongoDB)
- Need better performance

---

## Security Best Practices

1. **Change default passwords** after first login
2. **Use strong JWT_SECRET** (64+ characters)
3. **Enable 2FA** on Vercel and Render accounts
4. **Regularly update dependencies**
5. **Monitor logs** for suspicious activity
6. **Set up MongoDB backups** (Atlas has automatic backups)
7. **Use environment variables** for all secrets
8. **Never commit .env files** to GitHub

---

## Support and Resources

**Vercel Documentation**: https://vercel.com/docs
**Render Documentation**: https://render.com/docs
**MongoDB Atlas Documentation**: https://docs.atlas.mongodb.com

**Project Documentation**:
- [README.md](README.md) - Project overview
- [API_REFERENCE.md](API_REFERENCE.md) - API documentation
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues

---

## Success! 🎉

Your Sankalp application is now live!

**Frontend**: https://sankalp-village-project.vercel.app
**Backend**: https://sankalp-backend.onrender.com

**Next Steps**:
1. Share the URL with your team
2. Change default admin password
3. Start creating events and adding students
4. Monitor usage and performance

---

**Deployment Date**: April 27, 2026
**Platform**: Vercel (Frontend) + Render (Backend)
**Database**: MongoDB Atlas
**Total Cost**: $0/month (free tier)
