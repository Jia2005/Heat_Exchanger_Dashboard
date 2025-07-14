import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, TrendingUp, DollarSign, Zap, Thermometer, Gauge, Factory, Bell, RefreshCw, Download, Settings, Leaf, ArrowUp, ArrowDown, Target } from 'lucide-react';

// These are the fundamental parameters for our heat exchanger calculations.
const U_CLEAN = 2500; // Represents the Overall Heat Transfer Coefficient (U) of the exchanger when it's perfectly clean (W/m²K). This is our ideal performance baseline.
const AREA = 44370; // The total heat transfer surface area of the condenser in square meters (m²).
const ENERGY_RATE = 0.12; // The cost of electricity, in $/kWh. Used to quantify financial impact.
const OPERATING_HOURS = 24; // Assumes the plant runs 24/7 for daily cost calculations.
const COAL_PRICE = 5000; // Price of coal in Indian Rupees (₹) per ton.
const CO2_FACTOR = 2.86; // A stoichiometric factor: kg of CO2 produced per kg of coal burned.
const MAINTENANCE_COST_FACTOR = 0.15; // An assumption: maintenance costs are 15% of the energy loss cost.
const EFFICIENCY_LOSS_FACTOR = 0.08; // An assumption: other operational inefficiency costs are 8% of the energy loss cost.

// This is sample data to show performance trends over a year.
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const actualScaling = [0.0020, 0.0022, 0.0024, 0.0026, 0.0028, 0.0025, 0.0023, 0.0027, 0.0029, 0.0031, 0.0033, 0.0035]; // Represents fouling factor over months.
const energyCosts = [12.5, 13.2, 14.1, 15.3, 16.8, 15.9, 14.7, 16.2, 17.5, 18.9, 20.1, 21.3]; // Energy costs in Crores (₹).

// These functions translate raw data into meaningful performance metrics.
// Calculates how close the current performance is to the ideal 'clean' state. A key measure of fouling impact.
const calculateThermalEfficiency = (ufoul, uclean) => (ufoul / uclean) * 100;

// Uses the fundamental heat transfer equation (Q = U * A * LMTD) to find the energy 'lost' due to fouling (Uclean - Ufoul).
const calculateEnergyLoss = (uclean, ufoul, area, lmtd) => (uclean - ufoul) * area * lmtd / 1000; // Result in kW

// Converts lost energy (kW) into a daily financial cost.
const calculateDailyCost = (energyLoss, energyRate, hours) => energyLoss * energyRate * hours;

// Estimates the extra coal needed to compensate for the energy loss, assuming a thermal efficiency for power generation.
const calculateCoalConsumption = (energyLoss, hours) => (energyLoss * hours * 0.36) / 1000; // tons/day

// Calculates the resulting carbon dioxide emissions from the extra coal burned.
const calculateCO2Emissions = (coalConsumption) => coalConsumption * CO2_FACTOR; // kg CO2/day

// These are reusable UI components for displaying information.
const KPI_CARD_STYLES = "bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 shadow-lg text-white";
const KPI_ICON_STYLES = "h-8 w-8 mb-2 opacity-80";

// A 'KpiCard' is one of the main dashboard widgets showing a single, important number.
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

