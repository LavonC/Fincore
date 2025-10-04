import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// Import your screens
import LoginPage from './screens/login';
import SignupScreen from './screens/signup';
import ExplorePage from './screens/explorepage';
import ConsentScreen from './screens/consentscreen';
import { 
  DashboardScreen, 
  StocksScreen, 
  AdvisorConnectScreen, 
  TaxCenterScreen 
} from './screens/placeholderscreens';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {/* Auth Screens */}
        <Stack.Screen name="Login" component={LoginPage} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        
        {/* Main App Screens */}
        <Stack.Screen name="Explore" component={ExplorePage} />
        
        {/* Consent Screen - Modal style */}
        <Stack.Screen 
          name="Consent" 
          component={ConsentScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        
        {/* Feature Screens */}
        <Stack.Screen 
          name="Dashboard" 
          component={DashboardScreen}
          options={{ headerShown: true, title: 'Dashboard' }}
        />
        <Stack.Screen 
          name="Stocks" 
          component={StocksScreen}
          options={{ headerShown: true, title: 'Stocks' }}
        />
        <Stack.Screen 
          name="AdvisorConnect" 
          component={AdvisorConnectScreen}
          options={{ headerShown: true, title: 'Advisor Connect' }}
        />
        <Stack.Screen 
          name="TaxCenter" 
          component={TaxCenterScreen}
          options={{ headerShown: true, title: 'Tax Center' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ==========================================
// REQUIRED PACKAGES
// ==========================================
// Install these packages:
// npm install @react-navigation/native @react-navigation/native-stack
// npm install react-native-screens react-native-safe-area-context
// npm install @react-native-community/datetimepicker
// npm install @react-native-async-storage/async-storage