import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { SavedScenario } from '../types/Scenario';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ScenariosPdfExport from '../components/ScenariosPdfExport';

// Add this interface for yearly results
interface YearlyResult {
  hedgedCost: number;
  unhedgedCost: number;
  deltaPnL: number;
}

const SavedScenarios = () => {
  const [scenarios, setScenarios] = React.useState<SavedScenario[]>([]);
  const [selectedScenarios, setSelectedScenarios] = React.useState<string[]>([]);
  const [expandedSections, setExpandedSections] = React.useState<Record<string, Record<string, boolean>>>({});
  const navigate = useNavigate();

  // Initialize expanded state for each scenario
  const initializeExpandedState = (scenarioId: string) => ({
    strategy: false,
    detailedResults: false,
    yearlyStats: false,
    totalStats: false
  });

  // Toggle section visibility
  const toggleSection = (scenarioId: string, section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [scenarioId]: {
        ...(prev[scenarioId] || initializeExpandedState(scenarioId)),
        [section]: !(prev[scenarioId]?.[section] ?? false)
      }
    }));
  };

  React.useEffect(() => {
    const savedScenarios = localStorage.getItem('optionScenarios');
    if (savedScenarios) {
      setScenarios(JSON.parse(savedScenarios));
    }
  }, []);

  const deleteScenario = (id: string) => {
    const updatedScenarios = scenarios.filter(scenario => scenario.id !== id);
    setScenarios(updatedScenarios);
    localStorage.setItem('optionScenarios', JSON.stringify(updatedScenarios));
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getScenarioTypeName = (scenario: SavedScenario) => {
    if (!scenario.stressTest) return 'Base Calculation';
    return scenario.stressTest.name;
  };

  // Add the calculateYearlyResults function
  const calculateYearlyResults = (results: SavedScenario['results']): Record<string, YearlyResult> => {
    return results.reduce((acc: Record<string, YearlyResult>, row) => {
      const year = row.date.split(' ')[1];
      if (!acc[year]) {
        acc[year] = {
          hedgedCost: 0,
          unhedgedCost: 0,
          deltaPnL: 0
        };
      }
      
      acc[year].hedgedCost += row.hedgedCost;
      acc[year].unhedgedCost += row.unhedgedCost;
      acc[year].deltaPnL += row.deltaPnL;
      
      return acc;
    }, {});
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Saved Scenarios</h1>
        <Link to="/">
          <Button>Back to Calculator</Button>
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p>No saved scenarios yet. Run a simulation to save your first scenario.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ScenariosPdfExport
            scenarios={scenarios}
            selectedScenarios={selectedScenarios}
            setSelectedScenarios={setSelectedScenarios}
          />
          {scenarios.map(scenario => (
            <Card key={scenario.id} className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{scenario.name}</CardTitle>
                  <p className="text-sm text-gray-500">{formatDate(scenario.timestamp)}</p>
                  <p className="text-sm font-medium mt-1">Type: {getScenarioTypeName(scenario)}</p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => deleteScenario(scenario.id)}
                  className="flex items-center gap-2"
                >
                  <Trash2 size={16} /> Delete
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <h3 className="font-semibold mb-2">Basic Parameters</h3>
                    <ul className="space-y-1">
                      <li>Start Date: {scenario.params.startDate}</li>
                      <li>Months to Hedge: {scenario.params.monthsToHedge}</li>
                      <li>Interest Rate: {scenario.params.interestRate}%</li>
                      <li>Total Volume: {scenario.params.totalVolume}</li>
                      <li>Spot Price: {scenario.params.spotPrice}</li>
                    </ul>
                  </div>
                  {scenario.stressTest && (
                    <div>
                      <h3 className="font-semibold mb-2">Stress Test Parameters</h3>
                      <ul className="space-y-1">
                        <li>Volatility: {(scenario.stressTest.volatility * 100).toFixed(1)}%</li>
                        <li>Drift: {(scenario.stressTest.drift * 100).toFixed(1)}%</li>
                        <li>Price Shock: {(scenario.stressTest.priceShock * 100).toFixed(1)}%</li>
                        {scenario.stressTest.forwardBasis && (
                          <li>Forward Basis: {(scenario.stressTest.forwardBasis * 100).toFixed(1)}%</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <Button
                    variant="outline"
                    onClick={() => toggleSection(scenario.id, 'strategy')}
                    className="flex items-center gap-2 mb-2"
                  >
                    {expandedSections[scenario.id]?.strategy ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Strategy Components
                  </Button>
                  
                  {expandedSections[scenario.id]?.strategy && (
                    <div className="mt-2">
                      {scenario.strategy.map((option, index) => (
                        <div key={index} className="grid grid-cols-5 gap-4 p-2 border-b">
                          <div>Type: {option.type}</div>
                          <div>Strike: {option.strike} ({option.strikeType})</div>
                          <div>Volatility: {option.volatility}%</div>
                          <div>Quantity: {option.quantity}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="h-64" id={`pnl-chart-${scenario.id}`}>
                    <h3 className="font-semibold mb-2">P&L Evolution</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={scenario.results}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="deltaPnL" name="Delta P&L" stroke="#8884d8" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-64" id={`payoff-chart-${scenario.id}`}>
                    <h3 className="font-semibold mb-2">Payoff Diagram</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={scenario.payoffData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="price" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="payoff" name="Strategy Payoff" stroke="#82ca9d" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => toggleSection(scenario.id, 'detailedResults')}
                    className="flex items-center gap-2 mb-2"
                  >
                    {expandedSections[scenario.id]?.detailedResults ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Detailed Results
                  </Button>
                  
                  {expandedSections[scenario.id]?.detailedResults && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="border p-2">Maturity</th>
                            <th className="border p-2">Forward Price</th>
                            <th className="border p-2">Real Price</th>
                            <th className="border p-2">Strategy Price</th>
                            <th className="border p-2">Payoff</th>
                            <th className="border p-2">Hedged Cost</th>
                            <th className="border p-2">Unhedged Cost</th>
                            <th className="border p-2">Delta P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scenario.results.map((row, i) => (
                            <tr key={i}>
                              <td className="border p-2">{row.date}</td>
                              <td className="border p-2">{row.forward.toFixed(2)}</td>
                              <td className="border p-2">{row.realPrice.toFixed(2)}</td>
                              <td className="border p-2">{row.strategyPrice.toFixed(2)}</td>
                              <td className="border p-2">{row.totalPayoff.toFixed(2)}</td>
                              <td className="border p-2">{row.hedgedCost.toFixed(2)}</td>
                              <td className="border p-2">{row.unhedgedCost.toFixed(2)}</td>
                              <td className="border p-2">{row.deltaPnL.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => toggleSection(scenario.id, 'yearlyStats')}
                    className="flex items-center gap-2 mb-2"
                  >
                    {expandedSections[scenario.id]?.yearlyStats ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Summary Statistics by Year
                  </Button>
                  
                  {expandedSections[scenario.id]?.yearlyStats && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="border p-2">Year</th>
                            <th className="border p-2">Hedged Cost</th>
                            <th className="border p-2">Unhedged Cost</th>
                            <th className="border p-2">Delta P&L</th>
                            <th className="border p-2">Cost Reduction (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(calculateYearlyResults(scenario.results)).map(([year, data]) => (
                            <tr key={year}>
                              <td className="border p-2">{year}</td>
                              <td className="border p-2">{data.hedgedCost.toFixed(2)}</td>
                              <td className="border p-2">{data.unhedgedCost.toFixed(2)}</td>
                              <td className="border p-2">{data.deltaPnL.toFixed(2)}</td>
                              <td className="border p-2">
                                {((data.deltaPnL / Math.abs(data.unhedgedCost)) * 100).toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => toggleSection(scenario.id, 'totalStats')}
                    className="flex items-center gap-2 mb-2"
                  >
                    {expandedSections[scenario.id]?.totalStats ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Total Summary Statistics
                  </Button>
                  
                  {expandedSections[scenario.id]?.totalStats && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr>
                            <td className="border p-2 font-medium">Total Cost with Hedging</td>
                            <td className="border p-2 text-right">
                              {scenario.results.reduce((sum, row) => sum + row.hedgedCost, 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-2 font-medium">Total Cost without Hedging</td>
                            <td className="border p-2 text-right">
                              {scenario.results.reduce((sum, row) => sum + row.unhedgedCost, 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-2 font-medium">Total P&L</td>
                            <td className="border p-2 text-right">
                              {scenario.results.reduce((sum, row) => sum + row.deltaPnL, 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-2 font-medium">Cost Reduction (%)</td>
                            <td className="border p-2 text-right">
                              {(() => {
                                const totalPnL = scenario.results.reduce((sum, row) => sum + row.deltaPnL, 0);
                                const totalUnhedgedCost = scenario.results.reduce((sum, row) => sum + row.unhedgedCost, 0);
                                return ((totalPnL / Math.abs(totalUnhedgedCost)) * 100).toFixed(2);
                              })()}%
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => {
                    localStorage.setItem('calculatorState', JSON.stringify({
                      params: scenario.params,
                      strategy: scenario.strategy,
                      results: scenario.results,
                      payoffData: scenario.payoffData,
                      manualForwards: {},
                      realPrices: {},
                      realPriceParams: {
                        useSimulation: false,
                        volatility: 0.3,
                        drift: 0.01,
                        numSimulations: 1000
                      },
                      activeTab: 'stress',
                      customScenario: scenario.stressTest,
                      stressTestScenarios: {} // You might want to save this too
                    }));
                    navigate('/');
                  }}
                  className="mt-4"
                >
                  Load This Scenario
                </Button>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

export default SavedScenarios; 