# Deployment Guide

This guide covers deploying the Sankalp application to various platforms.

## Prerequisites

Before deploying, ensure you have:
- A MongoDB database (MongoDB Atlas recommended for production)
- Node.js environment (v16 or higher)
- Environment variables configured
- (Optional) OpenAI API key for teaching notes feature

## Environment Variables

Create the following environment variables in your deployment platform:

```env
NODE_ENV=production
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_random_jwt_secret
CLIENT_URL=https://your-frontend-domain.com
OPENAI_API_KEY=your_openai_api_key  # Optional
```

## MongoDB Atlas Setup

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Add a database user with read/write permissions
4. Whitelist your deployment platform's IP addresses (or use 0.0.0.0/0 for all IPs)
5. Get your connection string and add it to `MONGO_URI`

## Deployment Options

### Option 1: Render (Recommended)

**Backend Deployment:**

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add environment variables in the Render dashboard
5. Deploy

**Frontend Deployment:**

1. Create a new Static Site on Render
2. Configure:
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. Add environment variable:
   - `VITE_API_URL`: Your backend URL
4. Deploy

### Option 2: Vercel (Frontend) + Render (Backend)

**Backend on Render:**
- Follow the Render backend steps above

**Frontend on Vercel:**

1. Install Vercel CLI: `npm install -g vercel`
2. Navigate to client directory: `cd client`
3. Run: `vercel`
4. Follow the prompts
5. Add environment variable in Vercel dashboard:
   - `VITE_API_URL`: Your backend URL

### Option 3: Railway

1. Create account on [Railway](https://railway.app)
2. Create new project
3. Add MongoDB plugin (or use external MongoDB Atlas)
4. Deploy backend:
   - Connect GitHub repository
   - Set root directory to `server`
   - Add environment variables
5. Deploy frontend:
   - Create new service
   - Set root directory to `client`
   - Add build command: `npm install && npm run build`
   - Add start command: `npx serve -s dist -p $PORT`

### Option 4: Heroku

**Backend:**

1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Add MongoDB: `heroku addons:create mongolab`
5. Set environment variables:
   ```bash
   heroku config:set JWT_SECRET=your_secret
   heroku config:set CLIENT_URL=your_frontend_url
   ```
6. Deploy:
   ```bash
   git subtree push --prefix server heroku main
   ```

**Frontend:**

Deploy to Vercel or Netlify (see respective sections)

### Option 5: DigitalOcean App Platform

1. Create account on [DigitalOcean](https://www.digitalocean.com)
2. Create new App
3. Connect GitHub repository
4. Configure components:
   - **Backend**: Node.js service from `server` directory
   - **Frontend**: Static site from `client` directory
5. Add environment variables
6. Deploy

## Post-Deployment Steps

1. **Seed the database** (first time only):
   ```bash
   # SSH into your backend server or use the platform's console
   npm run seed
   ```

2. **Test the application**:
   - Visit your frontend URL
   - Login with demo credentials
   - Verify all features work

3. **Update demo credentials** (recommended):
   - Login as admin
   - Change admin password
   - Update volunteer passwords

## Frontend API Configuration

Update the API base URL in `client/src/utils/api.js`:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```

Set `VITE_API_URL` environment variable in your frontend deployment platform.

## CORS Configuration

The backend is configured to accept requests from the `CLIENT_URL` environment variable. Make sure this is set to your frontend domain.

## SSL/HTTPS

Most deployment platforms (Render, Vercel, Railway) provide free SSL certificates automatically. Ensure your frontend uses `https://` when making API calls to the backend.

## Monitoring and Logs

- **Render**: View logs in the dashboard
- **Vercel**: Check deployment logs and runtime logs
- **Railway**: Access logs from the project dashboard
- **Heroku**: Use `heroku logs --tail`

## Troubleshooting

**Database Connection Issues:**
- Verify MongoDB connection string
- Check IP whitelist in MongoDB Atlas
- Ensure database user has correct permissions

**CORS Errors:**
- Verify `CLIENT_URL` environment variable
- Check that frontend is using correct backend URL

**Build Failures:**
- Check Node.js version compatibility
- Verify all dependencies are in package.json
- Review build logs for specific errors

**Authentication Issues:**
- Verify `JWT_SECRET` is set
- Check that cookies are enabled
- Ensure HTTPS is used in production

## Scaling Considerations

For production use with high traffic:

1. **Database**: Upgrade MongoDB Atlas tier for better performance
2. **Backend**: Enable auto-scaling on your platform
3. **CDN**: Use a CDN for frontend assets (Vercel/Netlify include this)
4. **Caching**: Implement Redis for session management
5. **Load Balancing**: Use platform's built-in load balancing

## Backup Strategy

1. **Database**: Enable automated backups in MongoDB Atlas
2. **Code**: Keep GitHub repository up to date
3. **Environment Variables**: Document all variables securely

## Cost Estimates

**Free Tier Options:**
- MongoDB Atlas: 512MB storage (sufficient for small deployments)
- Render: 750 hours/month free
- Vercel: Unlimited deployments
- Railway: $5 credit/month

**Estimated Monthly Cost (Small Scale):**
- MongoDB Atlas: $0 (free tier)
- Backend Hosting: $0-7
- Frontend Hosting: $0
- **Total: $0-7/month**

## Support

For deployment issues, check:
- Platform-specific documentation
- Application logs
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

Last updated: 2024
