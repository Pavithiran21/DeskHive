const fs = require('node:fs');
const path = require('node:path');

// SeedTestRunner makes 4,000 Employees, emp-0001 to emp-4000@e2e.deskhive.test, and three Admins,
// all with E2E_PASSWORD. Each test claims the Employees it needs, so "one desk a day" never collides
// between tests running in parallel.
//
// A slot is claimed by creating e2e/.slots/<n> with the "wx" flag, which fails if the file exists:
// atomic across Playwright's worker processes. prepare.js clears the folder before every run.

const EMPLOYEE_POOL = 4000;
const DOMAIN = '@e2e.deskhive.test';
const ADMINS = [1, 2, 3].map((n) => `admin${n}${DOMAIN}`);
const slotsDir = path.join(__dirname, '..', '.slots');

function claimEmployee() {
  fs.mkdirSync(slotsDir, { recursive: true });
  for (let slot = 1; slot <= EMPLOYEE_POOL; slot += 1) {
    try {
      fs.closeSync(fs.openSync(path.join(slotsDir, String(slot)), 'wx'));
      return `emp-${String(slot).padStart(4, '0')}${DOMAIN}`;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('Every Employee slot is taken; run prepare.js again.');
}

function claimEmployees(count) {
  return Array.from({ length: count }, claimEmployee);
}

module.exports = { ADMINS, claimEmployee, claimEmployees };
