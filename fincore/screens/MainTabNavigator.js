import React from 'react';
import { Image, Text,TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from './dashboard/DashboardScreen';
import FinancialAdvisorScreen from './dashboard/FinancialAdvisorScreen';
import StocksScreen from './dashboard/StocksScreen';
import TaxFilingScreen from './dashboard/TaxFilingScreen';
import CandleCloseChart from './Stocks/CandleCloseChart';


const Tab = createBottomTabNavigator();


const dashboardIcon = require('../assets/c6884d1843565a8170a3c4dcff0d6dcd.jpg');
const advisorIcon = require('../assets/febc5f95f88cdf83be93194de7265f67.jpg');
const stocksIcon = require('../assets/d7f2c9b7a05f1e67e863b26f4bd3a8aa.jpg');
const taxIcon = require('../assets/ab25215cb6383d3f25cfed4a32e61cb5.jpg');

const MainTabNavigator = ({ navigation }) => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '700',
          fontFamily: 'Helvetica', // Change font family here
          letterSpacing: 0.5,      // Add spacing between letters
          textTransform: 'capitalize',
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          height: 70,
          paddingBottom: 5,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 5,
        },
        headerStyle: {
          backgroundColor: '#f5f5f5',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
          fontFamily: 'Helvetica', // Stylish header font
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: () => (
            <Image
              source={dashboardIcon}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
          ),
        }}
      />
    <Tab.Screen
  name="Advisor"
  component={FinancialAdvisorScreen}
  options={{
    tabBarLabel: ({ focused, color }) => (
      <Text
        style={{
          color: color,
          fontSize: 13,   // smaller font
          fontWeight: '700',
          textAlign: 'center',
        }}
        numberOfLines={1}  // ensures text fits in one line
      >
         Advisor
      </Text>
    ),
    tabBarIcon: () => (
      <Image
        source={advisorIcon}
        style={{ width: 28, height: 28 }}
        resizeMode="contain"
      />
    ),
  }}
/>

<Tab.Screen
  name="Stocks"
  component={CandleCloseChart}  // now Stocks tab opens CandleCloseChart
  options={{
    tabBarIcon: () => (
      <Image
        source={stocksIcon}
        style={{ width: 28, height: 28 }}
        resizeMode="contain"
      />
    ),
  }}
/>

      <Tab.Screen
        name="Tax Filing"
        component={TaxFilingScreen}
        options={{
          tabBarIcon: () => (
            <Image
              source={taxIcon}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
