// Sign-in provider settings. Leave a value empty and that provider runs as a
// clearly labelled demo (a local account on this device) instead of the real
// sign-in. Values can also come from the build environment (.env.local):
//
//   VITE_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com
//   VITE_APPLE_SERVICES_ID=com.jongclub.web
//   VITE_APPLE_REDIRECT_URI=https://jongclub.com/auth/apple
//
// Google: a "Web application" OAuth client ID from Google Cloud Console, with the
// site's origin (e.g. https://jongclub.com) under Authorised JavaScript origins.
// Apple: a Services ID with Sign in with Apple enabled, the site's domain verified
// and the redirect URI registered as a Return URL (Apple needs https, no localhost).

const env = import.meta.env as Record<string, string | undefined>;

export const AUTH_CONFIG = {
  googleClientId: env.VITE_GOOGLE_CLIENT_ID ?? '',
  appleServicesId: env.VITE_APPLE_SERVICES_ID ?? '',
  appleRedirectUri: env.VITE_APPLE_REDIRECT_URI ?? (typeof location !== 'undefined' ? location.origin + location.pathname : ''),
};

export const googleLive = () => !!AUTH_CONFIG.googleClientId;
export const appleLive = () => !!AUTH_CONFIG.appleServicesId;
