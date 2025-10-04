import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const ConsentScreen = ({ navigation, route }) => {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isRangeExpanded, setIsRangeExpanded] = useState(false);
  const [consentDays, setConsentDays] = useState('30');

  const formatDate = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const onStartDateChange = (event, selectedDate) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const handleConsentDaysChange = (text) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    setConsentDays(numericValue);
  };

  const handleSubmitConsent = async () => {
    // Validate consent days
    const days = parseInt(consentDays);
    if (!days || days <= 0) {
      alert('Please enter a valid number of days');
      return;
    }

    if (days > 365) {
      alert('Consent range cannot exceed 365 days');
      return;
    }

    try {
      // Save consent data
      // await AsyncStorage.setItem('consentGiven', 'true');
      // await AsyncStorage.setItem('consentStartDate', startDate.toISOString());
      // await AsyncStorage.setItem('consentEndDate', endDate.toISOString());
      // await AsyncStorage.setItem('consentDays', consentDays);
      
      // Navigate to Dashboard
      navigation.navigate('Dashboard');
    } catch (error) {
      console.error('Error saving consent:', error);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Consent</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Start Date Picker */}
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowStartPicker(true)}
          >
            <Text style={styles.dateLabel}>Start date</Text>
            <View style={styles.dateValueContainer}>
              <Text style={styles.dateValue}>
                {startDate ? formatDate(startDate) : 'Select date'}
              </Text>
              <Text style={styles.calendarIcon}>📅</Text>
            </View>
          </TouchableOpacity>

          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onStartDateChange}
            />
          )}

          {/* End Date Picker */}
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowEndPicker(true)}
          >
            <Text style={styles.dateLabel}>End date</Text>
            <View style={styles.dateValueContainer}>
              <Text style={styles.dateValue}>
                {endDate ? formatDate(endDate) : 'Select date'}
              </Text>
              <Text style={styles.calendarIcon}>📅</Text>
            </View>
          </TouchableOpacity>

          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onEndDateChange}
              minimumDate={startDate}
            />
          )}

          {/* Consent Range Input */}
          <View style={styles.rangeInputContainer}>
            <View style={styles.rangeMainRow}>
              <Text style={styles.rangeLabel}>Consent range</Text>
              <View style={styles.rangeInputRow}>
                <View style={styles.daysInputWrapper}>
                  <TextInput
                    style={styles.daysInput}
                    value={consentDays}
                    onChangeText={handleConsentDaysChange}
                    keyboardType="number-pad"
                    placeholder="30"
                    placeholderTextColor="#6B7280"
                    maxLength={3}
                  />
                  <Text style={styles.daysLabel}>days</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsRangeExpanded(!isRangeExpanded)}
                  style={styles.expandButton}
                >
                  <View style={styles.chevronContainer}>
                    <Text style={[styles.chevronIcon, isRangeExpanded && styles.chevronActive]}>▲</Text>
                    <Text style={[styles.chevronIcon, !isRangeExpanded && styles.chevronActive]}>▼</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {isRangeExpanded && (
              <View style={styles.rangeExpandedContent}>
                <Text style={styles.rangeDescription}>
                  Quick select:
                </Text>
                <View style={styles.quickSelectButtons}>
                  <TouchableOpacity
                    style={styles.quickSelectButton}
                    onPress={() => setConsentDays('30')}
                  >
                    <Text style={styles.quickSelectButtonText}>30 days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickSelectButton}
                    onPress={() => setConsentDays('90')}
                  >
                    <Text style={styles.quickSelectButtonText}>90 days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickSelectButton}
                    onPress={() => setConsentDays('180')}
                  >
                    <Text style={styles.quickSelectButtonText}>180 days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickSelectButton}
                    onPress={() => setConsentDays('365')}
                  >
                    <Text style={styles.quickSelectButtonText}>1 year</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmitConsent}
          activeOpacity={0.8}
        >
          <Text style={styles.submitButtonText}>Submit Consent</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1f2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  closeIcon: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '300',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  dateInput: {
    backgroundColor: '#2d3f4f',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  dateValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateValue: {
    fontSize: 16,
    color: '#ffffff',
  },
  calendarIcon: {
    fontSize: 20,
  },
  rangeInputContainer: {
    backgroundColor: '#2d3f4f',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  rangeMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: 14,
    color: '#9ca3af',
    flex: 1,
  },
  rangeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  daysInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
  },
  daysInput: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  daysLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 4,
  },
  expandButton: {
    padding: 4,
  },
  chevronContainer: {
    gap: 2,
  },
  chevronIcon: {
    fontSize: 12,
    color: '#6B7280',
  },
  chevronActive: {
    color: '#9ca3af',
  },
  rangeExpandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  rangeDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 12,
  },
  quickSelectButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickSelectButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  quickSelectButtonText: {
    fontSize: 14,
    color: '#00d4d4',
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 16,
    backgroundColor: '#1a1f2e',
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
  },
  submitButton: {
    backgroundColor: '#00d4d4',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#1a1f2e',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConsentScreen;