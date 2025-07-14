import { useState, useEffect, useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, TrendingUp, DollarSign, Zap, Gauge, Factory, Settings, Leaf, Target } from 'lucide-react';

// Business-critical constants for cost calculations
const U_CLEAN = 2500; // Peak efficiency heat transfer rate (W/m²K)
const AREA = 44370; // Total condenser surface area (m²)
const ENERGY_RATE = 0.12; // Electricity cost ($/kWh)
const OPERATING_HOURS = 24; // Plant runs 24/7
const COAL_PRICE = 5000; // Coal cost (₹/ton)
const CO2_FACTOR = 2.86; // CO2 emissions per kg of coal
const MAINTENANCE_COST_FACTOR = 0.15; // Maintenance is 15% of energy losses
const EFFICIENCY_LOSS_FACTOR = 0.08; // Other operational costs

// Sample yearly performance data
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const actualScaling = [0.0020, 0.0022, 0.0024, 0.0026, 0.0028, 0.0025, 0.0023, 0.0027, 0.0029, 0.0031, 0.0033, 0.0035]; // Monthly fouling levels
const energyCosts = [12.5, 13.2, 14.1, 15.3, 16.8, 15.9, 14.7, 16.2, 17.5, 18.9, 20.1, 21.3]; // Monthly costs (₹ Crores)

// Business calculations - convert technical data to financial impact
const calculateThermalEfficiency = (ufoul, uclean) => (ufoul / uclean) * 100;
const calculateEnergyLoss = (uclean, ufoul, area, lmtd) => (uclean - ufoul) * area * lmtd / 1000; // Lost power (kW)
const calculateDailyCost = (energyLoss, energyRate, hours) => energyLoss * energyRate * hours;
const calculateCoalConsumption = (energyLoss, hours) => (energyLoss * hours * 0.36) / 1000; // Extra coal needed (tons/day)
const calculateCO2Emissions = (coalConsumption) => coalConsumption * CO2_FACTOR; // Environmental impact (kg CO2/day)

// UI styling for dashboard cards
const KPI_CARD_STYLES = "bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 shadow-lg text-white";
const KPI_ICON_STYLES = "h-8 w-8 mb-2 opacity-80";

// Dashboard metric cards showing key performance indicators
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

// Real-time process monitoring gauges
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

// Critical alert system for immediate management attention
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

// Main dashboard component
function Dashboard() {
    const [data, setData] = useState([]);
    const [timeframe, setTimeframe] = useState('24h');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAlerts, setShowAlerts] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Simulates live plant data feed
    const generateMockData = () => {
        const mockData = [];
        const now = new Date();
        for (let i = 0; i < 50; i++) {
            const timestamp = new Date(now.getTime() - i * 30 * 60 * 1000);
            mockData.unshift({
                Timestamp: timestamp.toISOString(),
                Psat: 0.153 + Math.random() * 0.01,
                Tsat: 52 + Math.random() * 2,
                LMTD: 14 + Math.random() * 2,
                'Tcw in': 29 + Math.random() * 2,
                'Tcw out': 45 + Math.random() * 2,
                Mcw: 22000 + Math.random() * 1000,
                Cpw: 4.14,
                Ufoul: 2300 + Math.random() * 100,
                Uclean: U_CLEAN,
                Rfoul: 0.000025 + Math.random() * 0.000005 // Key metric: fouling resistance
            });
        }
        return mockData;
    };

    // Data loading and refresh every minute
    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
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

        fetchData();
        const interval = setInterval(fetchData, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1500);
    };

    // Process raw data for charts and analysis
    const processedData = useMemo(() => {
        if (data.length < 2) return [];

        const now = new Date(data[data.length - 1].Timestamp);
        let filterDate = new Date(now);
        if (timeframe === '24h') filterDate.setDate(now.getDate() - 1);
        else if (timeframe === '7d') filterDate.setDate(now.getDate() - 7);
        else if (timeframe === '30d') filterDate.setDate(now.getDate() - 30);
        const filteredData = data.filter(d => new Date(d.Timestamp) > filterDate);
        if (filteredData.length < 2) return filteredData;

        // Simple trend prediction for maintenance planning
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

        return filteredData.map((point, index) => {
            const prevPoint = filteredData[index - 1] || point;
            const predictedRfoul = prevPoint.Rfoul + slope;
            return {
                ...point,
                name: new Date(point.Timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                'Actual Rfoul': point.Rfoul,
                'Predicted Rfoul': Math.max(predictedRfoul, 0),
                efficiency: calculateThermalEfficiency(point.Ufoul, point.Uclean),
                energyLoss: calculateEnergyLoss(point.Uclean, point.Ufoul, AREA, point.LMTD)
            };
        });
    }, [data, timeframe]);

    // Current performance metrics and cost impact
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

        // Business-critical alert conditions
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
            dailyCost,
            maintenanceCost,
            efficiencyLossCost,
            environmentalCost,
        };
    }, [processedData]);

    // Cost breakdown for management reporting
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
        return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">Loading Dashboard...</div>;
    }
    if (error) {
        return <div className="flex items-center justify-center h-screen bg-slate-900 text-red-400"><AlertTriangle className="mr-4" />{error}</div>;
    }
    if (!currentStats) {
        return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">No data available to display.</div>;
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
                                    <p className="text-sm text-slate-400">Real-time monitoring & cost optimization</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                             
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Critical alerts for immediate action */}
                {showAlerts && currentStats.alerts.length > 0 && (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                        <AlertPanel alerts={currentStats.alerts} />
                    </div>
                )}

                {/* Key business metrics */}
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

                {/* Live process monitoring */}
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

                {/* Performance trends and cost analysis */}
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

                    {/* Daily cost breakdown */}
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

        {/* Historical performance and actionable recommendations */}
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

          {/* Management action items */}
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