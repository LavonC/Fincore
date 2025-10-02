import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import {
  Search,
  History,
  Home,
  Star,
  Briefcase,
  FileText,
  Wallet,
  AppWindow,
  UserCircle,
} from "lucide-react-native";
import Papa from "papaparse";
import { BarChart } from "lucide-react-native";
import { TrendingUp } from "lucide-react-native";

import { useNavigation } from "@react-navigation/native";


const StockHome = ({navigation}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [inSearchMode, setInSearchMode] = useState(false);
  const [csvData, setCsvData] = useState([]);

 
  useEffect(() => {
    const loadCSV = async () => {
      try {
        // 👇 replace with your Flask server's IP
        const response = await fetch("http://192.168.1.2:5000/get_csv"); 
        const text = await response.text();

        const parsed = Papa.parse(text, { header: true });
        setCsvData(parsed.data);

        console.log("First 5 rows:", parsed.data.slice(0, 5));
      } catch (err) {
        console.error("Error fetching CSV:", err);
      }
    };

    loadCSV();
  }, []);



  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  };
const handleSearch = async (queryText) => {
  if (!queryText) return;

  setIsLoading(true);
  setSearchResult(null);
  setError(null);

  try {
    const lowerQuery = queryText.toLowerCase();
    const matched = csvData.filter(
      (item) =>
        item["NAME OF COMPANY"]?.toLowerCase().includes(lowerQuery) ||
        item["SYMBOL"]?.toLowerCase() === lowerQuery
    );

    if (matched.length > 0) {
      const formatted = matched.slice(0, 10).map((item) => (
        <TouchableOpacity
          key={item["SYMBOL"]}
          style={[
            styles.resultBox,
            {
              marginBottom: 20,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 4,
              paddingVertical: 13,
            },
          ]}
          onPress={() =>
            navigation.navigate("CandleCloseChart", {
              symbol: item["SYMBOL"],
              company: item["NAME OF COMPANY"],
            })
          }
        >
          {/* Generic stock icon on the left */}
 <View
    style={{
      width: 34,
      height: 34,
      borderRadius: 20, // half of width/height to make it circular
      backgroundColor: "#faf2f2ff", // light gray circle
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    }}
  >
    <TrendingUp size={20} color="#555" />
  </View>
          {/* Symbol and company name */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16 }}>{item["NAME OF COMPANY"]}</Text>
            <Text style={{  fontSize: 14,color: "#888" }}>{item["SYMBOL"]}</Text>
            
          </View>
        </TouchableOpacity>
      ));

      // Save JSX list instead of string
      setSearchResult(formatted);
    } else {
      setSearchResult(<Text>No matching company found.</Text>);
    }
  } catch (err) {
    setError("Error during search: " + err.message);
  }

  setIsLoading(false);
};


  const exitSearchMode = () => {
    setInSearchMode(false);
    setSearchTerm("");
    setSearchResult(null);
    setError(null);
  };

  return (
    <View style={styles.container}>
      {/* ---------- NORMAL HOME PAGE ---------- */}
      {!inSearchMode ? (
        <>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.row}>
              <AppWindow color="gray" />
              <Text style={styles.headerText}>Products</Text>
            </View>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => setInSearchMode(true)}
                style={styles.iconBtn}
              >
                <Search color="gray" />
              </TouchableOpacity>
              <Wallet color="blue" />
            </View>
          </View>

          <ScrollView style={styles.main}>
            <Text style={styles.title}>Welcome to Stock App</Text>
            <View style={styles.centerBox}>
              <History size={32} color="gray" />
              <Text style={{ color: "gray", marginTop: 5 }}>
                Start searching to see stock details.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => showMessage("Home clicked!")}>
              <View style={styles.footerBtn}>
                <Home color="blue" />
                <Text style={styles.footerTextActive}>Home</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => showMessage("Watchlist clicked!")}>
              <View style={styles.footerBtn}>
                <Star color="gray" />
                <Text style={styles.footerText}>Watchlist</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => showMessage("Portfolio clicked!")}>
              <View style={styles.footerBtn}>
                <Briefcase color="gray" />
                <Text style={styles.footerText}>Portfolio</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => showMessage("Orders clicked!")}>
              <View style={styles.footerBtn}>
                <FileText color="gray" />
                <Text style={styles.footerText}>Orders</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => showMessage("Account clicked!")}>
              <View style={styles.footerBtn}>
                <UserCircle color="gray" />
                <Text style={styles.footerText}>Account</Text>
              </View>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        /* ---------- SEARCH PAGE ---------- */
        <View style={{ flex: 1, backgroundColor: "white" }}>
          {/* Search Bar (only visible in search mode) */}
          <View style={styles.searchHeader}>
            {/* Back button */}
            <TouchableOpacity onPress={exitSearchMode} style={{ padding: 8 }}>
              <Text style={{ fontSize: 18 }}>←</Text>
            </TouchableOpacity>

            {/* Search input */}
            <TextInput
              placeholder='Search "Recent IPOs"'
              value={searchTerm}
               onChangeText={(text) => {
               setSearchTerm(text);      // update the text state
               handleSearch(text);       // trigger search immediately
           }}
           
              style={styles.searchInput}
            />

            {/* Search button */}
            <TouchableOpacity
              onPress={() => handleSearch(searchTerm)}
              style={styles.searchBtn}
            >
              <Search size={18} color="white" />
            </TouchableOpacity>
          </View>

          {/* Search Results */}
          <ScrollView style={{ flex: 1, padding: 12 }}>
            {isLoading && (
              <ActivityIndicator
                size="large"
                color="blue"
                style={{ marginVertical: 20 }}
              />
            )}
            {error && (
              <Text style={{ color: "red", marginBottom: 10 }}>{error}</Text>
            )}
            {searchResult && (
              <View style={styles.resultBox}>
                <Text>{searchResult}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Toast Messages */}
      {message && (
        <View style={styles.toast}>
          <Text style={{ color: "white" }}>{message}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  header: {
    padding: 12,
    marginTop: 40,
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { marginLeft: 6, fontSize: 14, color: "gray" },
  iconBtn: { padding: 6 },
  main: { flex: 1, padding: 12 },
  title: { fontSize: 18, fontWeight: "bold", marginVertical: 10 },
  centerBox: { alignItems: "center", marginVertical: 20 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginBottom: 20,
  },
  footerBtn: { alignItems: "center" },
  footerText: { fontSize: 12, color: "gray" },
  footerTextActive: { fontSize: 12, color: "blue", marginTop: 2 },
  toast: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: "black",
    padding: 10,
    borderRadius: 20,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginTop: 40, // Safe area / status bar
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  searchBtn: {
    marginLeft: 8,
    backgroundColor: "#3b82f6",
    padding: 10,
    borderRadius: 20,
  },
  resultBox: {
    backgroundColor: "white",
    padding: 0,
    borderRadius: 8,
    marginBottom: 19  },
});

export default StockHome;
