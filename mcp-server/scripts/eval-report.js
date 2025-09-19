#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'evals', 'logs');

function loadLogs() {
  if (!fs.existsSync(LOG_DIR)) {
    console.error('No eval logs found. Run a scenario first.');
    process.exit(1);
  }

  const files = fs.readdirSync(LOG_DIR).filter((file) => file.endsWith('.jsonl'));
  if (files.length === 0) {
    console.error('No eval logs found. Run a scenario first.');
    process.exit(1);
  }

  const entries = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(LOG_DIR, file), 'utf8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      entries.push(JSON.parse(line));
    }
  }
  return entries;
}

function summarise(entries) {
  const totals = entries.reduce(
    (acc, entry) => {
      acc.total += 1;
      if (entry.status === 'passed') {
        acc.passed += 1;
      } else {
        acc.failed += 1;
      }
      acc.scenarios.add(entry.scenario);
      return acc;
    },
    { total: 0, passed: 0, failed: 0, scenarios: new Set() }
  );

  const passRate = totals.total ? (totals.passed / totals.total) * 100 : 0;

  return {
    totalRuns: totals.total,
    passRate: passRate.toFixed(2),
    failedRuns: totals.failed,
    uniqueScenarios: totals.scenarios.size,
  };
}

const entries = loadLogs();
const report = summarise(entries);

console.log(`# Eval Summary`);
console.log(`- Total runs analysed: ${report.totalRuns}`);
console.log(`- Pass rate: ${report.passRate}%`);
console.log(`- Failed runs: ${report.failedRuns}`);
console.log(`- Unique scenarios: ${report.uniqueScenarios}`);

if (report.failedRuns > 0) {
  console.log('\n## Follow-up');
  console.log('- Inspect regression diffs in `evals/logs/regressions/`.');
}
