import { useState } from 'react';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';

export function AuthNavigator() {
  const [isSignUp, setIsSignUp] = useState(false);

  if (isSignUp) {
    return <SignUpScreen onToggle={() => setIsSignUp(false)} />;
  }

  return <SignInScreen onToggle={() => setIsSignUp(true)} />;
}
