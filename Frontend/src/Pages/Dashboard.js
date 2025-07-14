import { useState, useEffect, useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, TrendingUp, DollarSign, Zap, Gauge, Factory, Settings, Leaf, Target, Database, RefreshCw } from 'lucide-react';

// Business-critical constants for cost calculations
const U_CLEAN = 2500; // Peak efficiency heat transfer rate (W/m²K)
const AREA = 44370; // Total condenser surface area (m²)
const ENERGY_RATE = 0.12; // Electricity cost ($/kWh)
const OPERATING_HOURS = 24; // Plant runs 24/7
const COAL_PRICE = 5000; // Coal cost (₹/ton)
const CO2_FACTOR = 2.86; // CO2 emissions per kg of coal
const MAINTENANCE_COST_FACTOR = 0.15; // Maintenance is 15% of energy losses
const EFFICIENCY_LOSS_FACTOR = 0.08; // Other operational costs

// Database configuration - update these with your actual database settings
const DB_CONFIG = {
  apiEndpoint: '/api/heat-exchanger-data', // Full URL
  bucket: 'New heat exchanger',
  measurement: 'heat_exchanger_readings',
  refreshInterval: 60000,
  maxRetries: 3,
  timeout: 10000
};

// Sample yearly performance data (fallback)
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const actualScaling = [0.0020, 0.0022, 0.0024, 0.0026, 0.0028, 0.0025, 0.0023, 0.0027, 0.0029, 0.0031, 0.0033, 0.0035];
const energyCosts = [12.5, 13.2, 14.1, 15.3, 16.8, 15.9, 14.7, 16.2, 17.5, 18.9, 20.1, 21.3];

// Business calculations
const calculateThermalEfficiency = (ufoul, uclean) => (ufoul / uclean) * 100;
const calculateEnergyLoss = (uclean, ufoul, area, lmtd) => (uclean - ufoul) * area * lmtd / 1000;
const calculateDailyCost = (energyLoss, energyRate, hours) => energyLoss * energyRate * hours;
const calculateCoalConsumption = (energyLoss, hours) => (energyLoss * hours * 0.36) / 1000;
const calculateCO2Emissions = (coalConsumption) => coalConsumption * CO2_FACTOR;