// A 'ProfessionalGauge' is the half-circle meter used for showing live process parameters like temperature and pressure.
const ProfessionalGauge = ({ value, max, min = 0, title, unit, target, status }) => {
    // ... (This is UI code for drawing the gauge; the logic is mainly for presentation)
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

// The 'AlertPanel' shows critical warnings when process parameters go outside of safe limits.
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

// This is the main component that brings everything together.
function Dashboard() {
    // 'useState' is how React holds and manages data. 'data' holds all our raw process values.
    const [data, setData] = useState([]);
    const [timeframe, setTimeframe] = useState('24h');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAlerts, setShowAlerts] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // This function simulates fetching live data from a plant's data historian or SCADA system.
    const generateMockData = () => {
        const mockData = [];
        const now = new Date();
        for (let i = 0; i < 50; i++) {
            const timestamp = new Date(now.getTime() - i * 30 * 60 * 1000);
            mockData.unshift({
                Timestamp: timestamp.toISOString(),
                Psat: 0.153 + Math.random() * 0.01, // Saturation Pressure (bar)
                Tsat: 52 + Math.random() * 2,      // Saturation Temperature (°C)
                LMTD: 14 + Math.random() * 2,      // Log Mean Temperature Difference (°C)
                'Tcw in': 29 + Math.random() * 2,  // Cooling water inlet temp (°C)
                'Tcw out': 45 + Math.random() * 2, // Cooling water outlet temp (°C)
                Mcw: 22000 + Math.random() * 1000, // Cooling water mass flow rate (kg/h)
                Cpw: 4.14,                         // Specific heat of water (kJ/kg·K)
                Ufoul: 2300 + Math.random() * 100, // The actual (fouled) heat transfer coefficient (W/m²K)
                Uclean: U_CLEAN,                   // The ideal (clean) heat transfer coefficient (W/m²K)
                Rfoul: 0.000025 + Math.random() * 0.000005 // The fouling resistance (m²K/W)
            });
        }
        return mockData;
    };

    // 'useEffect' is a React hook that runs code after the component renders.
    // We use it here to fetch the initial data for the dashboard.
    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                // In a real application, this would be an API call to a server.
                // We simulate a 1-second network delay.
                await new Promise(resolve => setTimeout(resolve, 1000));
                const mockData = generateMockData();
                setData(mockData);
                setError(null);
            } catch (e) {
                console.error("Failed to fetch data:", e);
                setError("Failed to load data from the server.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData(); // Fetch data when the page loads.

        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []); // The empty array [] means this effect runs only once on component mount.

    const handleRefresh = () => {
        // This function will be called when the manual refresh button is clicked.
        // It's not fully implemented here but shows where the logic would go.
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1500);
    };

    // 'useMemo' is for performance. It ensures these complex calculations only re-run when the input 'data' changes.
    // It processes the raw data to be used in charts.
    const processedData = useMemo(() => {
        if (data.length < 2) return [];

        // ... (Filtering logic based on timeframe '24h', '7d', '30d')
        const now = new Date(data[data.length - 1].Timestamp);
        let filterDate = new Date(now);
        if (timeframe === '24h') filterDate.setDate(now.getDate() - 1);
        else if (timeframe === '7d') filterDate.setDate(now.getDate() - 7);
        else if (timeframe === '30d') filterDate.setDate(now.getDate() - 30);
        const filteredData = data.filter(d => new Date(d.Timestamp) > filterDate);
        if (filteredData.length < 2) return filteredData;

        // This section uses a simple linear regression to predict the future fouling trend.
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        const trendData = filteredData.slice(-24);
        trendData.forEach((p, i) => {
            sumX += i;
            sumY += p.Rfoul;
            sumXY += i * p.Rfoul;
            sumX2 += i * i;
        });
        const n = trendData.length;
        const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;

        // Adds calculated values (like efficiency) to each data point for charting.
        return filteredData.map((point, index) => {
            const prevPoint = filteredData[index - 1] || point;
            const predictedRfoul = prevPoint.Rfoul + slope;
            return {
                ...point,
                name: new Date(point.Timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                'Actual Rfoul': point.Rfoul,
                'Predicted Rfoul': Math.max(predictedRfoul, 0), // Fouling can't be negative
                efficiency: calculateThermalEfficiency(point.Ufoul, point.Uclean),
                energyLoss: calculateEnergyLoss(point.Uclean, point.Ufoul, AREA, point.LMTD)
            };
        });
    }, [data, timeframe]);

    // This 'useMemo' calculates the most current statistics for the KPI cards and gauges.
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
        const environmentalCost = coalConsumption * COAL_PRICE * 0.02; // Assumes a 2% environmental tax/cost.
        const totalDailyCost = dailyCost + maintenanceCost + efficiencyLossCost + environmentalCost;

        // This section defines the conditions for triggering alerts.
        const alerts = [];
        if (lastPoint.Rfoul > 0.00026) {
            alerts.push(`CRITICAL: Fouling Resistance (${(lastPoint.Rfoul * 1000000).toFixed(1)}×10⁻⁶) has exceeded the threshold.`);
        }
        if (efficiency < 85) {
            alerts.push(`PERFORMANCE: Efficiency (${efficiency.toFixed(1)}%) is below the 85% target.`);
        }
        if (dailyCost > 5000) {
            alerts.push(`COST: Daily energy cost (₹${dailyCost.toFixed(0)}) exceeds budget threshold.`);
        }
        if (co2Emissions > 50) {
            alerts.push(`ENVIRONMENTAL: CO₂ emissions (${co2Emissions.toFixed(0)} kg/day) above normal levels.`);
        }

        return {
            ...lastPoint,
            efficiency,
            totalDailyCost,
            co2Emissions,
            alerts,
            // ... other calculated values for display
            dailyCost,
            maintenanceCost,
            efficiencyLossCost,
            environmentalCost,
        };
    }, [processedData]);

    // This 'useMemo' prepares the data for the 'Daily Cost Analysis' pie chart.
    const costBreakdown = useMemo(() => {
        if (!currentStats) return [];
        return [
            { name: 'Energy Loss', value: currentStats.dailyCost, color: '#ef4444' },
            { name: 'Maintenance', value: currentStats.maintenanceCost, color: '#f59e0b' },
            { name: 'Efficiency Loss', value: currentStats.efficiencyLossCost, color: '#6366f1' },
            { name: 'Environmental', value: currentStats.environmentalCost, color: '#10b981' }
        ];
    }, [currentStats]);

    // These are checks for loading/error states.
    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">Loading Dashboard...</div>;
    }
    if (error) {
        return <div className="flex items-center justify-center h-screen bg-slate-900 text-red-400"><AlertTriangle className="mr-4" />{error}</div>;
    }
    if (!currentStats) {
        return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">No data available to display.</div>;
    }

    // The following JSX code structures the visual layout of the dashboard.
    return (
        <div className="bg-slate-900 min-h-screen text-white font-sans">
            {/* Header section with title and time-frame buttons */}
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
                                    <p className="text-sm text-slate-400">Real-time monitoring & cost optimization</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                             {/* ... (Buttons for timeframe, refresh, etc.) */}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Alert panel, which only shows if there are active alerts */}
                {showAlerts && currentStats.alerts.length > 0 && (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                        <AlertPanel alerts={currentStats.alerts} />
                    </div>
                )}

                {/* KPI Cards Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Changed to 3 columns */}
                    <KpiCard 
                        title="Fouling Resistance" 
                        value={(currentStats.Rfoul * 1000000).toFixed(1)} 
                        unit="×10⁻⁶ m²K/W" 
                        icon={<TrendingUp className={KPI_ICON_STYLES} />} 
                        color="#f97316" 
                        // --- CHANGE --- 'trend' prop removed
                    />
                    <KpiCard 
                        title="Thermal Efficiency" 
                        value={currentStats.efficiency.toFixed(1)} 
                        unit="%" 
                        icon={<Zap className={KPI_ICON_STYLES} />} 
                        color="#22c55e" 
                        // --- CHANGE --- 'trend' prop removed
                    />
                    {/* --- CHANGE --- The 'Daily Cost Impact' KpiCard has been removed. */}
                    <KpiCard 
                        title="CO₂ Emissions" 
                        value={currentStats.co2Emissions.toFixed(0)} 
                        unit="kg/day" 
                        icon={<Leaf className={KPI_ICON_STYLES} />} 
                        color="#10b981"
                        // This card did not have a trend prop to begin with
                    />
                </div>

                {/* Real-time Gauges for process parameters */}
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

                {/* Main chart showing fouling resistance over time */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                        <h2 className="text-xl font-semibold text-cyan-200 mb-4">Fouling Resistance - Actual vs. Predicted</h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={processedData}>
                                {/* ... (Chart components) */}
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

                    {/* Cost breakdown pie chart */}
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

        {/* --- CHANGE --- This section has been updated to ensure text is visible. */}
        {/* It shows a summary table of historical monthly data. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Monthly Performance Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-2 text-slate-600">Month</th>
                    <th className="py-2 px-2 text-slate-600 text-right">Scaling</th>
                    <th className="py-2 px-2 text-slate-600 text-right">Cost</th>
                    <th className="py-2 px-2 text-slate-600 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((month, index) => (
                    <tr key={month} className="border-b border-slate-100 hover:bg-slate-50">
                      {/* Added text color class 'text-slate-900' to ensure visibility */}
                      <td className="py-2 px-2 font-medium text-slate-900">{month}</td>
                      <td className="py-2 px-2 text-slate-900 text-right">{actualScaling[index].toFixed(4)}</td>
                      <td className="py-2 px-2 text-slate-900 text-right">₹{energyCosts[index]} Cr</td>
                      <td className="py-2 px-2 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          actualScaling[index] > 0.0025 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {actualScaling[index] > 0.0025 ? 'Critical' : 'Normal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* This section gives actionable recommendations based on the current data. */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Maintenance Recommendations</h2>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-red-800">Immediate Action Required</span>
                </div>
                <p className="text-sm text-red-700">Schedule condenser cleaning within 48 hours. Fouling resistance exceeded safe limits.</p>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-800">Preventive Maintenance</span>
                </div>
                <p className="text-sm text-amber-700">Optimize cooling water flow rate and temperature control system.</p>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Performance Optimization</span>
                </div>
                <p className="text-sm text-blue-700">Implement predictive maintenance schedule to maintain efficiency above 92%.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;