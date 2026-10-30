// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Presentation context only: no candidate, proof or review decisions are changed.
export function proofHeadingLevel(script, document) {
  for (let ancestor = script.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const heading = [...ancestor.children].find(node => /^H[1-6]$/.test(node.tagName));
    if (heading) return Math.min(6, Number(heading.tagName.slice(1)) + 1);
  }
  const title = document.querySelector('main h1, h1');
  return title ? 2 : 1;
}
export function proofRegionTitle(context, statementTitle = '') {
  const label = String(statementTitle).replace(/\s+/gu, ' ').trim();
  return `Inspect the proposed encoding for ${label || context.statementId} (${context.proofId})`;
}
export function installCertificatePrint(view, document) {
  const opened = new Set();
  view.addEventListener('beforeprint', () => {
    for (const disclosure of document.querySelectorAll('details.mkg-certificate')) {
      if (!disclosure.open) { opened.add(disclosure); disclosure.open = true; }
    }
  });
  view.addEventListener('afterprint', () => {
    for (const disclosure of opened) disclosure.open = false;
    opened.clear();
  });
}
