import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, Save } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from 'react-router-dom';
import { CalculatorState } from '../types/CalculatorState';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface StressTestScenario {
  name: string;
  description: string;
  volatility: number;
  drift: number;
  priceShock: number;
  forwardBasis?: number;
  realBasis?: number;
  isCustom?: boolean;
  isEditable?: boolean;
}

interface StrategyComponent {
  type: 'call' | 'put';
  strike: number;
  strikeType: 'percent' | 'absolute';
  volatility: number;
  quantity: number;
}

interface Result {
  date: string;
  timeToMaturity: number;
  forward: number;
  realPrice: number;
  optionPrices: Array<{
    type: string;
    price: number;
    quantity: number;
    strike: number;
    label: string;
  }>;
  strategyPrice: number;
  totalPayoff: number;
  monthlyVolume: number;
  hedgedCost: number;
  unhedgedCost: number;
  deltaPnL: number;
}

interface SavedScenario {
  id: string;
  name: string;
  timestamp: number;
  params: {
    startDate: string;
    monthsToHedge: number;
    interestRate: number;
    totalVolume: number;
    spotPrice: number;
  };
  strategy: StrategyComponent[];
  results: Result[];
  payoffData: Array<{ price: number; payoff: number }>;
  stressTest?: StressTestScenario;
}

interface PdfOptions {
  html2canvas: {
    scale: number;
    useCORS: boolean;
    logging: boolean;
    letterRendering: boolean;
    allowTaint: boolean;
    foreignObjectRendering: boolean;
    svgRendering: boolean;
  };
}

const DEFAULT_SCENARIOS = {
  base: {
    name: "Base Case",
    description: "Normal market conditions",
    volatility: 0.2,
    drift: 0.01,
    priceShock: 0,
    forwardBasis: 0,
    isEditable: true
  },
  highVol: {
    name: "High Volatility",
    description: "Double volatility scenario",
    volatility: 0.4,
    drift: 0.01,
    priceShock: 0,
    forwardBasis: 0,
    isEditable: true
  },
  crash: {
    name: "Market Crash",
    description: "High volatility, negative drift, price shock",
    volatility: 0.5,
    drift: -0.03,
    priceShock: -0.2,
    forwardBasis: 0,
    isEditable: true
  },
  bull: {
    name: "Bull Market",
    description: "Low volatility, positive drift, upward shock",
    volatility: 0.15,
    drift: 0.02,
    priceShock: 0.1,
    forwardBasis: 0,
    isEditable: true
  }
};

