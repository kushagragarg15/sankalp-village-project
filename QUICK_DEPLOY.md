# Quick Deploy Guide

Get Sankalp deployed in under 30 minutes.

## Prerequisites
- GitHub account
- MongoDB Atlas account (free tier)
- Render account (free tier) or similar platform

## Step 1: Prepare the Code (5 minutes)

1. **Replace the logo file**
   ```bash
   # Copy your actual logo to:
   client/src/assets/sankalp-logo.jpg
   ```

2. **Generate JWT Secret**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # Save this output - you'll need it
   ```

## Step 2: Set Up MongoDB Atlas (5 minutes)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account and cluster
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your database password
6. Save this connection string

## Step 3: Push to GitHub (2 minutes)

```bash
cd sankalps-village-project
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sankalp.git
git push -u origin main
```

## Step 4: Deploy Backend on Render (8 minutes)

1. Go to [Render](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `sankalp-backend`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=5000
   MONGO_URI=your_mongodb_connection_string_from_step2
   JWT_SECRET=your_generated_secret_from_step1
   CLIENT_URL=https://your-frontend-url.onrender.com
   OPENAI_API_KEY=your_openai_key (optional)
   ```

6. Click "Create Web Service"
7. Wait for deployment (3-5 minutes)
8. Copy your backend URL (e.g., `https://sankalp-backend.onrender.com`)

## Step 5: Deploy Frontend on Render (8 minutes)

1. Click "New +" → "Static Site"
2. Connect same GitHub repository
3. Configure:
   - **Name**: `sankalp-frontend`
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. Add Environment Variable:
   ```
   VITE_API_URL=your_backend_url_from_step4
   ```

5. Click "Create Static Site"
6. Wait for deployment (2-3 minutes)
7. Copy your frontend URL

## Step 6: Update Backend CLIENT_URL (2 minutes)

1. Go back to your backend service on Render
2. Click "Environment"
3. Update `CLIENT_URL` to your frontend URL from Step 5
4. Save changes (service will redeploy)

## Step 7: Seed the Database (2 minutes)

1. In Render backend dashboard, click "Shell"
2. Run:
   ```bash
   npm run seed
   ```
3. Wait for completion

## Step 8: Test Your Deployment (3 minutes)

1. Visit your frontend URL
2. Login with demo credentials:
   - **Admin**: admin@sankalpvillage.org / admin123
   - **Volunteer**: priya@sankalpvillage.org / volunteer123
3. Test key features:
   - Dashboard loads
   - Events page works
   - QR code displays
   - Analytics charts render

## ✅ Done!

Your application is now live at your frontend URL.

## Common Issues

**"Cannot connect to database"**
- Check MongoDB Atlas IP whitelist (add 0.0.0.0/0)
- Verify MONGO_URI is correct

**"CORS error"**
- Ensure CLIENT_URL matches your frontend URL exactly
- Include https:// in the URL

**"Build failed"**
- Check Node.js version (should be 16+)
- Verify package.json exists in correct directory

**"Page not loading"**
- Check browser console for errors
- Verify VITE_API_URL is set correctly
- Ensure backend is running

## Next Steps

1. **Change default passwords** (recommended)
2. **Add custom domain** (optional)
3. **Set up monitoring** (optional)
4. **Configure backups** (recommended)

## Alternative Platforms

### Vercel (Frontend) + Render (Backend)
- Deploy backend on Render (same as above)
- Deploy frontend on Vercel:
  ```bash
  cd client
  vercel
  ```

### Railway (Full Stack)
- Create project on Railway
- Add MongoDB plugin
- Deploy both services from same repo

### Heroku
- Follow [DEPLOYMENT.md](DEPLOYMENT.md) for Heroku instructions

---

**Need help?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or [DEPLOYMENT.md](DEPLOYMENT.md)

**Total Time**: ~30 minutes
**Cost**: $0 (using free tiers)
