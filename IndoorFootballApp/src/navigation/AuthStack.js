import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/Auth/LoginScreen';
import RoleSelectionScreen from '../screens/Auth/RoleSelectionScreen';
import PlayerRegisterScreen from '../screens/Auth/PlayerRegisterScreen';
import OwnerRegisterScreen from '../screens/Auth/OwnerRegisterScreen';
import CheckEmailScreen from '../screens/Auth/CheckEmailScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';

// Developer-only component gallery. It's required inside the __DEV__ check (not
// imported at the top) on purpose: a release build replaces __DEV__ with false and
// drops this branch before collecting files, so the screen is neither registered nor
// bundled there.
const UIGalleryScreen = __DEV__
  ? require('../screens/Dev/UIGalleryScreen').default
  : null;

const Stack = createNativeStackNavigator();

// Logged out: Login, the role choice, the two sign-up forms, Check your email and Forgot
// password (docs/features/profiles-and-registration.md, section e). Every screen draws
// its own title and back link, so the stack header is off.
export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="PlayerRegister" component={PlayerRegisterScreen} />
      <Stack.Screen name="OwnerRegister" component={OwnerRegisterScreen} />
      <Stack.Screen name="CheckEmail" component={CheckEmailScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      {UIGalleryScreen ? (
        <Stack.Screen name="UIGallery" component={UIGalleryScreen} />
      ) : null}
    </Stack.Navigator>
  );
}
