// CandleCloseChart.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import io from "socket.io-client";

export default function CandleCloseChart({ route }) {
  const { symbol, company: companyParam } = route.params || {};

  const [company] = useState(companyParam || symbol || "RELIANCE");
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState({ labels: [], closes: [] });

  const screenWidth = Dimensions.get("window").width - 20;

  useEffect(() => {
    setLoading(true);

    const socket = io("http://192.168.1.2:5000", {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected to backend");
      setLoading(false);
      socket.emit("start_stream", { symboltoken: "2885" });
    });

    socket.on("live_tick", (message) => {
      console.log("📩 Tick received:", message);

      try {
        const data = typeof message === "string" ? JSON.parse(message) : message;

        if (data.timestamp && data.close) {
          const date = new Date(data.timestamp);
          const label = `${date.getDate()}/${date.getMonth() + 1}`;

          setChartData((prev) => ({
            labels: [...prev.labels, label].slice(-15),
            closes: [...prev.closes, data.close].slice(-15),
          }));
        }
      } catch (err) {
        console.log("❌ Parse error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("⚠️ Socket disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, [company]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}></Text>

      {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

      {chartData.closes.length > 0 && (
        <View style={styles.chartCard}>
          <LineChart
            data={{
              labels: chartData.labels,
              datasets: [{ data: chartData.closes }],
            }}
            width={screenWidth}
            height={300}
            yAxisLabel="₹"
            chartConfig={{
              backgroundGradientFrom: "#f5f7fa",
              backgroundGradientTo: "#e4e7eb",
              decimalPlaces: 2,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              propsForDots: { r: "4", strokeWidth: "1", stroke: "#1cc910" },
            }}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#f0f3f7" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 15,
  },
  chartCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    elevation: 3,
  },
});
