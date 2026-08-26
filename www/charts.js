// Charts helper module using global Chart.js

let activeChart = null;

// Destroys the active chart to prevent rendering glitches on canvas re-use
export function destroyChart() {
  if (activeChart) {
    activeChart.destroy();
    activeChart = null;
  }
}

// Generate data points for the date range
// entries: array of logs
// startDateStr, endDateStr: ISO date strings YYYY-MM-DD
// nutrientKey: e.g. 'protein_g', 'calories_kcal', etc.
// targetValue: number (the calculated daily target)
export function renderNutritionChart(canvasId, entries, startDateStr, endDateStr, nutrientKey, label, unit, targetValue) {
  destroyChart();

  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  // Retrieve theme colors dynamically from CSS variables
  const computedStyle = getComputedStyle(document.documentElement);
  const textColor = computedStyle.getPropertyValue('--text-secondary').trim() || '#94a3b8';
  const gridColor = computedStyle.getPropertyValue('--chart-grid').trim() || 'rgba(128, 128, 128, 0.1)';
  const labelColor = computedStyle.getPropertyValue('--text-primary').trim() || '#f8fafc';

  // Generate date array between startDate and endDate
  const dates = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  // Aggregate values by date
  const dateValues = {};
  dates.forEach(date => {
    dateValues[date] = 0;
  });

  entries.forEach(entry => {
    const date = entry.entry_date;
    if (dateValues[date] !== undefined) {
      const val = parseFloat(entry[nutrientKey]);
      if (!isNaN(val)) {
        dateValues[date] += val;
      }
    }
  });

  const labels = dates.map(date => {
    const [_, m, d] = date.split('-');
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  });

  const actualData = dates.map(date => dateValues[date]);
  const targetData = dates.map(() => targetValue);

  // Set up chart colors based on the nutrient type
  const isCalories = nutrientKey === 'calories_kcal';
  const barColor = isCalories ? 'rgba(34, 211, 238, 0.75)' : 'rgba(168, 85, 247, 0.75)'; // cyan or purple
  const barBorderColor = isCalories ? '#22d3ee' : '#a855f7';
  const targetColor = 'rgba(239, 68, 68, 0.8)'; // Red target line

  activeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: `Daily Target (${targetValue} ${unit})`,
          data: targetData,
          type: 'line',
          borderColor: targetColor,
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 1
        },
        {
          label: `Actual Intake (${unit})`,
          data: actualData,
          backgroundColor: barColor,
          borderColor: barBorderColor,
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: labelColor,
            font: {
              family: 'Outfit, Inter, system-ui'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function(context) {
              if (context.datasetIndex === 0) {
                return `Target: ${context.parsed.y} ${unit}`;
              }
              const val = context.parsed.y.toFixed(1).replace(/\.0$/, '');
              const pct = targetValue > 0 ? ((context.parsed.y / targetValue) * 100).toFixed(0) : 0;
              return `Intake: ${val} ${unit} (${pct}% of target)`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor,
            font: {
              family: 'Outfit, Inter, system-ui'
            }
          }
        },
        y: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor,
            font: {
              family: 'Outfit, Inter, system-ui'
            }
          },
          beginAtZero: true
        }
      }
    }
  });
}
