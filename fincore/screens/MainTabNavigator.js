import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from './dashboard/DashboardScreen';
import FinancialAdvisorScreen from './dashboard/FinancialAdvisorScreen';
import StocksScreen from './dashboard/StocksScreen';
import TaxFilingScreen from './dashboard/TaxFilingScreen';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#f5f5f5',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
      />
      <Tab.Screen 
        name="Financial Advisor" 
        component={FinancialAdvisorScreen} 
      />
      <Tab.Screen 
        name="Stocks" 
        component={StocksScreen}
      />
      <Tab.Screen 
        name="Tax Filing" 
        component={TaxFilingScreen}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