// Database service functions
const DatabaseService = {
  // Fetch data from database with retry logic and detailed logging
  async fetchData(timeframe = '24h', retries = 0) {
    const attemptNumber = retries + 1;
    console.log(`🔄 Database fetch attempt ${attemptNumber}/${DB_CONFIG.maxRetries + 1}`);
    console.log(`📊 Requesting data for timeframe: ${timeframe}`);
    console.log(`🔗 API endpoint: ${DB_CONFIG.apiEndpoint}`);
    console.log(`⏱️ Request timeout: ${DB_CONFIG.timeout}ms`);
    
    try {
      const startTime = Date.now();
      console.log(`🚀 Starting HTTP request at ${new Date().toISOString()}`);
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Request timeout after ${DB_CONFIG.timeout}ms`);
        controller.abort();
      }, DB_CONFIG.timeout);

      const response = await fetch(`${DB_CONFIG.apiEndpoint}?timeframe=${timeframe}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const requestDuration = Date.now() - startTime;
      console.log(`⚡ HTTP request completed in ${requestDuration}ms`);
      console.log(`📡 Response status: ${response.status} ${response.statusText}`);
      console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HTTP Error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      console.log(`📄 Parsing response JSON...`);
      const data = await response.json();
      console.log(`✅ Successfully parsed JSON response`);
      console.log(`📊 Data length: ${Array.isArray(data) ? data.length : 'N/A'} records`);
      
      // Validate data structure
      if (!Array.isArray(data)) {
        console.error(`❌ Invalid data format - expected array, got:`, typeof data);
        console.error(`📝 Data sample:`, data);
        throw new Error('Invalid data format received from database');
      }

      if (data.length === 0) {
        console.warn(`⚠️ Database returned empty array`);
        throw new Error('No data available from database');
      }

      // Log sample data structure
      console.log(`📋 Sample data structure (first record):`, data[0]);
      console.log(`🔍 Data keys:`, Object.keys(data[0] || {}));
      
      // Validate required fields
      const requiredFields = ['Timestamp', 'Ufoul', 'Uclean', 'Rfoul', 'LMTD', 'Tcw in', 'Tcw out', 'Psat'];
      const missingFields = requiredFields.filter(field => !(field in (data[0] || {})));
      
      if (missingFields.length > 0) {
        console.warn(`⚠️ Missing required fields:`, missingFields);
      }

      console.log(`🎉 Database fetch successful! Retrieved ${data.length} records`);
      return data;

    } catch (error) {
      const requestDuration = Date.now() - Date.now();
      console.error(`💥 Database fetch attempt ${attemptNumber} failed after ${requestDuration}ms:`, error);
      
      // Log specific error types
      if (error.name === 'AbortError') {
        console.error(`⏰ Request timed out after ${DB_CONFIG.timeout}ms`);
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error(`🌐 Network error - check if API server is running`);
      } else if (error.name === 'SyntaxError') {
        console.error(`📄 JSON parsing error - server returned invalid JSON`);
      }
      
      console.error(`🔍 Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      if (retries < DB_CONFIG.maxRetries) {
        const delay = Math.pow(2, retries) * 1000;
        console.log(`⏳ Retrying in ${delay}ms... (${DB_CONFIG.maxRetries - retries} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchData(timeframe, retries + 1);
      }
      
      console.error(`🚫 All ${DB_CONFIG.maxRetries + 1} attempts failed. Giving up.`);
      throw error;
    }
  },

  // Generate mock data as fallback
  generateMockData() {
    const mockData = [];
    const now = new Date();
    // Generate data for the past 1.5 years for seasonal lookups
    const startDate = new Date(now.getFullYear() - 1, now.getMonth() - 6, now.getDate()); // ~1.5 years ago
    let currentTimestamp = startDate.getTime();

    // Generate more data points for better historical context for mock data
    while (currentTimestamp <= now.getTime()) {
      mockData.push({
        Timestamp: new Date(currentTimestamp).toISOString(),
        Psat: 0.153 + Math.random() * 0.01,
        Tsat: 52 + Math.random() * 2,
        LMTD: 14 + Math.random() * 2,
        'Tcw in': 29 + Math.random() * 2,
        'Tcw out': 45 + Math.random() * 2,
        Mcw: 22000 + Math.random() * 1000,
        Cpw: 4.14,
        Ufoul: 2300 + Math.random() * 100,
        Uclean: U_CLEAN,
        Rfoul: 0.000025 + Math.random() * 0.000005 // Keep Rfoul realistic but varied
      });
      currentTimestamp += 30 * 60 * 1000; // Every 30 minutes
    }
    return mockData;
  }
};

// UI styling
const KPI_CARD_STYLES = "bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 shadow-lg text-white";
const KPI_ICON_STYLES = "h-8 w-8 mb-2 opacity-80";

// Dashboard components
const KpiCard = ({ title, value, unit, icon, color, trend }) => (
  <div className={KPI_CARD_STYLES}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <div className="flex items-center gap-1">
        <div style={{ color }}>{icon}</div>
      </div>
    </div>
    <p className="text-3xl font-bold mt-2">{value}<span className="text-lg ml-1 font-normal">{unit}</span></p>
  </div>
);

const ProfessionalGauge = ({ value, max, min = 0, title, unit, target, status }) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const targetPercentage = ((target - min) / (max - min)) * 100;
  
  const getStatusColor = () => {
    switch(status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'good': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: getStatusColor() }}></div>
          <span className="text-xs text-slate-300">{status}</span>
        </div>
      </div>
      
      <div className="relative w-32 h-16 mx-auto mb-4">
        <svg width="128" height="64" viewBox="0 0 128 64" className="overflow-visible">
          <path
            d="M 16 48 A 48 48 0 0 1 112 48"
            fill="none"
            stroke="#374151"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d={`M 16 48 A 48 48 0 0 1 ${16 + (96 * Math.min(percentage, 100) / 100)} ${48 - 48 * Math.sin(Math.PI * Math.min(percentage, 100) / 100)}`}
            fill="none"
            stroke={getStatusColor()}
            strokeWidth="8"
            strokeLinecap="round"
          />
          <line
            x1={16 + (96 * targetPercentage / 100)}
            y1={48 - 48 * Math.sin(Math.PI * targetPercentage / 100)}
            x2={16 + (96 * targetPercentage / 100)}
            y2={48 - 48 * Math.sin(Math.PI * targetPercentage / 100) - 8}
            stroke="#9CA3AF"
            strokeWidth="2"
          />
          <text x="64" y="35" textAnchor="middle" className="text-lg font-bold fill-white">
            {typeof value === 'number' ? value.toFixed(1) : value}
          </text>
          <text x="64" y="50" textAnchor="middle" className="text-xs fill-slate-300">
            {unit}
          </text>
        </svg>
      </div>
      
      <div className="text-center space-y-1">
        <div className="text-xs text-slate-400">
          Target: {target} {unit}
        </div>
        <div className="text-xs text-slate-500">
          Range: {min} - {max}
        </div>
      </div>
    </div>
  );
};

