/* Copyright 2026 Kai Prince; SPDX-License-Identifier: Apache-2.0 */
(() => {
  'use strict';
  const start = () => {
  const STORAGE_KEY = 'maths-knowledge-graph.notation.v1';
  const roots = [...document.querySelectorAll('.maths-notation[data-mk-profile], .maths-notation-controls[data-mk-profile]')];
  if (!roots.length) return;
  const tokens = new Set(roots.map(el => el.dataset.mkToken));
  if (tokens.size !== 1 || !roots[0].dataset.mkToken) return;
  const token = roots[0].dataset.mkToken;
  const groups = new Map();
  const choices = new Map();
  let statusNode;
  const persistenceControls = [];
  let persist = false;
  let storageAvailable = true;
  let serial = 0;
  const context = el => JSON.stringify([el.dataset.mkConcept, el.dataset.mkScope, el.dataset.mkProfile]);
  const announce = message => { if (statusNode && statusNode.textContent !== message) statusNode.textContent = message; };
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const storageFailure = (message = 'Browser storage is unavailable. Choices still work on this page and can be exported. Previously saved choices may return after navigation.') => {
    storageAvailable = false;
    persist = false;
    for (const checkbox of persistenceControls) { checkbox.checked = false; checkbox.disabled = true; }
    announce(message);
  };
  for (const root of roots) {
    const key = context(root);
    let group = groups.get(key);
    if (!group) {
      group = { profile: root.dataset.mkProfile, concept: root.dataset.mkConcept, scope: root.dataset.mkScope,
        label: root.dataset.mkConceptLabel || root.dataset.mkProfile,
        default: root.dataset.mkDefault, current: root.dataset.mkDefault, variants: new Map(), occurrences: [], selects: [] };
      groups.set(key, group);
    }
    if (group.default !== root.dataset.mkDefault) return;
    const variantNodes = root.classList.contains('maths-notation-controls')
      ? [...root.querySelectorAll('.maths-notation-choice')]
      : [...root.children].filter(child => child.classList.contains('maths-notation-variant'));
    const nodesByVariant = new Map();
    for (const node of variantNodes) {
      if (context(node) !== key || node.dataset.mkToken !== token) return;
      if (!node.dataset.mkVariant || nodesByVariant.has(node.dataset.mkVariant)) return;
      nodesByVariant.set(node.dataset.mkVariant, node);
      group.variants.set(node.dataset.mkVariant, node.dataset.mkLabel);
    }
    if (!nodesByVariant.has(group.default)) return;
    if (root.classList.contains('maths-notation')) group.occurrences.push(nodesByVariant);
  }
  // Validate every occurrence before enhancing any source state. Mixed/stale
  // nodes retain their authored fallback instead of partially changing a page.
  for (const group of groups.values()) for (const occurrence of group.occurrences) {
    if (occurrence.size !== group.variants.size) return;
    for (const variant of group.variants.keys()) if (!occurrence.has(variant)) return;
  }
  // A prior explicit opt-in is the only reason to restore persistent choices.
  // Reading a blocked storage API is caught; no write occurs on a fresh page.
  let restored = false;
  let stale = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      let saved;
      try { saved = JSON.parse(raw); }
      catch { localStorage.removeItem(STORAGE_KEY); stale = true; }
      if (saved && saved.version === 1 && saved.enabled === true && typeof saved.token === 'string') {
        if (saved.token !== token) { localStorage.removeItem(STORAGE_KEY); stale = true; }
        else if (Array.isArray(saved.choices) && saved.choices.length <= 128) {
          persist = true;
          for (const choice of saved.choices) {
            if (!choice || typeof choice.profile !== 'string' || typeof choice.concept !== 'string'
              || typeof choice.scope !== 'string' || typeof choice.variant !== 'string') continue;
            // Preserve choices for other pages in this same public registry;
            // current-page choices are applied only if the variant exists here.
            const key = JSON.stringify([choice.concept, choice.scope, choice.profile]);
            choices.set(key, choice.variant);
          }
          restored = true;
        } else { localStorage.removeItem(STORAGE_KEY); stale = true; }
      } else if (saved !== undefined) { localStorage.removeItem(STORAGE_KEY); stale = true; }
    }
  } catch { storageFailure(); }
  const exportData = () => ({ version: 1, token, enabled: persist,
    choices: [...choices].map(([key, variant]) => {
      const [concept, scope, profile] = JSON.parse(key);
      return { profile, concept, scope, variant };
    }) });
  const save = failureMessage => {
    if (!persist || !storageAvailable) return false;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(exportData())); return true; }
    catch { storageFailure(failureMessage); return false; }
  };
  const apply = (key, variant) => {
    const group = groups.get(key);
    if (!group || !group.variants.has(variant)) return false;
    if (variant === group.current) return true;
    for (const occurrence of group.occurrences) {
      const previous = occurrence.get(group.current);
      const next = occurrence.get(variant);
      previous.hidden = true;
      previous.setAttribute('aria-hidden', 'true');
      next.hidden = false;
      next.removeAttribute('aria-hidden');
    }
    group.current = variant;
    for (const select of group.selects) select.value = variant;
    return true;
  };
  for (const [key, group] of groups) {
    const variant = choices.get(key);
    if (!apply(key, variant || group.default)) {
      choices.delete(key);
      apply(key, group.default);
    }
  }
  for (const host of roots.filter(el => el.classList.contains('maths-notation-controls'))) {
    const key = context(host);
    const group = groups.get(key);
    const panel = element('div', undefined, 'maths-notation-panel');
    const label = element('label', `Notation for ${group.label} (${group.scope})`);
    const select = element('select');
    let selectId;
    do { selectId = `mk-notation-choice-${++serial}`; } while (document.getElementById(selectId));
    select.id = selectId;
    label.htmlFor = select.id;
    for (const [id, name] of group.variants) {
      const option = element('option', name + (id === group.default ? ' (authored default)' : ''));
      option.value = id; select.append(option);
    }
    select.value = choices.get(key) || group.default;
    group.selects.push(select);
    select.addEventListener('change', () => {
      if (!apply(key, select.value)) return;
      if (select.value === group.default) choices.delete(key); else choices.set(key, select.value);
      save();
      if (storageAvailable) announce(`Notation updated for ${group.label} in ${group.scope}.`);
    });
    const persistenceLabel = element('label', undefined, 'maths-notation-persistence');
    const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = persist; checkbox.disabled = !storageAvailable;
    persistenceControls.push(checkbox);
    persistenceLabel.append(checkbox, document.createTextNode(' Remember my notation choices in this browser'));
    checkbox.addEventListener('change', () => {
      persist = checkbox.checked;
      for (const control of persistenceControls) control.checked = persist;
      if (persist) save();
      else {
        try { localStorage.removeItem(STORAGE_KEY); }
        catch { storageFailure('Remembered choices could not be removed. Current page choices still work, but saved choices may return after navigation.'); return; }
      }
      if (storageAvailable) announce(persist ? 'Notation choices will be remembered in this browser.' : 'Remembered choices removed. Current page choices are kept until navigation.');
    });
    const reset = element('button', 'Reset to authored notation'); reset.type = 'button';
    reset.addEventListener('click', () => {
      choices.clear();
      for (const [groupKey, item] of groups) apply(groupKey, item.default);
      // Removal must precede the optional empty-record write: quota failure
      // must not leave an old nondefault preference ready to reappear.
      try { localStorage.removeItem(STORAGE_KEY); }
      catch { storageFailure('Remembered choices could not be removed. Authored defaults are shown on this page, but saved choices may return after navigation.'); return; }
      if (persist && !save('Browser storage is unavailable. Saved choices were removed and authored defaults are restored; page choices still work and can be exported.')) return;
      announce(storageAvailable ? 'All notation choices reset to the authored defaults and remembered choices removed.'
        : 'All notation choices reset and remembered choices removed. Browser storage remains unavailable for remembering new choices.');
    });
    const download = element('button', 'Export notation choices'); download.type = 'button';
    download.addEventListener('click', () => {
      let url;
      try {
        const file = new Blob([JSON.stringify(exportData(), null, 2) + '\n'], {type:'application/json'});
        url = URL.createObjectURL(file);
        const link = element('a'); link.href = url; link.download = 'notation-choices.json';
        link.click();
        announce('Notation choices exported as JSON.');
      } catch { announce('This browser could not export choices. Your current notation remains unchanged.'); }
      finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
    });
    panel.append(label,select,persistenceLabel,reset,download);
    if (!statusNode) {
      statusNode = element('p', '', 'maths-notation-status'); statusNode.setAttribute('role','status'); statusNode.setAttribute('aria-live','polite');
      panel.append(statusNode);
    }
    host.replaceChildren(panel);
  }
  if (!statusNode && (!storageAvailable || stale || restored)) {
    statusNode = element('span', '', 'maths-notation-status');
    statusNode.setAttribute('role','status'); statusNode.setAttribute('aria-live','polite');
    roots[0].insertAdjacentElement('afterend', statusNode);
  }
  if (!storageAvailable) storageFailure();
  else if (stale) announce('The notation registry changed or saved choices were invalid. Previous browser choices were discarded; authored defaults are shown.');
  else if (restored) announce('Remembered notation choices restored for this registry.');
  // Invalid current-page entries cannot survive a subsequent explicit save.
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
