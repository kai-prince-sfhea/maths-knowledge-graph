/* Copyright 2026 Kai Prince; SPDX-License-Identifier: Apache-2.0 */
(() => {
  'use strict';
  const start = () => {
    const preferences = globalThis.MathsKnowledgeGraphNotationPreferences;
    if (!preferences || preferences.version !== 1) return;
    const STORAGE_KEY = 'maths-knowledge-graph.notation.v1';
    const roots = [...document.querySelectorAll('.maths-notation[data-mk-profile], .maths-notation-controls[data-mk-profile]')];
    if (!roots.length) return;
    const tokens = new Set(roots.map(el => el.dataset.mkToken));
    if (tokens.size !== 1 || !/^[0-9a-f]{40}$/.test(roots[0].dataset.mkToken || '')) return;
    const token = roots[0].dataset.mkToken;
    const groups = new Map(), choices = new Map();
    const persistenceControls = [];
    let statusNode, persist = false, storageAvailable = true, serial = 0, action = 0;
    const context = el => preferences.contextKey({concept:el.dataset.mkConcept,scope:el.dataset.mkScope,profile:el.dataset.mkProfile});
    const announce = (message, target = statusNode) => { if (target && target.textContent !== message) target.textContent = message; };
    const element = (tag, text, className) => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    const storageFailure = (message = 'Browser storage is unavailable. Choices still work on this page and can be exported. Previously saved choices may return after navigation.', target = statusNode) => {
      storageAvailable = false; persist = false;
      for (const checkbox of persistenceControls) { checkbox.checked = false; checkbox.disabled = true; }
      announce(message, target);
    };
    // Preflight all contexts and alternatives before changing any native output.
    // A failed/mixed helper or stale page keeps its rendered AST selection.
    try {
      for (const root of roots) {
        const key = context(root);
        const metadata = {profile:root.dataset.mkProfile,concept:root.dataset.mkConcept,scope:root.dataset.mkScope,
          label:root.dataset.mkConceptLabel || root.dataset.mkProfile,default:root.dataset.mkDefault,
          siteDefault:root.dataset.mkSiteDefault || root.dataset.mkDefault,
          pageDefault:root.dataset.mkPageDefault,override:root.dataset.mkOverride,
          readerChoice:root.dataset.mkReaderChoice,initial:root.dataset.mkInitial || root.dataset.mkDefault};
        let group = groups.get(key);
        if (!group) { group = {...metadata,current:metadata.initial,variants:new Map(),occurrences:[],selects:[]}; groups.set(key,group); }
        for (const name of Object.keys(metadata)) if (metadata[name] !== group[name]) return;
        const variantNodes = root.classList.contains('maths-notation-controls')
          ? [...root.querySelectorAll('.maths-notation-choice')]
          : [...root.children].filter(child => child.classList.contains('maths-notation-variant'));
        const nodesByVariant = new Map();
        for (const node of variantNodes) {
          if (context(node) !== key || node.dataset.mkToken !== token || !node.dataset.mkVariant || nodesByVariant.has(node.dataset.mkVariant)) return;
          if (group.variants.has(node.dataset.mkVariant) && group.variants.get(node.dataset.mkVariant) !== node.dataset.mkLabel) return;
          nodesByVariant.set(node.dataset.mkVariant,node); group.variants.set(node.dataset.mkVariant,node.dataset.mkLabel);
        }
        if (!nodesByVariant.has(group.default) || !nodesByVariant.has(group.initial)) return;
        if (root.classList.contains('maths-notation')) group.occurrences.push(nodesByVariant);
      }
      for (const group of groups.values()) {
        const result = preferences.resolve({...group,variants:[...group.variants.keys()]});
        if (result.variant !== group.initial || preferences.resolve({...group,readerChoice:undefined,variants:[...group.variants.keys()]}).variant !== group.default) return;
        preferences.validate({version:1,token,enabled:false,choices:[{profile:group.profile,concept:group.concept,scope:group.scope,variant:group.initial}]},token);
        for (const occurrence of group.occurrences) {
          if (occurrence.size !== group.variants.size) return;
          for (const variant of group.variants.keys()) {
            const node = occurrence.get(variant);
            if (!node || node.hidden !== (variant !== group.initial)) return;
          }
        }
        if (group.readerChoice) choices.set(preferences.contextKey(group),group.readerChoice);
      }
    } catch { return; }
    const validateCurrentChoices = saved => {
      for (const choice of saved.choices) {
        const group = groups.get(preferences.contextKey(choice));
        if (!group && [...groups.values()].some(item => item.profile === choice.profile)) throw new Error('Conflicting current profile context');
        if (group && !group.variants.has(choice.variant)) throw new Error('Invalid current profile variant');
      }
      return saved;
    };
    let restored = false, stale = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        let saved;
        try {
          saved = validateCurrentChoices(preferences.decode(raw,token));
          if (!saved.enabled) throw new Error('Remembering was not enabled');
        } catch { localStorage.removeItem(STORAGE_KEY); stale = true; }
        if (saved && !stale) {
          persist = true;
          choices.clear();
          for (const choice of saved.choices) choices.set(preferences.contextKey(choice),choice.variant);
          restored = true;
        }
      }
    } catch { storageFailure(); }
    const exportData = () => ({version:1,token,enabled:persist,
      choices:[...choices].map(([key,variant]) => {
        const [concept,scope,profile] = JSON.parse(key); return {profile,concept,scope,variant};
      })});
    const save = (failureMessage, target = statusNode) => {
      if (!persist || !storageAvailable) return false;
      try { localStorage.setItem(STORAGE_KEY,preferences.encode(exportData())); return true; }
      catch { storageFailure(failureMessage, target); return false; }
    };
    const apply = (key,readerChoice) => {
      const group = groups.get(key);
      const result = preferences.resolve({...group,readerChoice,variants:[...group.variants.keys()]});
      const variant = result.variant;
      if (variant !== group.current) {
        for (const occurrence of group.occurrences) {
          const previous = occurrence.get(group.current), next = occurrence.get(variant);
          previous.hidden = true; previous.setAttribute('aria-hidden','true');
          next.hidden = false; next.removeAttribute('aria-hidden');
        }
        group.current = variant;
      }
      for (const select of group.selects) if (select.value !== variant) select.value = variant;
    };
    const applyChoices = () => { for (const key of groups.keys()) apply(key,choices.get(key)); };
    applyChoices();
    for (const host of roots.filter(el => el.classList.contains('maths-notation-controls'))) {
      const key = context(host), group = groups.get(key);
      const panel = element('div',undefined,'maths-notation-panel');
      const localStatus = element('p','','maths-notation-status'); localStatus.setAttribute('role','status'); localStatus.setAttribute('aria-live','polite');
      const announceHere = message => announce(message, localStatus);
      const storageFailureHere = message => storageFailure(message, localStatus);
      const saveHere = message => save(message, localStatus);
      const label = element('label',`Notation for ${group.label} (${group.scope})`), select = element('select');
      let selectId;
      do {selectId = `mk-notation-choice-${++serial}`;} while (document.getElementById(selectId));
      select.id = selectId; label.htmlFor = select.id;
      for (const [id,name] of group.variants) {
        const option = element('option',name + (id === group.default ? ' (authored default)' : ''));
        option.value = id; select.append(option);
      }
      select.value = group.current; select.disabled = group.override !== undefined; group.selects.push(select);
      select.addEventListener('change',() => {
        if (group.override !== undefined || !group.variants.has(select.value)) return;
        if (!choices.has(key) && choices.size >= preferences.LIMITS.choices) {
          select.value = group.current;
          announceHere('The 128-choice limit was reached. Reset or import fewer choices before adding another context.');
          return;
        }
        action++; choices.set(key,select.value); apply(key,select.value); saveHere();
        if (storageAvailable) announceHere(`Notation updated for ${group.label} in ${group.scope}.`);
        else storageFailureHere();
      });
      panel.append(label,select);
      if (group.override !== undefined) {
        const reason = element('p','This page requires its author-selected notation. Your saved preference remains available on other compatible pages.');
        reason.id = `${selectId}-override`; select.setAttribute('aria-describedby',reason.id); panel.append(reason);
      }
      const persistenceLabel = element('label',undefined,'maths-notation-persistence');
      const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = persist; checkbox.disabled = !storageAvailable;
      persistenceControls.push(checkbox);
      persistenceLabel.append(checkbox,document.createTextNode(' Remember my notation choices in this browser'));
      checkbox.addEventListener('change',() => {
        action++; persist = checkbox.checked;
        for (const control of persistenceControls) control.checked = persist;
        if (persist) saveHere();
        else {
          try {localStorage.removeItem(STORAGE_KEY);}
          catch {storageFailureHere('Remembered choices could not be removed. Current page choices still work, but saved choices may return after navigation.');return;}
        }
        if (storageAvailable) announceHere(persist ? 'Notation choices will be remembered in this browser.' : 'Remembered choices removed. Current page choices are kept until navigation.');
      });
      const reset = element('button','Reset to authored notation'); reset.type = 'button';
      reset.addEventListener('click',() => {
        action++; choices.clear(); applyChoices();
        try {localStorage.removeItem(STORAGE_KEY);}
        catch {storageFailureHere('Remembered choices could not be removed. Authored defaults are shown on this page, but saved choices may return after navigation.');return;}
        if (persist && !saveHere('Browser storage is unavailable. Saved choices were removed and authored defaults are restored; page choices still work and can be exported.')) return;
        announceHere(storageAvailable ? 'All notation choices reset to the authored defaults and remembered choices removed.'
          : 'All notation choices reset and remembered choices removed. Browser storage remains unavailable for remembering new choices.');
      });
      const download = element('button','Export notation choices'); download.type = 'button';
      download.addEventListener('click',() => {
        let url;
        try {
          const file = new Blob([preferences.encode(exportData())],{type:'application/json'});
          url = URL.createObjectURL(file);
          const link = element('a'); link.href = url; link.download = 'notation-choices.json'; link.click();
          announceHere('Notation choices exported as JSON.');
        } catch {announceHere('This browser could not export choices. Your current notation remains unchanged.');}
        finally {if (url) setTimeout(() => URL.revokeObjectURL(url),1000);}
      });
      const importLabel = element('label','Import notation choices from a local JSON file');
      const fileInput = element('input'); fileInput.type = 'file'; fileInput.accept = '.json,application/json';
      fileInput.id = `${selectId}-import`; importLabel.htmlFor = fileInput.id;
      fileInput.addEventListener('change',async () => {
        const file = fileInput.files?.[0]; if (!file) return;
        const request = ++action;
        try {
          if (file.size > preferences.LIMITS.bytes) throw new Error('Oversized choices');
          const raw = new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
          const saved = validateCurrentChoices(preferences.decode(raw,token));
          if (request !== action) return;
          choices.clear();
          for (const choice of saved.choices) choices.set(preferences.contextKey(choice),choice.variant);
          applyChoices();
          if (persist && !saveHere()) return;
          const here = saved.choices.filter(choice => groups.has(preferences.contextKey(choice))).length;
          announceHere(`Notation choices imported: ${here} applicable on this page; ${saved.choices.length - here} retained for other compatible contexts. Remembering remains a separate browser choice.`);
        } catch {
          if (request === action) announceHere('Notation choices could not be imported: the file is invalid, oversized or from a different registry. Current choices are unchanged.');
        } finally {fileInput.value = '';}
      });
      panel.append(persistenceLabel,reset,download,importLabel,fileInput);
      if (!statusNode) statusNode = localStatus;
      panel.append(localStatus);
      host.replaceChildren(panel);
    }
    if (!statusNode && (!storageAvailable || stale || restored)) {
      statusNode = element('span','','maths-notation-status'); statusNode.setAttribute('role','status'); statusNode.setAttribute('aria-live','polite');
      roots[0].insertAdjacentElement('afterend',statusNode);
    }
    if (!storageAvailable) storageFailure();
    else if (stale) announce("The notation registry changed or saved choices were invalid. Previous browser choices were discarded; the current page's configured notation is shown.");
    else if (restored) announce('Remembered notation choices restored for this registry. Page-required notation takes precedence.');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