const Index = () => {
  // Add state for active tab
  const [activeTab, setActiveTab] = useState(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).activeTab : 'parameters';
  });

  // Basic parameters state
  const [params, setParams] = useState(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).params : {
      startDate: new Date().toISOString().split('T')[0],
      monthsToHedge: 12,
      interestRate: 2.0,
      totalVolume: 1000000,
      spotPrice: 100
    };
  });

  // Keep track of initial spot price
  const [initialSpotPrice, setInitialSpotPrice] = useState<number>(params.spotPrice);

  // Strategy components state
  const [strategy, setStrategy] = useState(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).strategy : [];
  });

  // Results state
  const [results, setResults] = useState(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).results : null;
  });

  // Manual forward prices state
  const [manualForwards, setManualForwards] = useState(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).manualForwards : {};
  });

  // Real prices state
  const [realPrices, setRealPrices] = useState(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).realPrices : {};
  });

  // Payoff data state
  const [payoffData, setPayoffData] = useState(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).payoffData : [];
  });

  // Real prices simulation parameters
  const [realPriceParams, setRealPriceParams] = useState(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).realPriceParams : {
      useSimulation: false,
      volatility: 0.3,
      drift: 0.01,
      numSimulations: 1000
    };
  });

  // Month names in English
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Custom scenario state
  const [customScenario, setCustomScenario] = useState<StressTestScenario>(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).customScenario : {
      name: "Custom Case",
      description: "User-defined scenario",
      volatility: 0.2,
      drift: 0.01,
      priceShock: 0,
      forwardBasis: 0,
      isCustom: true
    };
  });

  // Stress Test Scenarios
  const [stressTestScenarios, setStressTestScenarios] = useState<Record<string, StressTestScenario>>(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).stressTestScenarios : {
      base: {
        name: "Base Case",
        description: "Normal market conditions",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isEditable: true
      },
      highVol: {
        name: "High Volatility",
        description: "Double volatility scenario",
        volatility: 0.4,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isEditable: true
      },
      crash: {
        name: "Market Crash",
        description: "High volatility, negative drift, price shock",
        volatility: 0.5,
        drift: -0.03,
        priceShock: -0.2,
        forwardBasis: 0,
        isEditable: true
      },
      bull: {
        name: "Bull Market",
        description: "Low volatility, positive drift, upward shock",
        volatility: 0.15,
        drift: 0.02,
        priceShock: 0.1,
        forwardBasis: 0,
        isEditable: true
      },
      contango: {
        name: "Contango",
        description: "Forward prices higher than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0.01,
        isEditable: true
      },
      backwardation: {
        name: "Backwardation",
        description: "Forward prices lower than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: -0.01,
        isEditable: true
      },
      contangoReal: {
        name: "Contango (Real Prices)",
        description: "Real prices higher than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        realBasis: 0.01,
        isEditable: true
      },
      backwardationReal: {
        name: "Backwardation (Real Prices)",
        description: "Real prices lower than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        realBasis: -0.01,
        isEditable: true
      },
      custom: {
        name: "Custom Case",
        description: "User-defined scenario",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isCustom: true
      }
    };
  });

  // Add this new state
  const [activeStressTest, setActiveStressTest] = useState<string | null>(null);

  // Add state for showing inputs
  const [showInputs, setShowInputs] = useState<Record<string, boolean>>({});

  // Toggle inputs visibility for a scenario
  const toggleInputs = (key: string) => {
    setShowInputs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Ajouter les états pour la volatilité implicite
  const [showImpliedVol, setShowImpliedVol] = useState(false);
  const [customVolatilities, setCustomVolatilities] = useState<{[key: string]: number}>({});

  // Modifier la fonction de calcul des options pour utiliser la volatilité implicite
  const calculateOptionPrice = (type: string, S: number, K: number, r: number, t: number, sigma: number, monthKey?: string) => {
    // Utiliser la volatilité implicite si disponible
    const effectiveVolatility = (showImpliedVol && monthKey && customVolatilities[monthKey]) 
      ? customVolatilities[monthKey] 
      : sigma;

    const d1 = (Math.log(S/K) + (r + effectiveVolatility**2/2)*t) / (effectiveVolatility*Math.sqrt(t));
    const d2 = d1 - effectiveVolatility*Math.sqrt(t);
    
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
    const y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t*Math.exp(-x*x));
    
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
  const removeOption = (indexToRemove: number) => {
    // Créer une copie profonde de la stratégie actuelle
    const newStrategy = JSON.parse(JSON.stringify(strategy));
    newStrategy.splice(indexToRemove, 1);
    
    // Mettre à jour l'état de la stratégie
    setStrategy(newStrategy);
    
    // Si la stratégie est vide
    if (newStrategy.length === 0) {
      setResults(null);
      setPayoffData([]);
      return;
    }

    // Si les résultats existent déjà, les mettre à jour
    if (results) {
      setResults(results.map(row => {
        const monthKey = `${new Date(row.date).getFullYear()}-${new Date(row.date).getMonth() + 1}`;
        
        // Recalculer les prix des options restantes
        const optionPrices = newStrategy.map(opt => {
          const strike = opt.strikeType === 'percent' 
            ? params.spotPrice * (opt.strike/100) 
            : opt.strike;

          const volatility = showImpliedVol && customVolatilities[monthKey] 
            ? customVolatilities[monthKey] 
            : opt.volatility/100;

          const price = calculateOptionPrice(
            opt.type,
            row.forward,
            strike,
            params.interestRate/100,
            row.timeToMaturity,
            volatility,
            monthKey
          );

          return {
            type: opt.type,
            price,
            quantity: opt.quantity/100,
            strike,
            label: `${opt.type} ${strike}`
          };
        });

        // Recalculer le prix de la stratégie
        const strategyPrice = optionPrices.reduce((sum, opt) => 
          sum + opt.price * opt.quantity, 0);

        // Recalculer le payoff
        const totalPayoff = optionPrices.reduce((sum, opt) => {
          const intrinsicValue = opt.type === 'call'
            ? Math.max(row.realPrice - opt.strike, 0)
            : Math.max(opt.strike - row.realPrice, 0);
          return sum + intrinsicValue * opt.quantity;
        }, 0);

        // Mettre à jour les coûts et P&L
        const hedgedCost = row.monthlyVolume * (row.realPrice + strategyPrice - totalPayoff);
        const deltaPnL = row.unhedgedCost - hedgedCost;

        return {
          ...row,
          optionPrices,
          strategyPrice,
          totalPayoff,
          hedgedCost,
          deltaPnL
        };
      }));
    }

    // Mettre à jour le diagramme de payoff
    calculatePayoff();
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
    // Vérifier si la stratégie existe et n'est pas vide
    if (!strategy || strategy.length === 0) {
      setResults(null);
      setPayoffData([]);
      return;
    }

    const newResults = [];
    let startDate = new Date(params.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + params.monthsToHedge - 1);
    
    // Calculer le nombre de jours dans le premier mois
    const lastDayOfStartMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const daysInFirstMonth = lastDayOfStartMonth.getDate() - startDate.getDate() + 1;
    const totalDaysInFirstMonth = lastDayOfStartMonth.getDate();

    for (let i = 0; i < params.monthsToHedge; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      // Calcul du temps jusqu'à l'échéance
      let timeToMaturity;
      if (i === 0) {
        // Pour le premier mois, utiliser les jours restants
        timeToMaturity = daysInFirstMonth / (totalDaysInFirstMonth * params.monthsToHedge);
      } else {
        // Pour les mois suivants, progression régulière
        timeToMaturity = i / params.monthsToHedge;
      }

      // 2. Prix forward
      const forward = manualForwards[monthKey] || params.spotPrice;

      // 3. Prix réel
      const realPrice = realPriceParams.useSimulation 
        ? calculateSimulatedPrice(params.spotPrice, i, realPriceParams)
        : (realPrices[monthKey] || forward);

      // 4. Calcul correct des prix d'options
      const optionPrices = strategy.map(opt => {
        const strike = opt.strikeType === 'percent' 
          ? params.spotPrice * (opt.strike/100) 
          : opt.strike;

        const volatility = showImpliedVol && customVolatilities[monthKey] 
          ? customVolatilities[monthKey] 
          : opt.volatility/100;

        const price = calculateOptionPrice(
          opt.type,
          forward,
          strike,
          params.interestRate/100,
          timeToMaturity,
          volatility,
          monthKey
        );

        return {
          type: opt.type,
          price,
          quantity: opt.quantity/100,
          strike,
          label: `${opt.type} ${strike}`
        };
      });

      // 5. Prix de la stratégie (somme des primes)
      const strategyPrice = optionPrices.reduce((sum, opt) => 
        sum + opt.price * opt.quantity, 0);

      // 6. Calcul du payoff (valeur intrinsèque à la date donnée)
      const totalPayoff = optionPrices.reduce((sum, opt) => {
        const intrinsicValue = opt.type === 'call'
          ? Math.max(realPrice - opt.strike, 0)
          : Math.max(opt.strike - realPrice, 0);
        return sum + intrinsicValue * opt.quantity;
      }, 0);

      const monthlyVolume = params.totalVolume / params.monthsToHedge;
      const hedgedCost = monthlyVolume * (realPrice + strategyPrice - totalPayoff);
      const unhedgedCost = monthlyVolume * realPrice;
      const deltaPnL = unhedgedCost - hedgedCost;

      newResults.push({
        date: date.toISOString().split('T')[0],
        timeToMaturity,
        forward,
        realPrice,
        optionPrices,
        strategyPrice,
        totalPayoff,
        monthlyVolume,
        hedgedCost,
        unhedgedCost,
        deltaPnL
      });
    }

    setResults(newResults);
    calculatePayoff();
  };

  // Ajouter cette fonction avant calculateResults
  const calculateSimulatedPrice = (spotPrice: number, monthIndex: number, params: { volatility: number; drift: number }) => {
    const t = monthIndex / 12;
    const drift = params.drift;
    const volatility = params.volatility;
    
    // Formule du mouvement brownien géométrique
    return spotPrice * Math.exp((drift - volatility * volatility / 2) * t + volatility * Math.sqrt(t) * (Math.random() * 2 - 1));
  };

  useEffect(() => {
    if (strategy.length > 0) {
      calculatePayoff();
    }
  }, [strategy]);

  // Apply stress test scenario
  const applyStressTest = (key: string) => {
    setActiveStressTest(key);
    const scenario = stressTestScenarios[key];
    if (!scenario) return;
    
    // Calculate stressed spot price
    const stressedSpotPrice = initialSpotPrice * (1 + Number(scenario.priceShock));
    
    // Update simulation parameters
    setRealPriceParams(prev => ({
      ...prev,
      useSimulation: !scenario.realBasis, // Disable simulation if using real basis
      volatility: scenario.volatility,
      drift: scenario.drift
    }));

    // Clear previous prices
    if (scenario.forwardBasis !== undefined) {
      setManualForwards({});
    }
    if (scenario.realBasis !== undefined) {
      setRealPrices({});
    }

    const startDate = new Date(params.startDate);
    let currentDate = new Date(startDate);

    // Update forward curve if forwardBasis is specified (only for traditional contango/backwardation)
    if (scenario.forwardBasis !== undefined && scenario.forwardBasis !== 0) {
      for (let i = 0; i < params.monthsToHedge; i++) {
        currentDate.setMonth(currentDate.getMonth() + 1);
        const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;
        const timeInYears = i / 12;
        const forwardPrice = stressedSpotPrice * Math.exp(Number(scenario.forwardBasis) * timeInYears * 12);
        
        setManualForwards(prev => ({
          ...prev,
          [monthKey]: forwardPrice
        }));
      }
    }

    // Update real prices if realBasis is specified (for real price scenarios)
    if (scenario.realBasis !== undefined && scenario.realBasis !== 0) {
      currentDate = new Date(startDate);
      
      // First, calculate forward prices without any basis
      const baseForwards = {};
      for (let i = 0; i < params.monthsToHedge; i++) {
        currentDate.setMonth(currentDate.getMonth() + 1);
        const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;
        const timeInYears = i / 12;
        // Calculate forward price using risk-free rate only
        const forwardPrice = stressedSpotPrice * Math.exp((params.interestRate/100) * timeInYears);
        baseForwards[monthKey] = forwardPrice;
      }

      // Reset currentDate for real prices
      currentDate = new Date(startDate);
      for (let i = 0; i < params.monthsToHedge; i++) {
        currentDate.setMonth(currentDate.getMonth() + 1);
        const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;
        const timeInYears = i / 12;
        // Apply basis only to real prices
        const realPrice = stressedSpotPrice * Math.exp(Number(scenario.realBasis) * timeInYears * 12);
        
        setRealPrices(prev => ({
          ...prev,
          [monthKey]: realPrice
        }));

        // Set forward price to base forward (without basis)
        setManualForwards(prev => ({
          ...prev,
          [monthKey]: baseForwards[monthKey]
        }));
      }
    }

    // Recalculate results
    calculateResults();
  };

  // Update stress test scenario
  const updateScenario = (key: string, field: keyof StressTestScenario, value: number) => {
    setStressTestScenarios(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  // Type guard for results
  const isValidResult = (result: any): result is Result => {
    return result && 
      typeof result.hedgedCost === 'number' &&
      typeof result.unhedgedCost === 'number' &&
      typeof result.deltaPnL === 'number';
  };

  // Update the yearlyResults calculation with type checking
  const calculateYearlyResults = (results: Result[]) => {
    return results.reduce((acc: Record<string, { hedgedCost: number; unhedgedCost: number; deltaPnL: number }>, row) => {
      const year = row.date.split(' ')[1];
      if (!acc[year]) {
        acc[year] = {
          hedgedCost: 0,
          unhedgedCost: 0,
          deltaPnL: 0
        };
      }
      if (isValidResult(row)) {
        acc[year].hedgedCost += row.hedgedCost;
        acc[year].unhedgedCost += row.unhedgedCost;
        acc[year].deltaPnL += row.deltaPnL;
      }
      return acc;
    }, {});
  };

  // Modifier le gestionnaire de changement du prix spot
  const handleSpotPriceChange = (newPrice: number) => {
    setParams(prev => ({
      ...prev,
      spotPrice: newPrice
    }));
    setInitialSpotPrice(newPrice); // Mettre à jour le prix spot initial uniquement lors des modifications manuelles
  };

  // Add this useEffect near your other useEffect hooks
  useEffect(() => {
    if (!realPriceParams.useSimulation) {
      // When switching to manual mode, initialize real prices with forward prices
      const initialRealPrices = {};
      results?.forEach(row => {
        const date = new Date(row.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        initialRealPrices[monthKey] = row.forward;
      });
      setRealPrices(initialRealPrices);
    }
  }, [realPriceParams.useSimulation]);

  const saveScenario = () => {
    if (!results || !payoffData) return;

    const scenario: SavedScenario = {
      id: crypto.randomUUID(),
      name: `Scenario ${new Date().toLocaleDateString()}`,
      timestamp: Date.now(),
      params,
      strategy,
      results,
      payoffData,
      stressTest: activeStressTest ? stressTestScenarios[activeStressTest] : null
    };

    const savedScenarios = JSON.parse(localStorage.getItem('optionScenarios') || '[]');
    savedScenarios.push(scenario);
    localStorage.setItem('optionScenarios', JSON.stringify(savedScenarios));

    alert('Scenario saved successfully!');
  };

  // Save state when important values change
  useEffect(() => {
    const state: CalculatorState = {
      params,
      strategy,
      results,
      payoffData,
      manualForwards,
      realPrices,
      realPriceParams,
      activeTab,
      customScenario,
      stressTestScenarios
    };
    localStorage.setItem('calculatorState', JSON.stringify(state));
  }, [
    params,
    strategy,
    results,
    payoffData,
    manualForwards,
    realPrices,
    realPriceParams,
    activeTab,
    customScenario,
    stressTestScenarios
  ]);

  const resetScenario = (key: string) => {
    if (DEFAULT_SCENARIOS[key]) {
      setStressTestScenarios(prev => ({
        ...prev,
        [key]: { ...DEFAULT_SCENARIOS[key] }
      }));
    }
  };

  // Add function to clear loaded scenario
  const clearLoadedScenario = () => {
    setParams({
      startDate: new Date().toISOString().split('T')[0],
      monthsToHedge: 12,
      interestRate: 2.0,
      totalVolume: 1000000,
      spotPrice: 100
    });
    setStrategy([]);
    setResults(null);
    setPayoffData([]);
    setManualForwards({});
    setRealPrices({});
    setRealPriceParams({
      useSimulation: false,
      volatility: 0.3,
      drift: 0.01,
      numSimulations: 1000
    });
    
    // Réinitialiser les scénarios de stress test à leurs valeurs par défaut
    setStressTestScenarios({
      base: {
        name: "Base Case",
        description: "Normal market conditions",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isEditable: true
      },
      highVol: {
        name: "High Volatility",
        description: "Double volatility scenario",
        volatility: 0.4,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isEditable: true
      },
      crash: {
        name: "Market Crash",
        description: "High volatility, negative drift, price shock",
        volatility: 0.5,
        drift: -0.03,
        priceShock: -0.2,
        forwardBasis: 0,
        isEditable: true
      },
      bull: {
        name: "Bull Market",
        description: "Low volatility, positive drift, upward shock",
        volatility: 0.15,
        drift: 0.02,
        priceShock: 0.1,
        forwardBasis: 0,
        isEditable: true
      },
      contango: {
        name: "Contango",
        description: "Forward prices higher than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0.01,
        isEditable: true
      },
      backwardation: {
        name: "Backwardation",
        description: "Forward prices lower than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: -0.01,
        isEditable: true
      },
      contangoReal: {
        name: "Contango (Real Prices)",
        description: "Real prices higher than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        realBasis: 0.01,
        isEditable: true
      },
      backwardationReal: {
        name: "Backwardation (Real Prices)",
        description: "Real prices lower than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        realBasis: -0.01,
        isEditable: true
      },
      custom: {
        name: "Custom Case",
        description: "User-defined scenario",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isCustom: true
      }
    });

    // Save the current state but with cleared scenario
    const state: CalculatorState = {
      params: {
        startDate: new Date().toISOString().split('T')[0],
        monthsToHedge: 12,
        interestRate: 2.0,
        totalVolume: 1000000,
        spotPrice: 100
      },
      strategy: [],
      results: null,
      payoffData: [],
      manualForwards: {},
      realPrices: {},
      realPriceParams: {
        useSimulation: false,
        volatility: 0.3,
        drift: 0.01,
        numSimulations: 1000
      },
      activeTab: activeTab,
      customScenario: {
        name: "Custom Case",
        description: "User-defined scenario",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isCustom: true
      },
      stressTestScenarios: DEFAULT_SCENARIOS
    };
    localStorage.setItem('calculatorState', JSON.stringify(state));
  };

  // Add this function to prepare content for PDF export
  const prepareForPDF = () => {
    // Ensure tables don't break across pages
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      (table as HTMLElement).style.pageBreakInside = 'avoid';
      (table as HTMLElement).style.width = '100%';
    });

    // Add proper page breaks between sections
    const sections = document.querySelectorAll('.Card');
    sections.forEach(section => {
      (section as HTMLElement).style.pageBreakInside = 'avoid';
      (section as HTMLElement).style.marginBottom = '20px';
    });
  };

  // Modify the PDF export function
  const exportToPDF = async () => {
    prepareForPDF();

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      compress: true
    });

    // Create a temporary div for PDF content
    const tempDiv = document.createElement('div');
    tempDiv.className = 'scenario-pdf-content';
    tempDiv.innerHTML = `
      <div class="scenario-header">
        <h2>Scenario ${new Date().toLocaleDateString()}</h2>
        <div class="scenario-info">
          <div class="basic-parameters">
            <p>Type: ${strategy[0]?.type || ''}</p>
            <p>Start Date: ${params.startDate}</p>
            <p>Spot Price: ${params.spotPrice}</p>
            <p>Total Volume: ${params.totalVolume}</p>
          </div>
          <div class="stress-parameters">
            <p>Volatility: ${(stressTestScenarios[activeStressTest || 'base']?.volatility * 100).toFixed(1)}%</p>
            <p>Price Shock: ${(stressTestScenarios[activeStressTest || 'base']?.priceShock * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>
      <div class="charts-section">
        ${document.querySelector('.pnl-evolution')?.outerHTML || ''}
        ${document.querySelector('.payoff-diagram')?.outerHTML || ''}
      </div>
      <div class="detailed-results">
        ${document.querySelector('.detailed-results table')?.outerHTML || ''}
      </div>
      <div class="summary-statistics">
        ${document.querySelector('.summary-statistics table')?.outerHTML || ''}
      </div>
    `;

    // Add styles for PDF
    const style = document.createElement('style');
    style.textContent = `
      .scenario-pdf-content {
        padding: 20px;
        font-family: Arial, sans-serif;
      }
      .scenario-header {
        margin-bottom: 20px;
      }
      .scenario-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 30px;
      }
      .charts-section {
        display: grid;
        grid-template-columns: 1fr;
        gap: 20px;
        margin-bottom: 30px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 12px;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
    `;
    tempDiv.appendChild(style);

    document.body.appendChild(tempDiv);
    
    try {
      const options: PdfOptions = {
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          allowTaint: true,
          foreignObjectRendering: true,
          svgRendering: true
        }
      };

      await pdf.html(tempDiv, {
        ...options,
        html2canvas: {
          ...options.html2canvas
        }
      });
      pdf.save('strategy-results.pdf');
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  return (
    <div id="content-to-pdf" className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <style type="text/css" media="print">
        {`
          @page {
            size: portrait;
            margin: 20mm;
          }
          .scenario-content {
            max-width: 800px;
            margin: 0 auto;
          }
          .page-break {
            page-break-before: always;
          }
          table {
            page-break-inside: avoid;
            font-size: 12px;
          }
          .chart-container {
            page-break-inside: avoid;
            margin-bottom: 20px;
            height: 300px !important;
          }
        `}
      </style>
      {/* Add Clear Scenario button if a scenario is loaded */}
      {results && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={clearLoadedScenario}
            className="flex items-center gap-2"
          >
            Clear Loaded Scenario
          </Button>
        </div>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                    onChange={(e) => handleSpotPriceChange(Number(e.target.value))}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      id="useImpliedVol"
                      checked={showImpliedVol}
                      onChange={(e) => setShowImpliedVol(e.target.checked)}
                    />
                    <label htmlFor="useImpliedVol">Use Monthly Implied Volatility</label>
                  </div>
                </div>
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
            <button
              onClick={() => toggleInputs('strategy')}
              className="w-full text-left bg-white rounded-md"
            >
              <div className="flex items-center justify-between p-3">
                <span className="font-medium">Strategy Components</span>
                <svg
                  className={`w-4 h-4 transform transition-transform ${showInputs['strategy'] ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {showInputs['strategy'] && (
            <div className="px-3 pb-3">
              <div className="space-y-4">
                {strategy.map((option, index) => (
                  <div key={index} className="grid grid-cols-5 gap-4 items-end">
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
                        <option value="percentage">Percentage</option>
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
                  </div>
                ))}
              </div>
            </div>
            )}
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Stress Test Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stressTestScenarios).map(([key, scenario]) => (
                  <Card
                    key={key}
                    className="w-full text-left p-3 hover:bg-gray-50"
                  >
                    <button
                      onClick={() => toggleInputs(key)}
                      className="w-full text-left p-3 hover:bg-gray-50"
                    >
                      <span className="font-medium">{scenario.name}</span>
                      <svg
                        className={`w-4 h-4 transform transition-transform ${showInputs[key] ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showInputs[key] && (
                      <div className="px-3 pb-3">
                        <p className="text-xs text-gray-600 mb-2">{scenario.description}</p>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-sm font-medium mb-1">Volatility (%)</label>
                            <Input
                              className="h-7"
                              type="number"
                              value={scenario.volatility * 100}
                              onChange={(e) => updateScenario(key, 'volatility', Number(e.target.value) / 100)}
                              step="0.1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Drift (%)</label>
                            <Input
                              className="h-7"
                              type="number"
                              value={scenario.drift * 100}
                              onChange={(e) => updateScenario(key, 'drift', Number(e.target.value) / 100)}
                              step="0.1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Price Shock (%)</label>
                            <Input
                              className="h-7"
                              type="number"
                              value={scenario.priceShock * 100}
                              onChange={(e) => updateScenario(key, 'priceShock', Number(e.target.value) / 100)}
                              step="0.1"
                            />
                          </div>
                          {scenario.forwardBasis !== undefined && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Monthly Basis (%)</label>
                              <Input
                                className="h-7"
                                type="number"
                                value={scenario.forwardBasis * 100}
                                onChange={(e) => updateScenario(key, 'forwardBasis', Number(e.target.value) / 100)}
                                step="0.1"
                              />
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            applyStressTest(key);
                          }}
                          className="w-full bg-[#0f172a] text-white hover:bg-[#1e293b] mt-4"
                        >
                          Run Scenario
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4 mt-6">
            <Button onClick={calculateResults} className="flex-1">
              Calculate Results
            </Button>
            {results && (
              <>
                <Button onClick={saveScenario} className="flex items-center gap-2">
                  <Save size={16} /> Save Scenario
                </Button>
                <Link to="/saved">
                  <Button variant="outline">View Saved Scenarios</Button>
                </Link>
              </>
            )}
          </div>
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
                      {showImpliedVol && (
                        <th className="border p-2">
                          IV (%)
                        </th>
                      )}
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
                    {results.map((row, i) => {
                      const date = new Date(row.date);
                      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                      
                      return (
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
                              value={(() => {
                                const date = new Date(row.date);
                                const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                                return realPriceParams.useSimulation ? 
                                  row.realPrice.toFixed(2) : 
                                  (realPrices[monthKey] || row.forward);
                              })()}
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
                          {showImpliedVol && (
                            <td className="border p-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={customVolatilities[monthKey] ? (customVolatilities[monthKey] * 100).toFixed(1) : ''}
                                onChange={(e) => {
                                  const newVol = parseFloat(e.target.value);
                                  if (!isNaN(newVol) && newVol >= 0) {
                                    setCustomVolatilities(prev => ({
                                      ...prev,
                                      [monthKey]: newVol / 100
                                    }));
                                    calculateResults();
                                  }
                                }}
                                className="w-20 text-right"
                                placeholder="Enter IV"
                              />
                            </td>
                          )}
                          {row.optionPrices.map((opt, j) => (
                            <td key={j} className="border p-2">
                              {calculateOptionPrice(
                                opt.type,
                                row.forward,
                                opt.strike,
                                params.interestRate/100,
                                row.timeToMaturity,
                                showImpliedVol && customVolatilities[monthKey] 
                                  ? customVolatilities[monthKey] 
                                  : strategy[j].volatility/100,
                                monthKey
                              ).toFixed(2)}
                            </td>
                          ))}
                          <td className="border p-2">{row.strategyPrice.toFixed(2)}</td>
                          <td className="border p-2">{row.totalPayoff.toFixed(2)}</td>
                          <td className="border p-2">{row.monthlyVolume.toFixed(0)}</td>
                          <td className="border p-2">{row.hedgedCost.toFixed(2)}</td>
                          <td className="border p-2">{row.unhedgedCost.toFixed(2)}</td>
                          <td className="border p-2">{row.deltaPnL.toFixed(2)}</td>
                        </tr>
                      );
                    })}
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
                  const yearlyResults = calculateYearlyResults(results);

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
                              {(((data.deltaPnL / Math.abs(data.unhedgedCost)) * 100).toFixed(2) + '%')}
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
                          return (((totalPnL / Math.abs(totalUnhedgedCost)) * 100).toFixed(2) + '%');
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