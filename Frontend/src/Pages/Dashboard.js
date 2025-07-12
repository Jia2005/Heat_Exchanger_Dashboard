import { useState, useEffect, useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { AlertTriangle, TrendingUp, DollarSign, Zap, Thermometer } from 'lucide-react';

// --- Constants ---
const U_CLEAN = 2500;
const AREA = 44370; // m²
const ENERGY_RATE = 0.12; // Example: ₹ currency symbol would be better, but for simplicity using $
const OPERATING_HOURS = 24;


// --- Core Calculation Components ---

const KPI_CARD_STYLES = "bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-lg text-white";
const KPI_ICON_STYLES = "h-8 w-8 mb-2 opacity-80";

const KpiCard = ({ title, value, unit, icon, color }) => (
    <div className={KPI_CARD_STYLES}>
        <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-300">{title}</p>
            <div style={{ color }}>{icon}</div>
        </div>
        <p className="text-3xl font-bold mt-1">{value}<span className="text-lg ml-1 font-normal">{unit}</span></p>
    </div>
);

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

function Dashboard() {
    const [data, setData] = useState([]);
    const [timeframe, setTimeframe] = useState('24h');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // This useEffect hook now fetches data from your backend API
    // instead of generating mock data.
    useEffect(() => {
        const fetchData = async () => {
            try {
                // The React development server will proxy this request to your backend
                // to avoid CORS issues. See package.json for proxy setup.
                const response = await fetch('/api/heat-exchanger-data');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const fetchedData = await response.json();
                
                // Sort data just in case it's not ordered
                fetchedData.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));

                setData(fetchedData);
                setError(null);
            } catch (e) {
                console.error("Failed to fetch data:", e);
                setError("Failed to load data from the server. Please ensure the backend is running and connected to InfluxDB.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        
        // Optional: Set up polling to get real-time updates every few seconds
        const interval = setInterval(fetchData, 15000); // Fetch new data every 15 seconds

        return () => clearInterval(interval); // Cleanup on component unmount
    }, []);


    // --- Prediction Logic ---
    const processedData = useMemo(() => {
        if (data.length < 2) return [];

        // Filter data based on selected timeframe
        const now = new Date(data[data.length - 1].Timestamp);
        let filterDate = new Date(now);
        if (timeframe === '24h') filterDate.setDate(now.getDate() - 1);
        else if (timeframe === '7d') filterDate.setDate(now.getDate() - 7);
        else if (timeframe === '30d') filterDate.setDate(now.getDate() - 30);
        
        const filteredData = data.filter(d => new Date(d.Timestamp) > filterDate);

        // --- Statistical Prediction Model ---
        const trendCalculationData = data.slice(-24 * 7); // Use last 7 days for trend
        if (trendCalculationData.length < 2) return filteredData; // Not enough data for trend

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        trendCalculationData.forEach((p, i) => {
            sumX += i;
            sumY += p.Rfoul;
            sumXY += i * p.Rfoul;
            sumX2 += i * i;
        });
        const n = trendCalculationData.length;
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        const lastActualPoint = filteredData[filteredData.length - 1];

        return filteredData.map((point, index) => {
            const pointDate = new Date(point.Timestamp);
            const lastYearDate = new Date(pointDate);
            lastYearDate.setFullYear(pointDate.getFullYear() - 1);
            const historicalPoint = data.find(p => Math.abs(new Date(p.Timestamp) - lastYearDate) < 1000 * 60 * 60);
            
            let predictedRfoul;
            const prevPoint = filteredData[index-1] || lastActualPoint;
            predictedRfoul = prevPoint.Rfoul + slope;
            
            if (historicalPoint) {
                const historicalTrendFactor = point.Rfoul / historicalPoint.Rfoul;
                predictedRfoul *= (historicalTrendFactor > 0.8 && historicalTrendFactor < 1.2) ? historicalTrendFactor : 1;
            }

            return {
                ...point,
                name: new Date(point.Timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                date: new Date(point.Timestamp).toLocaleDateString(),
                'Actual Rfoul': point.Rfoul,
                'Predicted Rfoul': predictedRfoul,
            };
        });
    }, [data, timeframe]);
    
    // --- KPIs and Alerts Calculation ---
    const currentStats = useMemo(() => {
        if (processedData.length === 0) return null;
        const lastPoint = processedData[processedData.length - 1];
        
        const efficiency = (lastPoint.Ufoul / lastPoint.Uclean) * 100;
        const energyLoss = (lastPoint.Uclean - lastPoint.Ufoul) * AREA * lastPoint.LMTD / 1000; // in kW
        const costImpact = energyLoss * ENERGY_RATE * OPERATING_HOURS;

        const alerts = [];
        if (lastPoint.Rfoul > 0.00026) {
            alerts.push(`CRITICAL: Fouling Resistance (${lastPoint.Rfoul.toFixed(6)}) has exceeded the threshold of 0.00026.`);
        }
        if (efficiency < 85) {
            alerts.push(`PERFORMANCE: Efficiency (${efficiency.toFixed(1)}%) is below the 85% target.`);
        }

        return { ...lastPoint, efficiency, costImpact, alerts };
    }, [processedData]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading Dashboard...</div>;
    }
    
    if (error) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400"><AlertTriangle className="mr-4" />{error}</div>;
    }

    if (!currentStats) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">No data available to display.</div>;
    }

    return (
        <div className="bg-gray-900 min-h-screen text-white font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-6">
                    <h1 className="text-3xl font-bold text-cyan-300">Heat Exchanger Monitoring System</h1>
                    <p className="text-gray-400">Real-time performance analysis and predictive maintenance dashboard.</p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KpiCard title="Fouling Resistance (Rfoul)" value={currentStats.Rfoul.toFixed(6)} unit="m²K/W" icon={<TrendingUp />} color="#f97316" />
                    <KpiCard title="Efficiency" value={currentStats.efficiency.toFixed(1)} unit="%" icon={<Zap />} color="#22c55e" />
                    <KpiCard title="Daily Cost Impact" value={currentStats.costImpact.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} unit="/ day" icon={<DollarSign />} color="#ef4444" />
                    <KpiCard title="LMTD" value={currentStats.LMTD.toFixed(2)} unit="°C" icon={<Thermometer />} color="#3b82f6" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                           <h2 className="text-xl font-semibold text-cyan-200">Fouling Resistance (Rfoul) - Actual vs. Predicted</h2>
                           <div className="flex items-center space-x-1 bg-gray-700 rounded-lg p-1">
                               {['24h', '7d', '30d'].map(t => (
                                   <button key={t} onClick={() => setTimeframe(t)} className={`px-3 py-1 text-sm rounded-md transition-colors ${timeframe === t ? 'bg-cyan-500 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>
                                       {t}
                                   </button>
                               ))}
                           </div>
                        </div>
                        <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={processedData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                                <XAxis dataKey="name" stroke="#A0AEC0" />
                                <YAxis stroke="#A0AEC0" domain={['auto', 'auto']} tickFormatter={(tick) => tick.toExponential(2)} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568', color: '#E2E8F0' }}
                                    formatter={(value) => typeof value === 'number' ? value.toFixed(8) : value}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="Actual Rfoul" stroke="#f97316" fillOpacity={1} fill="url(#colorActual)" strokeWidth={2} />
                                <Line type="monotone" dataKey="Predicted Rfoul" stroke="#8884d8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700">
                           <h2 className="text-xl font-semibold text-cyan-200 mb-4">System Status</h2>
                           <AlertPanel alerts={currentStats.alerts} />
                        </div>
                         <div className="bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700">
                           <h2 className="text-xl font-semibold text-cyan-200 mb-4">Current Parameters</h2>
                           <ul className="space-y-2 text-sm text-gray-300">
                                <li className="flex justify-between"><span>Saturation Temp (Tsat):</span> <span className="font-mono">{currentStats.Tsat.toFixed(2)} °C</span></li>
                                <li className="flex justify-between"><span>Cooling Water In (Tcw in):</span> <span className="font-mono">{currentStats['Tcw in'].toFixed(2)} °C</span></li>
                                <li className="flex justify-between"><span>Cooling Water Out (Tcw out):</span> <span className="font-mono">{currentStats['Tcw out'].toFixed(2)} °C</span></li>
                                <li className="flex justify-between"><span>Fouled Coeff. (Ufoul):</span> <span className="font-mono">{currentStats.Ufoul.toFixed(2)} W/m²K</span></li>
                                <li className="flex justify-between"><span>Clean Coeff. (Uclean):</span> <span className="font-mono">{currentStats.Uclean.toFixed(2)} W/m²K</span></li>
                           </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;