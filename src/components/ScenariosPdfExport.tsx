import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SavedScenario } from '../types/Scenario';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

interface Props {
  scenarios: SavedScenario[];
  selectedScenarios: string[];
  setSelectedScenarios: (ids: string[]) => void;
}

const ScenariosPdfExport = ({ scenarios, selectedScenarios, setSelectedScenarios }: Props) => {
  const toggleScenario = (id: string) => {
    setSelectedScenarios(
      selectedScenarios.includes(id)
        ? selectedScenarios.filter(s => s !== id)
        : [...selectedScenarios, id]
    );
  };

  const toggleAll = () => {
    setSelectedScenarios(
      selectedScenarios.length === scenarios.length
        ? []
        : scenarios.map(s => s.id)
    );
  };

  const exportToPdf = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    let yOffset = 20;

    // Filter selected scenarios
    const scenariosToExport = scenarios.filter(s => selectedScenarios.includes(s.id));

    for (const scenario of scenariosToExport) {
      // Start a new page for each scenario
      if (scenario !== scenariosToExport[0]) {
        pdf.addPage();
        yOffset = 20;
      }

      // Add title
      pdf.setFontSize(16);
      pdf.text(scenario.name, 20, yOffset);
      yOffset += 10;

      // Add date
      pdf.setFontSize(12);
      pdf.text(`Generated on: ${new Date(scenario.timestamp).toLocaleString()}`, 20, yOffset);
      yOffset += 10;

      // Add Basic Parameters
      pdf.addPage();
      yOffset = 20;
      pdf.setFontSize(14);
      pdf.text('Basic Parameters', 20, yOffset);
      yOffset += 10;

      const basicParams = [
        ['Parameter', 'Value'],
        ['Start Date', scenario.params.startDate],
        ['Months to Hedge', scenario.params.monthsToHedge.toString()],
        ['Interest Rate', `${scenario.params.interestRate}%`],
        ['Total Volume', scenario.params.totalVolume.toString()],
        ['Spot Price', scenario.params.spotPrice.toString()]
      ];

      pdf.autoTable({
        startY: yOffset,
        head: [basicParams[0]],
        body: basicParams.slice(1),
        margin: { left: 20 }
      });

      // Add Stress Test Parameters if available
      pdf.addPage();
      yOffset = 20;
      if (scenario.stressTest) {
        pdf.text('Stress Test Parameters', 20, yOffset);
        yOffset += 10;

        const stressParams = [
          ['Parameter', 'Value'],
          ['Scenario Type', scenario.stressTest.name],
          ['Volatility', `${(scenario.stressTest.volatility * 100).toFixed(1)}%`],
          ['Drift', `${(scenario.stressTest.drift * 100).toFixed(1)}%`],
          ['Price Shock', `${(scenario.stressTest.priceShock * 100).toFixed(1)}%`]
        ];

        pdf.autoTable({
          startY: yOffset,
          head: [stressParams[0]],
          body: stressParams.slice(1),
          margin: { left: 20 }
        });
      }

      // Add Strategy Components
      pdf.addPage();
      yOffset = 20;
      pdf.text('Strategy Components', 20, yOffset);
      yOffset += 10;

      const strategyData = scenario.strategy.map(opt => [
        opt.type,
        `${opt.strike} (${opt.strikeType})`,
        `${opt.volatility}%`,
        `${opt.quantity}%`
      ]);

      pdf.autoTable({
        startY: yOffset,
        head: [['Type', 'Strike', 'Volatility', 'Quantity']],
        body: strategyData,
        margin: { left: 20 }
      });

      // Add charts on a new page
      pdf.addPage();
      yOffset = 20;
      pdf.text('Charts', 20, yOffset);
      yOffset += 20;

      // Calculate dimensions that maintain aspect ratio
      const pageWidth = pdf.internal.pageSize.width;
      const margin = 20;
      const usableWidth = pageWidth - (2 * margin);
      const aspectRatio = 2; // Width:Height ratio (typical chart ratio is 2:1)
      const chartHeight = usableWidth / aspectRatio;

      // Get the chart elements and convert to images
      const chartElement = document.getElementById(`pnl-chart-${scenario.id}`);
      if (chartElement) {
        const canvas = await html2canvas(chartElement);
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', margin, yOffset, usableWidth, chartHeight);
        yOffset += chartHeight + 20; // Add some spacing between charts
      }

      const payoffElement = document.getElementById(`payoff-chart-${scenario.id}`);
      if (payoffElement) {
        const canvas = await html2canvas(payoffElement);
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', margin, yOffset, usableWidth, chartHeight);
      }

      // Add Summary Statistics on a new page
      pdf.addPage();
      yOffset = 20;
      pdf.text('Summary Statistics', 20, yOffset);
      yOffset += 10;

      const totalPnL = scenario.results.reduce((sum, row) => sum + row.deltaPnL, 0);
      const totalUnhedgedCost = scenario.results.reduce((sum, row) => sum + row.unhedgedCost, 0);
      const costReduction = ((totalPnL / Math.abs(totalUnhedgedCost)) * 100).toFixed(2);

      const summaryStats = [
        ['Metric', 'Value'],
        ['Total Cost with Hedging', scenario.results.reduce((sum, row) => sum + row.hedgedCost, 0).toFixed(2)],
        ['Total Cost without Hedging', totalUnhedgedCost.toFixed(2)],
        ['Total P&L', totalPnL.toFixed(2)],
        ['Cost Reduction', `${costReduction}%`]
      ];

      pdf.autoTable({
        startY: yOffset,
        head: [summaryStats[0]],
        body: summaryStats.slice(1),
        margin: { left: 20 }
      });

      // Add Detailed Results on a new page
      pdf.addPage();
      yOffset = 20;
      pdf.text('Detailed Results', 20, yOffset);
      yOffset += 10;
      
      const detailedResults = scenario.results.map(row => [
        row.date,
        row.forward.toFixed(2),
        row.realPrice.toFixed(2),
        row.strategyPrice.toFixed(2),
        row.totalPayoff.toFixed(2),
        row.hedgedCost.toFixed(2),
        row.unhedgedCost.toFixed(2),
        row.deltaPnL.toFixed(2)
      ]);

      pdf.autoTable({
        startY: yOffset,
        head: [['Date', 'Forward', 'Real Price', 'Strategy Price', 'Payoff', 'Hedged Cost', 'Unhedged Cost', 'Delta P&L']],
        body: detailedResults,
        margin: { left: 20 }
      });
    }

    // Save the PDF
    pdf.save('options-scenarios.pdf');
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-4 mb-4">
        <Checkbox
          checked={selectedScenarios.length === scenarios.length}
          onCheckedChange={toggleAll}
          id="select-all"
        />
        <label htmlFor="select-all">Select All Scenarios</label>
        <Button
          onClick={exportToPdf}
          disabled={selectedScenarios.length === 0}
        >
          Export Selected to PDF
        </Button>
      </div>
      <div className="space-y-2">
        {scenarios.map(scenario => (
          <div key={scenario.id} className="flex items-center gap-2">
            <Checkbox
              checked={selectedScenarios.includes(scenario.id)}
              onCheckedChange={() => toggleScenario(scenario.id)}
              id={`scenario-${scenario.id}`}
            />
            <label htmlFor={`scenario-${scenario.id}`}>
              {scenario.name} ({new Date(scenario.timestamp).toLocaleDateString()})
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScenariosPdfExport; 