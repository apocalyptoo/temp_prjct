
/*
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthContext } from '../contexts/AuthContext';

// Auth Screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/Auth/ResetPasswordScreen';
import RoleSelectionScreen from '../screens/Auth/RoleSelectionScreen';
import PlayerRegisterScreen from '../screens/Auth/PlayerRegisterScreen';
import OwnerRegisterScreen from '../screens/Auth/OwnerRegisterScreen';

// Player Screens
import PlayerDashboard from '../screens/Player/PlayerDashboard';
import PlayersListScreen from '../screens/Player/PlayersListScreen';
import InvitesScreen from '../screens/Player/InvitesScreen';
import TeamsListScreen from '../screens/Team/TeamsListScreen';
import CreateTeamScreen from '../screens/Team/CreateTeamScreen';
import MyTeamsScreen from '../screens/Team/MyTeamsScreen';
import TeamDetailScreen from '../screens/Team/TeamDetailScreen';
import AddMemberScreen from '../screens/Team/AddMemberScreen';

// Admin Screens
import AdminDashboard from '../screens/Admin/AdminDashboard';
import ManageUsersScreen from '../screens/Admin/ManageUsersScreen';
import ManageTeamsScreen from '../screens/Admin/ManageTeamsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true }}>
        //{ If user is NOT logged in }
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            
            <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
            <Stack.Screen name="PlayerRegister" component={PlayerRegisterScreen} />
            <Stack.Screen name="OwnerRegister" component={OwnerRegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        ) : user.role === 'PLAYER' ? (
          // If user is a PLAYER 
          <>
            <Stack.Screen name="PlayerDashboard" component={PlayerDashboard} />
            <Stack.Screen name="Teams" component={TeamsListScreen} />
            <Stack.Screen name="CreateTeam" component={CreateTeamScreen} />
            <Stack.Screen name="MyTeams" component={MyTeamsScreen} />
            <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
            <Stack.Screen name="AddMember" component={AddMemberScreen} />
            <Stack.Screen name="Players" component={PlayersListScreen} />
            <Stack.Screen name="Invites" component={InvitesScreen} />
          </>
        ) : user.role === 'ADMIN' ? (
          // If user is an ADMIN 
          <>
            <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
            <Stack.Screen name="ManageUsers" component={ManageUsersScreen} />
            <Stack.Screen name="ManageTeams" component={ManageTeamsScreen} />
          </>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}*/


import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthContext } from '../contexts/AuthContext';

// Auth Screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RoleSelectionScreen from '../screens/Auth/RoleSelectionScreen';
import PlayerRegisterScreen from '../screens/Auth/PlayerRegisterScreen';
import OwnerRegisterScreen from '../screens/Auth/OwnerRegisterScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/Auth/ResetPasswordScreen';

// Player Screens
import PlayerDashboard from '../screens/Player/PlayerDashboard';
import PlayersListScreen from '../screens/Player/PlayersListScreen';
import InvitesScreen from '../screens/Player/InvitesScreen';
import TeamsListScreen from '../screens/Team/TeamsListScreen';
import CreateTeamScreen from '../screens/Team/CreateTeamScreen';
import MyTeamsScreen from '../screens/Team/MyTeamsScreen';
import TeamDetailScreen from '../screens/Team/TeamDetailScreen';
import AddMemberScreen from '../screens/Team/AddMemberScreen';

// Admin Screens
import AdminDashboard from '../screens/Admin/AdminDashboard';
import ManageUsersScreen from '../screens/Admin/ManageUsersScreen';
import ManageTeamsScreen from '../screens/Admin/ManageTeamsScreen';

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="PlayerRegister" component={PlayerRegisterScreen} />
      <Stack.Screen name="OwnerRegister" component={OwnerRegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function PlayerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="PlayerDashboard" component={PlayerDashboard} />
      <Stack.Screen name="Teams" component={TeamsListScreen} />
      <Stack.Screen name="CreateTeam" component={CreateTeamScreen} />
      <Stack.Screen name="MyTeams" component={MyTeamsScreen} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
      <Stack.Screen name="AddMember" component={AddMemberScreen} />
      <Stack.Screen name="Players" component={PlayersListScreen} />
      <Stack.Screen name="Invites" component={InvitesScreen} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="ManageUsers" component={ManageUsersScreen} />
      <Stack.Screen name="ManageTeams" component={ManageTeamsScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null;

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : user.role === 'PLAYER' ? (
        <PlayerStack />
      ) : user.role === 'ADMIN' ? (
        <AdminStack />
      ) : null}
    </NavigationContainer>
  );
}