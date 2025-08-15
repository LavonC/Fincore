import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginPage from "./screens/login";
import appopen from "./screens/appopen";
import CandleCloseChart from "./screens/historicalplot";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="CandleCloseChart">
        <Stack.Screen
          name="Login"
          component={LoginPage}
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
        
       
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}