import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LoginPage from "./screens/login";
import appopen from "./screens/appopen";
import CandleCloseChart from "./screens/historicalplot";
import SignupScreen from "./screens/signup";
import DashboardScreen from "./screens/dashboard/DashboardScreen";
import FinancialAdvisorScreen from "./screens/dashboard/FinancialAdvisorScreen";
import StocksScreen from "./screens/dashboard/StocksScreen";
import TaxFilingScreen from "./screens/dashboard/TaxFilingScreen";
import MainTabNavigator from "./screens/MainTabNavigator";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
     <Stack.Navigator initialRouteName="MainApp">
  <Stack.Screen
    name="Login"
    component={LoginPage}
    options={{ headerShown: false }}
  />
  <Stack.Screen
    name="Signup"
    component={SignupScreen}
    options={{ headerShown: false }}
  />
  <Stack.Screen
    name="AppOpen"
    component={appopen}
    options={{ headerShown: false }}
  />
  <Stack.Screen
    name="CandleCloseChart"
    component={CandleCloseChart}
    options={{ headerShown: false }}
  />
  <Stack.Screen
    name="MainApp"
    component={MainTabNavigator}
    options={{ headerShown: false }}
  />
</Stack.Navigator>

      <StatusBar style="auto" />
    </NavigationContainer>
  );
}