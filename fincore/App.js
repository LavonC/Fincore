// ==========================================
// APP.JS - NAVIGATION SETUP WITH CONSENT CHECK
// ==========================================

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from "expo-status-bar";

// Import your screens
import LoginPage from './screens/login';
import SignupScreen from './screens/signup';
import OTPVerificationScreen from './screens/OTPVerificationScreen';
import ExplorePage from './screens/explorepage';
import ConsentScreen from './screens/consentscreen';
import FinancialDashboard from './screens/financialdashboard';
import TransactionsScreen from './screens/transactions';
import AccountsScreen from './screens/accountsscreen';
import { StocksScreen, AdvisorConnectScreen, TaxCenterScreen } from './screens/placeholderscreens';
import appopen from "./screens/appopen";
import CandleCloseChart from "./screens/Stocks/CandleCloseChart";
import DashboardScreen from "./screens/dashboard/DashboardScreen";
import FinancialAdvisorScreen from "./screens/dashboard/FinancialAdvisorScreen";
import StocksScreenDashboard from "./screens/dashboard/StocksScreen";
import TaxFilingScreen from "./screens/dashboard/TaxFilingScreen";
import MainTabNavigator from "./screens/MainTabNavigator";
import StockHome from "./screens/Stocks/stockhome";
import RegistrationScreen from "./screens/Stocks/registrationscreen";
import LoginScreen from "./screens/Stocks/loginscreen";

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
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen name="RegistrationScreen" component={RegistrationScreen} />
        <Stack.Screen name="Login" component={LoginPage} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen 
          name="OTPVerification" 
          component={OTPVerificationScreen}
          options={{
            headerShown: true,
            title: 'Verify OTP',
          }}
        />

        {/* App Open / Charts */}
        <Stack.Screen name="AppOpen" component={appopen} />
        <Stack.Screen name="CandleCloseChart" component={CandleCloseChart} />

        {/* Main App / Tabs */}
        <Stack.Screen name="MainApp" component={MainTabNavigator} />

        {/* Main Screens */}
        <Stack.Screen name="StockHome" component={StockHome} />
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
        <Stack.Screen name="Dashboard" component={FinancialDashboard} />
        <Stack.Screen name="Transactions" component={TransactionsScreen} />
        <Stack.Screen name="Accounts" component={AccountsScreen} />
        <Stack.Screen name="Stocks" component={StocksScreen} options={{ headerShown: true, title: 'Stocks' }} />
        <Stack.Screen name="AdvisorConnect" component={AdvisorConnectScreen} options={{ headerShown: true, title: 'Advisor Connect' }} />
        <Stack.Screen name="TaxCenter" component={TaxCenterScreen} options={{ headerShown: true, title: 'Tax Center' }} />
      </Stack.Navigator>

      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
