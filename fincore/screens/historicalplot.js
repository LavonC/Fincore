// App.js
import React, { useState } from "react";
import { View, Text, Button, StyleSheet, ScrollView, ActivityIndicator, Dimensions,TextInput } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Picker } from "@react-native-picker/picker";

export default function CandleCloseChart() {
  const [company, setCompany] = useState("RELIANCE");
  const [dateOption, setDateOption] = useState("5_weeks");
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);

  const screenWidth = Dimensions.get("window").width - 20;

  const fetchData = async () => {
    setLoading(true);

    try {
      const res = await fetch(
        `http://192.168.1.4:5000/get_candles?company=${company}&date_option=${dateOption}&interval=ONE_DAY`
      );
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        const labels = data.map(item => {
          const date = new Date(item[0]);
          return `${date.getDate()}/${date.getMonth() + 1}`; 
        });

        const closes = data.map(item => item[4]);

        const maxLabels = 8;
        const step = Math.ceil(labels.length / maxLabels);
        const filteredLabels = labels.filter((_, i) => i % step === 0);
        const filteredCloses = closes.filter((_, i) => i % step === 0);

        setChartData({ labels: filteredLabels, closes: filteredCloses });
      } else {
        alert("No data found");
        setChartData(null);
      }
    } catch (err) {
      alert("Error fetching data: " + err.message);
    }

    setLoading(false);
  };

return (
    <ScrollView style={styles.container}>
        <Text style={styles.title}>Stock Candle Close Chart</Text>

        <View style={styles.card}>
            <Text style={styles.label}>Enter Company Stock Number</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                    <TextInput
                        style={{
                            borderWidth: 1,
                            borderColor: "#ccc",
                            borderRadius: 8,
                            padding: 10,
                            backgroundColor: "#fff",
                        }}
                        placeholder="e.g. 50089325"
                        value={company}
                        onChangeText={setCompany}
                        keyboardType="default"
                    />
                </View>
                <Button
                    title="Search"
               
                    color="#007AFF"
                />
            </View>

            <Text style={styles.label}>Select Date Range</Text>
            <Picker
                selectedValue={dateOption}
                style={styles.picker}
                onValueChange={value => setDateOption(value)}
            >
                <Picker.Item label="Last 5 Weeks" value="5_weeks" />
                <Picker.Item label="Last 1 Year" value="1_year" />
            </Picker>

            <Button title="Fetch Data" onPress={fetchData} />
        </View>

        {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

        {chartData && (
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>{company} - Closing Prices</Text>
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
                        style: { borderRadius: 16 },
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
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginVertical: 15 },
  card: { backgroundColor: "#fff", padding: 15, borderRadius: 12, marginBottom: 20, elevation: 3 },
  label: { marginVertical: 5, fontWeight: "bold", color: "#333" },
  picker: { height: 60, width: "100%" },
  chartCard: { backgroundColor: "#fff", padding: 15, borderRadius: 12, elevation: 3 },
  chartTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
});
