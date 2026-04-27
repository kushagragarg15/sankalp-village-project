# Pre-Deployment Checklist

Use this checklist before deploying to production.

## Code Preparation

- [x] Remove all unnecessary documentation files
- [x] Clean up AI-generated comments
- [x] Verify .gitignore is properly configured
- [x] Ensure .env file is not committed
- [ ] Replace placeholder logo with actual logo file
- [ ] Update demo credentials or remove them
- [ ] Review and update README.md with actual project details

## Environment Setup

- [ ] Create MongoDB Atlas account and cluster
- [ ] Generate secure JWT_SECRET (use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] Obtain OpenAI API key (if using AI features)
- [ ] Document all environment variables

## Security

- [ ] Change default admin password
- [ ] Update JWT_SECRET to a strong random value
- [ ] Review CORS settings in server
- [ ] Ensure .env is in .gitignore
- [ ] Remove or secure any test/debug endpoints
- [ ] Verify password hashing is working

## Database

- [ ] Set up MongoDB Atlas cluster
- [ ] Configure IP whitelist
- [ ] Create database user with appropriate permissions
- [ ] Test connection string locally
- [ ] Plan backup strategy

## Testing

- [ ] Test all features locally
- [ ] Verify authentication flow
- [ ] Test QR code generation and scanning
- [ ] Check responsive design on mobile
- [ ] Test with different user roles (admin, volunteer)
- [ ] Verify API endpoints return correct data

## Deployment Platform

- [ ] Choose deployment platform (Render, Vercel, Railway, etc.)
- [ ] Create accounts on chosen platforms
- [ ] Connect GitHub repository
- [ ] Configure build settings
- [ ] Set up environment variables on platform

## Frontend Deployment

- [ ] Update API URL in frontend code
- [ ] Test build locally: `npm run build`
- [ ] Configure VITE_API_URL environment variable
- [ ] Deploy frontend
- [ ] Verify frontend loads correctly
- [ ] Test API calls from deployed frontend

## Backend Deployment

- [ ] Deploy backend service
- [ ] Verify environment variables are set
- [ ] Check logs for errors
- [ ] Test API endpoints
- [ ] Run database seed script (first time only)

## Post-Deployment

- [ ] Test complete user flow on production
- [ ] Verify QR code functionality
- [ ] Test authentication and authorization
- [ ] Check analytics and charts render correctly
- [ ] Test on multiple devices and browsers
- [ ] Set up monitoring/logging
- [ ] Document production URLs

## Documentation

- [ ] Update README with production URLs
- [ ] Document deployment process
- [ ] Create user guide if needed
- [ ] Update API documentation

## Optional Enhancements

- [ ] Set up custom domain
- [ ] Configure SSL certificate (usually automatic)
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure analytics (Google Analytics, etc.)
- [ ] Set up automated backups
- [ ] Create staging environment

## GitHub Repository

- [ ] Create GitHub repository
- [ ] Push code to GitHub
- [ ] Add repository description
- [ ] Add topics/tags
- [ ] Create initial release/tag
- [ ] Update repository settings

## Final Checks

- [ ] All features working in production
- [ ] No console errors in browser
- [ ] No server errors in logs
- [ ] Mobile responsive design working
- [ ] All links and navigation working
- [ ] Demo credentials working (if kept)

---

## Quick Deploy Commands

### Initialize Git (if not already done)
```bash
cd sankalps-village-project
git init
git add .
git commit -m "Initial commit"
```

### Push to GitHub
```bash
git remote add origin https://github.com/yourusername/sankalp.git
git branch -M main
git push -u origin main
```

### Generate Secure JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Test Build Locally
```bash
# Backend
cd server
npm install
npm start

# Frontend
cd client
npm install
npm run build
npm run preview
```

---

**Ready to deploy?** Follow the [DEPLOYMENT.md](DEPLOYMENT.md) guide for platform-specific instructions.
