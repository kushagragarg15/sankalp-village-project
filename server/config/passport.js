const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          return done(null, user);
        }

        // Check if user exists with same email
        user = await User.findOne({ email: profile.emails[0].value });

        // Determine role based on email pattern
        const email = profile.emails[0].value;
        let role = 'volunteer'; // Default role
        
        // Check if email starts with 23 or 24 (admin access)
        if (email.startsWith('23') || email.startsWith('24')) {
          role = 'admin';
        }
        // Check if email starts with 25 or 26 (volunteer access)
        else if (email.startsWith('25') || email.startsWith('26')) {
          role = 'volunteer';
        }

        if (user) {
          // Link Google account to existing user and update role
          user.googleId = profile.id;
          
          // Update role based on email pattern if it matches the criteria
          if (email.startsWith('23') || email.startsWith('24')) {
            user.role = 'admin';
          } else if (email.startsWith('25') || email.startsWith('26')) {
            user.role = 'volunteer';
          }
          
          await user.save();
          return done(null, user);
        }

        // Create new user with role based on email pattern
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          role: role,
        });

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
