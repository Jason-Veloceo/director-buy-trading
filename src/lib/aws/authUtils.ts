import { Auth } from 'aws-amplify';

interface LoginParams {
  username: string;
  password: string;
}

interface SignUpParams {
  username: string;
  password: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface ConfirmSignUpParams {
  username: string;
  code: string;
}

// Sign in with username and password
export const signIn = async ({ username, password }: LoginParams) => {
  try {
    const user = await Auth.signIn(username, password);
    return user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

// Sign out the current user
export const signOut = async () => {
  try {
    await Auth.signOut();
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Register a new user
export const signUp = async ({ username, password, email, firstName, lastName }: SignUpParams) => {
  try {
    const { user } = await Auth.signUp({
      username,
      password,
      attributes: {
        email,
        ...(firstName && { given_name: firstName }),
        ...(lastName && { family_name: lastName }),
      },
    });
    return user;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

// Confirm a user registration with verification code
export const confirmSignUp = async ({ username, code }: ConfirmSignUpParams) => {
  try {
    await Auth.confirmSignUp(username, code);
    return true;
  } catch (error) {
    console.error('Error confirming sign up:', error);
    throw error;
  }
};

// Request a password reset
export const forgotPassword = async (username: string) => {
  try {
    await Auth.forgotPassword(username);
    return true;
  } catch (error) {
    console.error('Error requesting password reset:', error);
    throw error;
  }
};

// Complete password reset with verification code
export const confirmForgotPassword = async (username: string, code: string, newPassword: string) => {
  try {
    await Auth.forgotPasswordSubmit(username, code, newPassword);
    return true;
  } catch (error) {
    console.error('Error confirming password reset:', error);
    throw error;
  }
};

// Get the current authenticated user
export const getCurrentUser = async () => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Get current user's session
export const getCurrentSession = async () => {
  try {
    const session = await Auth.currentSession();
    return session;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
};

// Change password for authenticated user
export const changePassword = async (oldPassword: string, newPassword: string) => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    await Auth.changePassword(user, oldPassword, newPassword);
    return true;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
}; 