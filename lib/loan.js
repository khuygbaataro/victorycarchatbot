// Лизингийн тооцоо — CarNumber1 сайтын томьёотой ЯГ ижил
// (тэнцүү үндсэн төлбөрт зээл / equal-principal).

export function calcLoanAmount(price, downPercent) {
  const p = Math.max(0, price || 0);
  const d = Math.min(100, Math.max(0, downPercent || 0));
  return Math.max(0, p - (p * d) / 100);
}

export function calcEqualPrincipal(loanAmount, monthlyRatePercent, months) {
  const L = Math.max(0, loanAmount || 0);
  const r = (monthlyRatePercent || 0) / 100;
  if (months <= 0) {
    return { principalPerMonth: 0, first: 0, last: 0, totalInterest: 0, total: L };
  }
  const principalPerMonth = L / months;
  const first = principalPerMonth + L * r;
  const last = principalPerMonth + principalPerMonth * r;
  const totalInterest = (r * L * (months + 1)) / 2;
  return { principalPerMonth, first, last, totalInterest, total: L + totalInterest };
}
