import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from "react-native";
import { ArrowLeft, Plus, Home, Search, Briefcase, User } from "lucide-react-native";
import Papa from "papaparse";
import { API_ENDPOINTS } from "../../apiConfig";


const StockHome = ({ navigation }) => {
  const [portfolioData, setPortfolioData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Stocks");

  const [inSearchMode, setInSearchMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [activeScreen, setActiveScreen] = useState("Portfolio"); // Track active bottom nav screen

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const fetchPortfolioData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(API_ENDPOINTS.GET_COMPANYS);
      if (!response.ok) throw new Error("Failed to fetch portfolio data");
      const text = await response.text();
      const parsed = Papa.parse(text, { header: true });
      setPortfolioData(parsed.data || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching portfolio:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotalValue = () => {
    return portfolioData.reduce((total, stock) => total + (parseFloat(stock.value) || 0), 0);
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSearch = (query) => {
    setSearchTerm(query);
    if (!query) {
      setSearchResult([]);
      return;
    }
    const results = portfolioData.filter(
      (stock) =>
        stock["NAME OF COMPANY"]?.toLowerCase().includes(query.toLowerCase()) ||
        stock["SYMBOL"]?.toLowerCase() === query.toLowerCase()
    );
    setSearchResult(results);
  };

  const filteredStocksByTab = portfolioData.filter(
    (stock) => stock.TYPE?.toLowerCase() === activeTab.toLowerCase()
  );

  const handleNavigation = (screen) => {
    setActiveScreen(screen);
    setInSearchMode(false);
    setSearchTerm("");
    setSearchResult([]);
    if (screen !== "Portfolio") {
      navigation.navigate(screen);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (inSearchMode) {
              setInSearchMode(false);
              setSearchTerm("");
              setSearchResult([]);
            } else {
              navigation.goBack();
            }
          }}
        >
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>

        {inSearchMode ? (
          <TextInput
            placeholder="Search company..."
            placeholderTextColor="#cbd5e1"
            value={searchTerm}
            onChangeText={handleSearch}
            style={[styles.searchInput, { flex: 1, marginLeft: 12 }]}
          />
        ) : (
          <Text style={styles.headerTitle}>Portfolio</Text>
        )}

        {!inSearchMode && (
          <TouchableOpacity>
            <Plus color="white" size={24} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPortfolioData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {!inSearchMode && (
            <View style={styles.profileSection}>
              <Text style={styles.totalLabel}>Total Portfolio Value</Text>
              <Text style={styles.totalValue}>{formatCurrency(calculateTotalValue())}</Text>
            </View>
          )}

          {!inSearchMode && (
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === "Stocks" && styles.activeTab]}
                onPress={() => setActiveTab("Stocks")}
              >
                <Text style={[styles.tabText, activeTab === "Stocks" && styles.activeTabText]}>
                  Stocks
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === "Crypto" && styles.activeTab]}
                onPress={() => setActiveTab("Crypto")}
              >
                <Text style={[styles.tabText, activeTab === "Crypto" && styles.activeTabText]}>
                  Crypto
                </Text>
              </TouchableOpacity>
            </View>
          )}

        <View style={styles.stockList}>
  {(inSearchMode ? searchResult : filteredStocksByTab).length > 0 ? (
    (inSearchMode ? searchResult : filteredStocksByTab).map((stock, index) => (
      <TouchableOpacity
        key={index}
        style={styles.stockItem}
        onPress={() =>
          navigation.navigate("CandleCloseChart", { 
            stockSymbol: stock.SYMBOL, 
            companyName: stock["NAME OF COMPANY"] 
          })
        }
      >
        <Text style={styles.stockName}>{stock["NAME OF COMPANY"]}</Text>
        <Text style={styles.stockShares}>{stock.SYMBOL}</Text>
      </TouchableOpacity>
    ))
  ) : (
    <Text style={{ padding: 16, color: "white" }}>
      {inSearchMode
        ? searchTerm !== ""
          ? "No matching company found"
          : ""
        : `No ${activeTab.toLowerCase()} in your portfolio`}
    </Text>
  )}
</View>


        </ScrollView>
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation("")}>
          <Home color={activeScreen === "Dashboard" ? "#ffffff" : "#6b7280"} size={24} />
          <Text style={[styles.navText, { color: activeScreen === "Dashboard" ? "#ffffff" : "#6b7280" }]}>
            Dashboard
          </Text>
        </TouchableOpacity>

     <TouchableOpacity
  style={styles.navItem}
  onPress={() => {
    setActiveScreen("Search"); // make Search active
    setInSearchMode(true);
    setSearchTerm("");
    setSearchResult([]);
  }}
>
  <Search color={inSearchMode ? "#ffffff" : "#6b7280"} size={24} />
  <Text style={[styles.navText, { color: inSearchMode ? "#ffffff" : "#6b7280" }]}>Search</Text>
</TouchableOpacity>

<TouchableOpacity style={styles.navItem} onPress={() => handleNavigation("Portfolio")}>
  <Briefcase color={activeScreen === "Portfolio" && !inSearchMode ? "#ffffff" : "#6b7280"} size={24} />
  <Text style={[styles.navText, { color: activeScreen === "Portfolio" && !inSearchMode ? "#ffffff" : "#6b7280" }]}>
    Portfolio
  </Text>
</TouchableOpacity>


        <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation("Profile")}>
          <User color={activeScreen === "Profile" ? "#ffffff" : "#6b7280"} size={24} />
          <Text style={[styles.navText, { color: activeScreen === "Profile" ? "#ffffff" : "#6b7280" }]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "#0f172a",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "white" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  errorText: { color: "#ef4444", fontSize: 16, marginBottom: 16, textAlign: "center" },
  retryButton: { backgroundColor: "#3b82f6", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  content: { flex: 1 },
  profileSection: { alignItems: "center", paddingVertical: 16 },
  totalLabel: { fontSize: 14, color: "#94a3b8", marginBottom: 4 },
  totalValue: { fontSize: 20, fontWeight: "600", color: "white" },
  tabContainer: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: "#3b82f6" },
  tabText: { fontSize: 16, color: "#94a3b8", fontWeight: "500" },
  activeTabText: { color: "white" },
  stockList: { paddingHorizontal: 16, paddingBottom: 100 },
  stockItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  stockName: { fontSize: 16, fontWeight: "500", color: "white" },
  stockShares: { fontSize: 14, color: "#64748b" },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 12, paddingBottom: 28, backgroundColor: "#1e293b", borderTopWidth: 1, borderTopColor: "#334155" },
  navItem: { alignItems: "center" },
  navText: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  searchInput: { backgroundColor: "#1e293b", padding: 8, color: "white", borderRadius: 8 },
});

export default StockHome;
