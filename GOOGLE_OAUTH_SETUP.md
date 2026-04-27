# Google OAuth 2.0 Setup Guide

This guide will help you set up Google Sign-In for the Sankalp Village Project.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter project name: "Sankalp Village Project"
5. Click "Create"

## Step 2: Enable Google+ API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and click "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (unless you have a Google Workspace)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Sankalp Village Project
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click "Save and Continue"
6. On the "Scopes" page, click "Add or Remove Scopes"
7. Add these scopes:
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`
8. Click "Save and Continue"
9. Add test users (your email addresses) if in testing mode
10. Click "Save and Continue"

## Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application"
4. Enter name: "Sankalp Web Client"
5. Add **Authorized JavaScript origins**:
   - Development: `http://localhost:5173`
   - Production: `https://your-frontend-domain.vercel.app`
6. Add **Authorized redirect URIs**:
   - Development: `http://localhost:5173`
   - Production: `https://your-frontend-domain.vercel.app`
7. Click "Create"
8. **Copy the Client ID and Client Secret** - you'll need these!

## Step 5: Configure Environment Variables

### Backend (.env)

Add to `server/.env`:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

### Frontend (.env)

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_client_id_here
```

**Note**: Use the same Client ID for both frontend and backend!

## Step 6: Update for Production

When deploying to production:

### Vercel (Frontend)

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add:
   - `VITE_API_URL`: Your backend URL (e.g., `https://your-backend.render.com`)
   - `VITE_GOOGLE_CLIENT_ID`: Your Google Client ID

### Render (Backend)

1. Go to your Render service settings
2. Navigate to "Environment"
3. Add:
   - `GOOGLE_CLIENT_ID`: Your Google Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google Client Secret

### Update Google Cloud Console

1. Go back to "APIs & Services" → "Credentials"
2. Click on your OAuth 2.0 Client ID
3. Add your production URLs to:
   - **Authorized JavaScript origins**: `https://your-frontend.vercel.app`
   - **Authorized redirect URIs**: `https://your-frontend.vercel.app`
4. Click "Save"

## Step 7: Test the Integration

1. Start your development servers:
   ```bash
   # Backend
   cd server
   npm run dev

   # Frontend (in another terminal)
   cd client
   npm run dev
   ```

2. Open `http://localhost:5173` in your browser
3. Click the "Sign in with Google" button
4. Select your Google account
5. You should be redirected to the dashboard!

**Note on Automatic Role Assignment:**
- Users with emails starting with `23` or `24` will automatically get **admin** access
- Users with emails starting with `25` or `26` will automatically get **volunteer** access
- All other users will get **volunteer** access by default
- This is useful for educational institutions where batch years are part of email addresses

## Troubleshooting

### "redirect_uri_mismatch" Error

- Make sure the redirect URI in Google Cloud Console exactly matches your frontend URL
- Check for trailing slashes - they must match exactly

### "idpiframe_initialization_failed" Error

- Make sure cookies are enabled in your browser
- Check that your Client ID is correct in the frontend `.env` file

### "Invalid credentials" Error

- Verify that both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set correctly in backend `.env`
- Make sure there are no extra spaces or quotes in the environment variables

### User Created but Can't Access Features

- New Google sign-in users are automatically assigned roles based on their email:
  - **Admin role**: Emails starting with `23` or `24` (e.g., `23bcs001@example.com`, `24mca123@example.com`)
  - **Volunteer role**: Emails starting with `25` or `26` (e.g., `25btech@example.com`, `26mtech@example.com`)
  - **Default volunteer role**: All other emails
- Existing users who link their Google account will have their role updated based on the email pattern
- This automatic role assignment happens during the Google sign-in process

## Security Notes

1. **Never commit `.env` files** to Git - they contain sensitive credentials
2. **Use different credentials** for development and production
3. **Regularly rotate** your Client Secret in production
4. **Limit OAuth scopes** to only what you need (email and profile)
5. **Monitor OAuth usage** in Google Cloud Console

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Sign-In for Websites](https://developers.google.com/identity/sign-in/web)
- [@react-oauth/google Documentation](https://www.npmjs.com/package/@react-oauth/google)