const AlertPanel = ({ alerts }) => {
  if (alerts.length === 0) {
    return (
      <div className="bg-green-500/20 border border-green-500 text-green-200 rounded-lg p-4 text-center">
        <p className="font-semibold">System Status: Normal</p>
        <p className="text-sm">All parameters are within normal operating range.</p>
      </div>
    );
  }
  return (
    <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 space-y-2">
      <h3 className="font-bold text-red-300 flex items-center"><AlertTriangle className="mr-2" /> Critical Alerts</h3>
      {alerts.map((alert, i) => (
        <div key={i} className="text-red-200 text-sm p-2 bg-red-900/30 rounded-md">{alert}</div>
      ))}
    </div>
  );
};

const DataSourceIndicator = ({ source, lastUpdated, isOnline }) => (
  <div className="flex items-center gap-2 text-sm">
    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></div>
    <Database className="w-4 h-4 text-slate-400" />
    <span className="text-slate-300">
      {source} {lastUpdated && `• Last updated: ${lastUpdated}`}
    </span>
  </div>
);

// Main dashboard component
function Dashboard() {
  const [data, setData] = useState([]);
  const [timeframe, setTimeframe] = useState('24h');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState('database');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

  // Fetch data from database or fallback to mock data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // IMPORTANT ASSUMPTION FOR SEASONAL PREDICTION:
      // To get enough historical data for seasonal lookup,
      // you might need to adjust this `fetchData` call
      // or implement a separate call to retrieve a larger dataset.
      // For demonstration, `timeframe` is still passed, but real seasonal
      // prediction needs data covering at least the last year.
      const dbData = await DatabaseService.fetchData(timeframe); 
      
      if (dbData && dbData.length > 0) {
        // If your API can return all historical data (e.g., last 2 years)
        // regardless of `timeframe` parameter, then `dbData` would be that.
        // Otherwise, you'd need to modify `fetchData` in DatabaseService
        // to fetch a full historical context for prediction.
        setData(dbData); 
        setDataSource('Database');
        setIsOnline(true);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        throw new Error('No data available from database');
      }
      
    } catch (dbError) {
      console.warn('Database fetch failed, falling back to mock data:', dbError);
      
      // Fallback to mock data
      // Note: generateMockData has been enhanced to produce more historical data
      const mockData = DatabaseService.generateMockData();
      setData(mockData);
      setDataSource('Mock Data (Database Unavailable)');
      setIsOnline(false);
      setError('Using simulated data - database connection failed');
      setLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh data
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, DB_CONFIG.refreshInterval);
    return () => clearInterval(interval);
  }, [timeframe]); // Dependency on timeframe might restrict historical data if fetchData isn't changed

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Process data for charts
  const processedData = useMemo(() => {
    // Ensure we have data to process
    if (data.length === 0) return [];

    // Filter data for the currently selected display timeframe
    const now = new Date(data[data.length - 1].Timestamp);
    let filterDate = new Date(now);
    if (timeframe === '24h') filterDate.setDate(now.getDate() - 1);
    else if (timeframe === '7d') filterDate.setDate(now.getDate() - 7);
    else if (timeframe === '30d') filterDate.setDate(now.getDate() - 30);
    
    const filteredData = data.filter(d => new Date(d.Timestamp) > filterDate);

    // If filtered data is too sparse, return early or handle gracefully
    if (filteredData.length < 2) {
      return filteredData.map(point => ({
          ...point,
          name: new Date(point.Timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          'Actual Rfoul': point.Rfoul,
          'Predicted Rfoul': point.Rfoul, // If not enough data for trend, prediction is current value
          efficiency: calculateThermalEfficiency(point.Ufoul, point.Uclean),
          energyLoss: calculateEnergyLoss(point.Uclean, point.Ufoul, AREA, point.LMTD)
      }));
    }

    // --- Start of Trend Prediction (from existing logic) ---
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    // Use the most recent 24 points from the *filtered data* for short-term slope
    const trendCalculationData = filteredData.slice(-24);
    
    if (trendCalculationData.length > 1) { // Ensure enough points for a meaningful slope
        trendCalculationData.forEach((p, i) => {
            sumX += i;
            sumY += p.Rfoul;
            sumXY += i * p.Rfoul;
            sumX2 += i * i;
        });
    }
    const n = trendCalculationData.length;
    // Calculate the slope for the short-term trend
    const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
    // --- End of Trend Prediction ---

    // --- Start of Seasonal Adjustment Logic (New/Revised) ---
    let seasonalAdjustmentFactor = 1.0; // Default: no adjustment

    // We need at least a recent average and a corresponding last year's average
    // to calculate a meaningful seasonal factor.
    // Let's use the last 24 hours of data from the current period for averaging.
    const lookbackPeriodMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const currentLookbackStart = new Date(now.getTime() - lookbackPeriodMs);
    const lastYearLookbackStart = new Date(currentLookbackStart);
    lastYearLookbackStart.setFullYear(lastYearLookbackStart.getFullYear() - 1);
    const lastYearLookbackEnd = new Date(now.getTime());
    lastYearLookbackEnd.setFullYear(lastYearLookbackEnd.getFullYear() - 1);

    // Filter historical data for the current period (last 24h)
    const currentPeriodRfouls = data
        .filter(d => new Date(d.Timestamp) >= currentLookbackStart && new Date(d.Timestamp) <= now)
        .map(d => d.Rfoul);

    // Filter historical data for the same period last year
    const lastYearPeriodRfouls = data
        .filter(d => new Date(d.Timestamp) >= lastYearLookbackStart && new Date(d.Timestamp) <= lastYearLookbackEnd)
        .map(d => d.Rfoul);

    const avgCurrentRfoulForSeason = currentPeriodRfouls.length > 0
        ? currentPeriodRfouls.reduce((sum, val) => sum + val, 0) / currentPeriodRfouls.length
        : 0;
    
    const avgLastYearRfoulForSeason = lastYearPeriodRfouls.length > 0
        ? lastYearPeriodRfouls.reduce((sum, val) => sum + val, 0) / lastYearPeriodRfouls.length
        : 0;

    // Calculate seasonal adjustment factor if valid data exists
    const MIN_RFOUL_THRESHOLD = 0.0000001; // Avoid division by very small numbers or zero
    if (avgLastYearRfoulForSeason > MIN_RFOUL_THRESHOLD && avgCurrentRfoulForSeason > MIN_RFOUL_THRESHOLD) {
        const rawFactor = avgCurrentRfoulForSeason / avgLastYearRfoulForSeason;
        // Apply bounds (0.8 to 1.2) to prevent extreme adjustments from outliers
        seasonalAdjustmentFactor = Math.max(0.8, Math.min(1.2, rawFactor));
        console.log(`Seasonal Factor for Rfoul: ${seasonalAdjustmentFactor.toFixed(2)} (Avg Current: ${avgCurrentRfoulForSeason.toFixed(6)}, Avg Last Year: ${avgLastYearRfoulForSeason.toFixed(6)})`);
    } else {
        console.log('Not enough historical data or zero Rfoul for seasonal factor calculation.');
    }
    // --- End of Seasonal Adjustment Logic ---

    // Apply both trend and seasonal adjustment to each point in filteredData
    return filteredData.map((point, index) => {
      const prevPoint = filteredData[index - 1] || point; // Use current point if no previous for the very first one

      // Start with the simple linear trend prediction
      let predictedRfoul = prevPoint.Rfoul + slope;

      // Apply the seasonal adjustment factor
      predictedRfoul *= seasonalAdjustmentFactor;
      
      // Ensure Rfoul does not go below zero
      predictedRfoul = Math.max(predictedRfoul, 0);

      return {
        ...point,
        name: new Date(point.Timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        'Actual Rfoul': point.Rfoul,
        'Predicted Rfoul': predictedRfoul,
        efficiency: calculateThermalEfficiency(point.Ufoul, point.Uclean),
        energyLoss: calculateEnergyLoss(point.Uclean, point.Ufoul, AREA, point.LMTD)
      };
    });
  }, [data, timeframe]); // `data` needs to contain full historical context for this to work effectively

  // Calculate current statistics
  const currentStats = useMemo(() => {
    if (processedData.length === 0) return null;
    const lastPoint = processedData[processedData.length - 1];
    
    const efficiency = calculateThermalEfficiency(lastPoint.Ufoul, lastPoint.Uclean);
    const energyLoss = calculateEnergyLoss(lastPoint.Uclean, lastPoint.Ufoul, AREA, lastPoint.LMTD);
    const dailyCost = calculateDailyCost(energyLoss, ENERGY_RATE, OPERATING_HOURS);
    const coalConsumption = calculateCoalConsumption(energyLoss, OPERATING_HOURS);
    const co2Emissions = calculateCO2Emissions(coalConsumption);
    
    const maintenanceCost = dailyCost * MAINTENANCE_COST_FACTOR;
    const efficiencyLossCost = dailyCost * EFFICIENCY_LOSS_FACTOR;
    const environmentalCost = coalConsumption * COAL_PRICE * 0.02;
    const totalDailyCost = dailyCost + maintenanceCost + efficiencyLossCost + environmentalCost;

    // Alert conditions
    const alerts = [];
    if (lastPoint.Rfoul > 0.00076) {
      alerts.push(`CRITICAL: Fouling Resistance (${(lastPoint.Rfoul * 1000000).toFixed(1)}×10⁻⁶) has exceeded the threshold.`);
    }
    if (efficiency < 75) {
      alerts.push(`PERFORMANCE: Efficiency (${efficiency.toFixed(1)}%) is below the 75% target.`);
    }
    if (dailyCost > 5000) {
      alerts.push(`COST: Daily energy cost (₹${dailyCost.toFixed(0)}) exceeds budget threshold.`);
    }
    if (co2Emissions > 50000) {
      alerts.push(`ENVIRONMENTAL: CO₂ emissions (${co2Emissions.toFixed(0)} kg/day) above normal levels.`);
    }

    return {
      ...lastPoint,
      efficiency,
      totalDailyCost,
      co2Emissions,
      alerts,
      dailyCost,
      maintenanceCost,
      efficiencyLossCost,
      environmentalCost,
    };
  }, [processedData]);

  // Cost breakdown
  const costBreakdown = useMemo(() => {
    if (!currentStats) return [];
    return [
      { name: 'Energy Loss', value: currentStats.dailyCost, color: '#ef4444' },
      { name: 'Maintenance', value: currentStats.maintenanceCost, color: '#f59e0b' },
      { name: 'Efficiency Loss', value: currentStats.efficiencyLossCost, color: '#6366f1' },
      { name: 'Environmental', value: currentStats.environmentalCost, color: '#10b981' }
    ];
  }, [currentStats]);

  // Loading states
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
        <p>Loading Dashboard...</p>
        <p className="text-sm text-slate-400 mt-2">Connecting to database...</p>
      </div>
    );
  }

  if (!currentStats) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <Database className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p>No data available to display.</p>
          <button 
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <Factory className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Heat Exchanger Performance Analytics</h1>
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-slate-400">Real-time monitoring & cost optimization</p>
                    <DataSourceIndicator 
                      source={dataSource} 
                      lastUpdated={lastUpdated} 
                      isOnline={isOnline}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <select 
                value={timeframe} 
                onChange={(e) => setTimeframe(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-lg text-white text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Database connection warning */}
        {error && (
          <div className="bg-amber-500/20 border border-amber-500 text-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">Connection Issue</span>
            </div>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Critical alerts */}
        {showAlerts && currentStats.alerts.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
            <AlertPanel alerts={currentStats.alerts} />
          </div>
        )}

        {/* Key metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard 
            title="Fouling Resistance" 
            value={(currentStats.Rfoul * 1000000).toFixed(1)} 
            unit="×10⁻⁶ m²K/W" 
            icon={<TrendingUp className={KPI_ICON_STYLES} />} 
            color="#f97316" 
          />
          <KpiCard 
            title="Thermal Efficiency" 
            value={currentStats.efficiency.toFixed(1)} 
            unit="%" 
            icon={<Zap className={KPI_ICON_STYLES} />} 
            color="#22c55e" 
          />
          <KpiCard 
            title="CO₂ Emissions" 
            value={currentStats.co2Emissions.toFixed(0)} 
            unit="kg/day" 
            icon={<Leaf className={KPI_ICON_STYLES} />} 
            color="#10b981"
          />
        </div>

        {/* Live monitoring */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-cyan-400" />
            Real-time Parameters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <ProfessionalGauge
              value={currentStats['Tcw in']}
              min={20} max={40} target={30}
              title="Inlet Temperature" unit="°C"
              status={currentStats['Tcw in'] > 35 ? 'warning' : 'good'}
            />
            <ProfessionalGauge
              value={currentStats['Tcw out']}
              min={35} max={55} target={45}
              title="Outlet Temperature" unit="°C"
              status={currentStats['Tcw out'] > 50 ? 'warning' : 'good'}
            />
            <ProfessionalGauge
              value={currentStats.LMTD}
              min={10} max={20} target={15}
              title="LMTD" unit="°C"
              status={currentStats.LMTD < 12 ? 'critical' : 'good'}
            />
            <ProfessionalGauge
              value={currentStats.Psat * 1000}
              min={100} max={200} target={150}
              title="Saturation Pressure" unit="mbar"
              status={currentStats.Psat * 1000 > 160 ? 'warning' : 'good'}
            />
          </div>
        </div>

        {/* Charts and analysis */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-cyan-200 mb-4">Fouling Resistance - Actual vs. Predicted</h2>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                <XAxis dataKey="name" stroke="#A0AEC0" />
                <YAxis stroke="#A0AEC0" domain={['auto', 'auto']} tickFormatter={(tick) => (tick * 1000000).toFixed(1)} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568', color: '#E2E8F0' }}
                  formatter={(value) => typeof value === 'number' ? (value * 1000000).toFixed(2) + '×10⁻⁶' : value}
                />
                <Legend />
                <Area type="monotone" dataKey="Actual Rfoul" stroke="#f97316" fillOpacity={0.4} fill="url(#colorActual)" strokeWidth={2} />
                <Line type="monotone" dataKey="Predicted Rfoul" stroke="#8884d8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-cyan-200 mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Daily Cost Analysis
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={costBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {costBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`₹${(value / 1000).toFixed(1)}k`, 'Cost']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {costBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-slate-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-white">₹{(item.value / 1000).toFixed(1)}k</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Historical performance and recommendations */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Monthly Performance Summary */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Monthly Performance Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="py-2 px-2 text-slate-300">Month</th>
                    <th className="py-2 px-2 text-slate-300 text-right">Scaling</th>
                    <th className="py-2 px-2 text-slate-300 text-right">Cost</th>
                    <th className="py-2 px-2 text-slate-300 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((month, index) => (
                    <tr key={month} className="border-b border-slate-700 last:border-b-0 hover:bg-slate-700">
                      <td className="py-2 px-2 font-medium text-white">{month}</td>
                      <td className="py-2 px-2 text-slate-200 text-right">{actualScaling[index].toFixed(4)}</td>
                      <td className="py-2 px-2 text-slate-200 text-right">₹{energyCosts[index]} Cr</td>
                      <td className="py-2 px-2 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          actualScaling[index] > 0.0029 ? 'bg-red-700/30 text-red-300' : 'bg-green-700/30 text-green-300'
                        }`}>
                          {actualScaling[index] > 0.0029 ? 'Critical' : 'Normal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Management action items */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Maintenance Recommendations</h2>
            <div className="space-y-4">
              <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="font-medium text-red-200">Immediate Action Required</span>
                </div>
                <p className="text-sm text-red-300">Schedule condenser cleaning within 48 hours. Fouling resistance exceeded safe limits.</p>
              </div>
              <div className="p-4 bg-amber-900/30 border border-amber-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-amber-400" />
                  <span className="font-medium text-amber-200">Preventive Maintenance</span>
                </div>
                <p className="text-sm text-amber-300">Optimize cooling water flow rate and temperature control system.</p>
              </div>
              <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-blue-200">Performance Optimization</span>
                </div>
                <p className="text-sm text-blue-300">Implement predictive maintenance schedule to maintain efficiency above 92%.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;