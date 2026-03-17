# Deployment Guide for Quiz Web Application

This guide will help you deploy your Quiz Web application to production using **Render** (backend) and **Vercel** (frontend).

## Architecture

- **Frontend**: React + TypeScript + Vite (deploy to Vercel)
- **Backend**: Node.js + Express (deploy to Render)
- **Database**: Aiven MySQL (already configured)

## Prerequisites

1. GitHub account with your code pushed to a repository
2. Accounts on:
   - [Vercel](https://vercel.com) (for frontend)
   - [Render](https://render.com) (for backend)

## Step 1: Deploy Backend to Render

1. Go to [Render.com](https://render.com) and sign up/login
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `quiz-web-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Choose a plan (Free tier available)
5. Add Environment Variables (use your own values from Aiven / secrets):
   ```
   DB_HOST=your-aiven-mysql-host.aivencloud.com
   DB_PORT=26705
   DB_USER=avnadmin
   DB_PASSWORD=your-aiven-db-password
   DB_NAME=defaultdb
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   FRONTEND_URL=https://your-frontend-url.vercel.app
   NODE_ENV=production
   PORT=3001
   ```
   > **Important**: 
   > - Replace `JWT_SECRET` with a strong, random secret (use a password generator)
   > - Leave `FRONTEND_URL` as placeholder for now, we'll update it after frontend deployment
6. Click "Create Web Service"
7. Render will start building and deploying your backend
8. Once deployed, copy your service URL (e.g., `https://quiz-web-backend.onrender.com`)
9. **Note**: On the free tier, Render services spin down after 15 minutes of inactivity. The first request may take 30-60 seconds to wake up the service.

## Step 2: Deploy Frontend to Vercel

1. Go to [Vercel.com](https://vercel.com) and sign up/login
2. Click "Add New Project" → Import your GitHub repository
3. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variable:
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   ```
   > Replace `https://your-backend-url.onrender.com` with your actual Render backend URL from Step 1
5. Click "Deploy"
6. Vercel will build and deploy your frontend
7. Once deployed, copy your frontend URL (e.g., `https://your-app.vercel.app`)

## Step 3: Update CORS Settings

After deploying both frontend and backend:

1. Go back to Render dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Update the `FRONTEND_URL` environment variable to your Vercel frontend URL:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```
5. Click "Save Changes"
6. Render will automatically redeploy with the new environment variable

## Step 4: Test Your Deployment

1. Visit your frontend URL (Vercel)
2. Try logging in/registering
3. Check browser console (F12) for any errors
4. If you see CORS errors:
   - Verify `FRONTEND_URL` in Render matches your Vercel URL exactly (including `https://`)
   - Wait a few minutes for the redeploy to complete
   - Clear browser cache and try again

## Environment Variables Summary

### Backend (Render)
```
DB_HOST=your-aiven-mysql-host.aivencloud.com
DB_PORT=26705
DB_USER=avnadmin
DB_PASSWORD=your-aiven-db-password
DB_NAME=defaultdb
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=https://your-frontend-url.vercel.app
NODE_ENV=production
PORT=3001
```

### Frontend (Vercel)
```
VITE_API_URL=https://your-backend-url.onrender.com
```

## Troubleshooting

### Backend Issues

**Service won't start:**
- Check Render logs for errors
- Verify all environment variables are set correctly
- Ensure database credentials are correct
- Check that `PORT` environment variable is set (Render uses this)

**Database connection fails:**
- Verify Aiven MySQL credentials
- Check that Aiven allows connections from Render's IP ranges
- Ensure SSL is properly configured (already handled in code)

**Service is slow to respond:**
- Free tier services spin down after inactivity
- First request after spin-down takes 30-60 seconds
- Consider upgrading to a paid plan for always-on service

### Frontend Issues

**Build fails:**
- Check Vercel build logs
- Verify all dependencies are in `package.json`
- Ensure `VITE_API_URL` is set correctly
- Check for TypeScript errors

**API calls fail:**
- Verify `VITE_API_URL` matches your Render backend URL
- Check browser console for CORS errors
- Ensure backend is running (check Render dashboard)

**CORS Errors:**
- Make sure `FRONTEND_URL` in Render matches your Vercel URL exactly
- Include `https://` in the URL
- Wait for backend redeploy to complete after updating environment variables

### Database Issues

**Connection timeout:**
- Verify Aiven MySQL is running
- Check database credentials
- Ensure SSL is enabled (required for Aiven)

## Security Best Practices

1. **JWT Secret**: Use a strong, random secret (minimum 32 characters)
   - Generate using: `openssl rand -base64 32`
   - Never commit secrets to Git

2. **Environment Variables**: 
   - Never commit `.env` files (already in `.gitignore`)
   - Use platform environment variable features
   - Rotate secrets periodically

3. **HTTPS**: 
   - Both Vercel and Render provide HTTPS by default
   - Always use HTTPS in production

4. **Database Security**:
   - Aiven MySQL uses SSL (already configured)
   - Keep database credentials secure
   - Use strong database passwords

## Custom Domain (Optional)

### Vercel Custom Domain
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update `FRONTEND_URL` in Render to match your custom domain

### Render Custom Domain
1. Go to your service → Settings → Custom Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Update `VITE_API_URL` in Vercel if needed

## Monitoring and Logs

### Render
- View logs in the Render dashboard
- Set up email alerts for service failures
- Monitor service health in dashboard

### Vercel
- View build and function logs in dashboard
- Use Vercel Analytics for performance monitoring
- Set up deployment notifications

## Cost Considerations

### Free Tier Limits

**Render:**
- Services spin down after 15 minutes of inactivity
- 750 hours/month free
- First request after spin-down takes 30-60 seconds

**Vercel:**
- Unlimited static deployments
- 100GB bandwidth/month
- 100 serverless function invocations/day

### Upgrading

Consider upgrading if you need:
- Always-on backend service (Render)
- More bandwidth (Vercel)
- Better performance
- Priority support

## Support

If you encounter issues:
1. Check deployment logs in Render/Vercel dashboards
2. Verify all environment variables are set correctly
3. Test database connection locally first
4. Check CORS configuration
5. Review browser console for frontend errors

## Next Steps

After successful deployment:
1. Test all major features (login, quiz creation, quiz taking)
2. Set up monitoring and alerts
3. Configure custom domain (optional)
4. Set up automated backups for database
5. Document your deployment process for your team
