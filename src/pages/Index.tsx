import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  // Basic parameters state
  const [params, setParams] = useState({
    startDate: new Date().toISOString().split('T')[0],
    monthsToHedge: 12,
    interestRate: 2.0,
    totalVolume: 1000000,
    spotPrice: 100
  });

  // Strategy components state
  const [strategy, setStrategy] = useState([]);

  // Results state
  const [results, setResults] = useState(null);

  // Manual forward prices state
  const [manualForwards, setManualForwards] = useState({});

  // Real prices state
  const [realPrices, setRealPrices] = useState({});

  // Payoff data state
  const [payoffData, setPayoffData] = useState([]);

  // Real prices simulation parameters
  const [realPriceParams, setRealPriceParams] = useState({
    useSimulation: false,
    volatility: 0.3,
    drift: 0.01,
    numSimulations: 1000
  });

  // Month names in English
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calculate Black-Scholes Option Price
  const calculateOptionPrice = (type, S, K, r, t, sigma) => {
    const d1 = (Math.log(S/K) + (r + sigma**2/2)*t) / (sigma*Math.sqrt(t));
    const d2 = d1 - sigma*Math.sqrt(t);
    
    const Nd1 = (1 + erf(d1/Math.sqrt(2)))/2;
    const Nd2 = (1 + erf(d2/Math.sqrt(2)))/2;
    
    if (type === 'call') {
      return S*Nd1 - K*Math.exp(-r*t)*Nd2;
    } else {
      return K*Math.exp(-r*t)*(1-Nd2) - S*(1-Nd1);
    }
  };

  // Error function (erf) implementation
  const erf = (x) => {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = (x < 0) ? -1 : 1;
    x = Math.abs(x);
    
    const t = 1.0/(1.0 + p*x);
    const y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
    
    return sign*y;
  };

  // Calculate real prices using Monte Carlo simulation
  const simulateRealPrices = (months, startDate) => {
    const dt = 1/12; // Monthly time step
    let currentPrice = params.spotPrice;
    const prices = {};
    
    months.forEach((date) => {
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      // Generate random walk
      const randomWalk = Math.random() * 2 - 1; // Simple normal approximation
      currentPrice = currentPrice * Math.exp(
        (realPriceParams.drift - Math.pow(realPriceParams.volatility, 2) / 2) * dt + 
        realPriceParams.volatility * Math.sqrt(dt) * randomWalk
      );
      
      prices[monthKey] = currentPrice;
    });
    
    return prices;
  };

  // Calculate Payoff at Maturity
  const calculatePayoff = () => {
    if (strategy.length === 0) return;

    const spotPrice = params.spotPrice;
    const priceRange = Array.from({length: 101}, (_, i) => spotPrice * (0.5 + i * 0.01));

    const payoffCalculation = priceRange.map(price => {
      let totalPayoff = 0;

      strategy.forEach(option => {
        const strike = option.strikeType === 'percent' 
          ? params.spotPrice * (option.strike / 100) 
          : option.strike;

        const quantity = option.quantity / 100;

        // Calculate option premium using Black-Scholes
        const optionPremium = calculateOptionPrice(
          option.type,
          spotPrice,
          strike,
          params.interestRate/100,
          1, // 1 year to maturity for payoff diagram
          option.volatility/100
        );

        if (option.type === 'call') {
          totalPayoff += (Math.max(price - strike, 0) - optionPremium) * quantity;
        } else {
          totalPayoff += (Math.max(strike - price, 0) - optionPremium) * quantity;
        }
      });

      return {
        price,
        payoff: totalPayoff
      };
    });

    setPayoffData(payoffCalculation);
  };

  // Add new option to strategy
  const addOption = () => {
    setStrategy([...strategy, {
      type: 'call',
      strike: 100,
      strikeType: 'percent',
      volatility: 20,
      quantity: 100
    }]);
  };

  // Remove option from strategy
  const removeOption = (index) => {
    const newStrategy = strategy.filter((_, i) => i !== index);
    setStrategy(newStrategy);
    
    if (newStrategy.length > 0) {
      calculatePayoff();
    } else {
      setPayoffData([]);
    }
  };

  // Update option parameters
  const updateOption = (index, field, value) => {
    const newStrategy = [...strategy];
    newStrategy[index][field] = value;
    setStrategy(newStrategy);
    calculatePayoff();
  };

  // Calculate detailed results
  const calculateResults = () => {
    const startDate = new Date(params.startDate);
    const months = [];
    let currentDate = new Date(startDate);

    const lastDayOfStartMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const remainingDaysInMonth = lastDayOfStartMonth.getDate() - currentDate.getDate() + 1;

    if (remainingDaysInMonth > 0) {
      months.push(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
    }

    for (let i = 0; i < params.monthsToHedge - (remainingDaysInMonth > 0 ? 1 : 0); i++) {
      currentDate.setMonth(currentDate.getMonth() + 1);
      months.push(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
    }

    // If simulation is enabled, generate new real prices
    if (realPriceParams.useSimulation) {
      const simulatedPrices = simulateRealPrices(months, startDate);
      setRealPrices(simulatedPrices);
    }

    const timeToMaturities = months.map(date => {
      const diffTime = Math.abs(date - startDate);
      return diffTime / (325.25 * 24 * 60 * 60 * 1000);
    });

    const monthlyVolume = params.totalVolume / params.monthsToHedge;

    const detailedResults = months.map((date, i) => {
      // Get forward price
      const forward = (() => {
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        return manualForwards[monthKey] || 
          params.spotPrice * Math.exp(params.interestRate/100 * (date - startDate)/(1000 * 60 * 60 * 24 * 365));
      })();

      // Get real price and store monthKey for reuse
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const realPrice = realPrices[monthKey] || forward;

      const t = timeToMaturities[i];

      // Calculate option prices using forward price (for initial cost)
      const optionPrices = strategy.map((option, optIndex) => {
        const strike = option.strikeType === 'percent' ? 
          params.spotPrice * (option.strike/100) : 
          option.strike;
        
        return {
          type: option.type,
          price: calculateOptionPrice(
            option.type,
            forward,
            strike,
            params.interestRate/100,
            t,
            option.volatility/100
          ),
          quantity: option.quantity/100,
          strike: strike,
          label: `${option.type === 'call' ? 'Call' : 'Put'} Price ${optIndex + 1}`
        };
      });

      // Calculate strategy price (cost of options)
      const strategyPrice = optionPrices.reduce((total, opt) => 
        total + (opt.price * opt.quantity), 0);

      // Calculate payoff using real price
      const totalPayoff = optionPrices.reduce((sum, opt) => {
        const payoff = opt.type === 'call' 
          ? Math.max(realPrice - opt.strike, 0)
          : Math.max(opt.strike - realPrice, 0);
        return sum + (payoff * opt.quantity);
      }, 0);

      // Calculate hedged cost using real price and including payoff
      const hedgedCost = -(monthlyVolume * realPrice) - (monthlyVolume * strategyPrice) + (monthlyVolume * totalPayoff);
      const unhedgedCost = -(monthlyVolume * realPrice);

      return {
        date: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        timeToMaturity: t,
        forward,
        realPrice,
        optionPrices,
        strategyPrice,
        totalPayoff,
        monthlyVolume,
        hedgedCost,
        unhedgedCost,
        deltaPnL: hedgedCost - unhedgedCost
      };
    });

    setResults(detailedResults);
    calculatePayoff();
  };

  useEffect(() => {
    if (strategy.length > 0) {
      calculatePayoff();
    }
  }, [strategy]);

  // Stress Test Scenarios
  const stressTestScenarios = {
    base: {
      name: "Base Case",
      description: "Normal market conditions",
      volatility: 0.2,
      drift: 0.01,
      priceShock: 0,
      forwardBasis: 0
    },
    highVol: {
      name: "High Volatility",
      description: "Double volatility scenario",
      volatility: 0.4,
      drift: 0.01,
      priceShock: 0,
      forwardBasis: 0
    },
    crash: {
      name: "Market Crash",
      description: "High volatility, negative drift, price shock",
      volatility: 0.5,
      drift: -0.03,
      priceShock: -0.2,
      forwardBasis: 0
    },
    bull: {
      name: "Bull Market",
      description: "Low volatility, positive drift, upward shock",
      volatility: 0.15,
      drift: 0.02,
      priceShock: 0.1,
      forwardBasis: 0
    },
    contango: {
      name: "Contango",
      description: "Forward prices higher than spot (monthly basis in %)",
      volatility: 0.2,
      drift: 0.01,
      priceShock: 0,
      forwardBasis: 0.01
    },
    backwardation: {
      name: "Backwardation",
      description: "Forward prices lower than spot (monthly basis in %)",
      volatility: 0.2,
      drift: 0.01,
      priceShock: 0,
      forwardBasis: -0.01
    }
  };

  // Apply stress test scenario
  const applyStressTest = (scenarioKey: keyof typeof stressTestScenarios) => {
    const scenario = stressTestScenarios[scenarioKey];
    
    // Update simulation parameters
    setRealPriceParams(prev => ({
      ...prev,
      useSimulation: true,
      volatility: scenario.volatility,
      drift: scenario.drift
    }));

    // Apply price shock if any
    if (scenario.priceShock !== 0) {
      setParams(prev => ({
        ...prev,
        spotPrice: prev.spotPrice * (1 + scenario.priceShock)
      }));
    }

    // Update forward curve if basis is specified
    if (scenario.forwardBasis !== 0) {
      const startDate = new Date(params.startDate);
      const months = [];
      let currentDate = new Date(startDate);

      for (let i = 0; i < params.monthsToHedge; i++) {
        currentDate.setMonth(currentDate.getMonth() + 1);
        const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;
        const timeInYears = i / 12;
        const forwardPrice = params.spotPrice * Math.exp(scenario.forwardBasis * timeInYears * 12);
        
        setManualForwards(prev => ({
          ...prev,
          [monthKey]: forwardPrice
        }));
      }
    }

    // Recalculate results with new parameters
    calculateResults();
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <Tabs defaultValue="parameters">
        <TabsList>
          <TabsTrigger value="parameters">Strategy Parameters</TabsTrigger>
          <TabsTrigger value="stress">Stress Testing</TabsTrigger>
        </TabsList>
        
        <TabsContent value="parameters">
          <Card>
            <CardHeader>
              <CardTitle>Options Strategy Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={params.startDate}
                    onChange={(e) => setParams({...params, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Months to Hedge</label>
                  <Input
                    type="number"
                    value={params.monthsToHedge}
                    onChange={(e) => setParams({...params, monthsToHedge: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                  <Input
                    type="number"
                    value={params.interestRate}
                    onChange={(e) => setParams({...params, interestRate: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Total Volume</label>
                  <Input
                    type="number"
                    value={params.totalVolume}
                    onChange={(e) => setParams({...params, totalVolume: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Spot Price</label>
                  <Input
                    type="number"
                    value={params.spotPrice}
                    onChange={(e) => setParams({...params, spotPrice: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-medium mb-4">Real Price Simulation</h3>
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    checked={realPriceParams.useSimulation}
                    onChange={(e) => setRealPriceParams(prev => ({...prev, useSimulation: e.target.checked}))}
                    className="mr-2"
                  />
                  <label>Use Monte Carlo Simulation</label>
                </div>
                
                {realPriceParams.useSimulation && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Volatility (%)</label>
                      <Input
                        type="number"
                        value={realPriceParams.volatility * 100}
                        onChange={(e) => setRealPriceParams(prev => ({
                          ...prev,
                          volatility: Number(e.target.value) / 100
                        }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Drift (%)</label>
                      <Input
                        type="number"
                        value={realPriceParams.drift * 100}
                        onChange={(e) => setRealPriceParams(prev => ({
                          ...prev,
                          drift: Number(e.target.value) / 100
                        }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Strategy Components</CardTitle>
              <Button onClick={addOption} className="flex items-center gap-2">
                <Plus size={16} /> Add Option
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {strategy.map((option, index) => (
                  <div key={index} className="grid grid-cols-6 gap-4 items-center p-4 border rounded">
                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <select
                        className="w-full p-2 border rounded"
                        value={option.type}
                        onChange={(e) => updateOption(index, 'type', e.target.value)}
                      >
                        <option value="call">Call</option>
                        <option value="put">Put</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Strike</label>
                      <Input
                        type="number"
                        value={option.strike}
                        onChange={(e) => updateOption(index, 'strike', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Strike Type</label>
                      <select
                        className="w-full p-2 border rounded"
                        value={option.strikeType}
                        onChange={(e) => updateOption(index, 'strikeType', e.target.value)}
                      >
                        <option value="percent">Percentage</option>
                        <option value="absolute">Absolute</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Volatility (%)</label>
                      <Input
                        type="number"
                        value={option.volatility}
                        onChange={(e) => updateOption(index, 'volatility', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantity (%)</label>
                      <Input
                        type="number"
                        value={option.quantity}
                        onChange={(e) => updateOption(index, 'quantity', Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="destructive"
                        onClick={() => removeOption(index)}
                        className="flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button onClick={calculateResults} className="w-full">
            Calculate Strategy Results
          </Button>
        </TabsContent>

        <TabsContent value="stress">
          <Card>
            <CardHeader>
              <CardTitle>Stress Test Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stressTestScenarios).map(([key, scenario]) => (
                  <Card key={key} className="p-4">
                    <h3 className="font-bold text-lg mb-2">{scenario.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">{scenario.description}</p>
                    <div className="space-y-2 text-sm">
                      <p>Volatility: {(scenario.volatility * 100).toFixed(1)}%</p>
                      <p>Drift: {(scenario.drift * 100).toFixed(1)}%</p>
                      {scenario.priceShock !== 0 && (
                        <p>Price Shock: {(scenario.priceShock * 100).toFixed(1)}%</p>
                      )}
                      {scenario.forwardBasis !== 0 && (
                        <p>Monthly Basis: {(scenario.forwardBasis * 100).toFixed(1)}%</p>
                      )}
                    </div>
                    <Button 
                      className="w-full mt-4"
                      onClick={() => applyStressTest(key as keyof typeof stressTestScenarios)}
                    >
                      Run Scenario
                    </Button>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {results && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Detailed Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2">Maturity</th>
                      <th className="border p-2">Time to Maturity</th>
                      <th className="border p-2 bg-gray-50">Forward Price</th>
                      <th className="border p-2 bg-blue-50">Real Price {realPriceParams.useSimulation ? '(Simulated)' : '(Manual Input)'}</th>
                      {strategy.map((opt, i) => (
                        <th key={i} className="border p-2">{opt.type === 'call' ? 'Call' : 'Put'} Price {i + 1}</th>
                      ))}
                      <th className="border p-2">Strategy Price</th>
                      <th className="border p-2">Strategy Payoff</th>
                      <th className="border p-2">Volume</th>
                      <th className="border p-2">Hedged Cost</th>
                      <th className="border p-2">Unhedged Cost</th>
                      <th className="border p-2">Delta P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, i) => (
                      <tr key={i}>
                        <td className="border p-2">{row.date}</td>
                        <td className="border p-2">{row.timeToMaturity.toFixed(4)}</td>
                        <td className="border p-2">
                          <Input
                            type="number"
                            value={(() => {
                              const date = new Date(row.date);
                              const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                              return manualForwards[monthKey] || row.forward.toFixed(2);
                            })()}
                            onChange={(e) => {
                              const date = new Date(row.date);
                              const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                              const newValue = e.target.value === '' ? '' : Number(e.target.value);
                              setManualForwards(prev => ({
                                ...prev,
                                [monthKey]: newValue
                              }));
                            }}
                            onBlur={() => calculateResults()}
                            className="w-32 text-right"
                            step="0.01"
                          />
                        </td>
                        <td className="border p-2">
                          <Input
                            type="number"
                            value={row.realPrice.toFixed(2)}
                            onChange={(e) => {
                              const date = new Date(row.date);
                              const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                              const newValue = e.target.value === '' ? '' : Number(e.target.value);
                              setRealPrices(prev => ({
                                ...prev,
                                [monthKey]: newValue
                              }));
                            }}
                            onBlur={() => calculateResults()}
                            className="w-32 text-right"
                            step="0.01"
                            disabled={realPriceParams.useSimulation}
                          />
                        </td>
                        {row.optionPrices.map((opt, j) => (
                          <td key={j} className="border p-2">{opt.price.toFixed(2)}</td>
                        ))}
                        <td className="border p-2">{row.strategyPrice.toFixed(2)}</td>
                        <td className="border p-2">{row.totalPayoff.toFixed(2)}</td>
                        <td className="border p-2">{row.monthlyVolume.toFixed(0)}</td>
                        <td className="border p-2">{row.hedgedCost.toFixed(2)}</td>
                        <td className="border p-2">{row.unhedgedCost.toFixed(2)}</td>
                        <td className="border p-2">{row.deltaPnL.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>P&L Evolution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="deltaPnL" name="Delta P&L" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Real vs Forward Prices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="forward" 
                      name="Forward Price" 
                      stroke="#8884d8" 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="realPrice"
                      name="Real Price"
                      stroke="#82ca9d"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {payoffData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payoff Diagram at Maturity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={payoffData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="price" 
                        label={{ value: 'Underlying Price', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis 
                        label={{ value: 'Payoff', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="payoff" 
                        name="Strategy Payoff" 
                        stroke="#82ca9d" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <p>Payoff Diagram Explanation:</p>
                  <ul className="list-disc pl-5">
                    <li>Shows the total payoff of your option strategy at maturity</li>
                    <li>The x-axis represents the underlying price</li>
                    <li>The y-axis shows the corresponding payoff value</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Summary Statistics by Year</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {(() => {
                  const yearlyResults = results.reduce((acc, row) => {
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

                  return (
                    <table className="w-full border-collapse mb-6">
                      <thead>
                        <tr>
                          <th className="border p-2 text-left">Year</th>
                          <th className="border p-2 text-right">Total Cost with Hedging</th>
                          <th className="border p-2 text-right">Total Cost without Hedging</th>
                          <th className="border p-2 text-right">Total P&L</th>
                          <th className="border p-2 text-right">Cost Reduction (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(yearlyResults).map(([year, data]) => (
                          <tr key={year}>
                            <td className="border p-2 font-medium">{year}</td>
                            <td className="border p-2 text-right">
                              {data.hedgedCost.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                            <td className="border p-2 text-right">
                              {data.unhedgedCost.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                            <td className="border p-2 text-right">
                              {data.deltaPnL.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                            <td className="border p-2 text-right">
                              {((data.deltaPnL / Math.abs(data.unhedgedCost)) * 100).toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Summary Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className="border p-2 font-medium">Total Cost with Hedging</td>
                      <td className="border p-2 text-right">
                        {results.reduce((sum, row) => sum + row.hedgedCost, 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-medium">Total Cost without Hedging</td>
                      <td className="border p-2 text-right">
                        {results.reduce((sum, row) => sum + row.unhedgedCost, 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-medium">Total P&L</td>
                      <td className="border p-2 text-right">
                        {results.reduce((sum, row) => sum + row.deltaPnL, 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-medium">Cost Reduction (%)</td>
                      <td className="border p-2 text-right">
                        {(() => {
                          const totalPnL = results.reduce((sum, row) => sum + row.deltaPnL, 0);
                          const totalUnhedgedCost = results.reduce((sum, row) => sum + row.unhedgedCost, 0);
                          return ((totalPnL / Math.abs(totalUnhedgedCost)) * 100).toFixed(2) + '%';
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Index;
